import { useCallback, useMemo, useState } from 'react';
import { usePolled, fetchScores, useESPNLive, fetchGoalsForEvent } from '../api.ts';
import type { ESPNLiveMatch, ESPNGoal } from '../api.ts';
import { teamName, formatKickoff } from '../utils.ts';
import Flag from './Flag.tsx';
import type { Match } from '@wc2026/shared';

type RichMatch = Match & { clock?: string; goals?: ESPNGoal[] };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function localDay(iso: string) { return new Date(iso).toLocaleDateString('en-CA'); }
const todayStr  = () => localDay(new Date().toISOString());
const yestStr   = () => localDay(new Date(Date.now() - 864e5).toISOString());
const tomStr    = () => localDay(new Date(Date.now() + 864e5).toISOString());

function bucketOf(m: RichMatch) {
  if (m.status === 'live') return 'live';
  const d = localDay(m.kickoffUtc);
  if (m.status === 'finished') {
    if (d === todayStr())  return 'today';
    if (d === yestStr()) return 'yesterday';
    return 'earlier';
  }
  return 'upcoming';
}

function dayLabel(iso: string) {
  const d = localDay(iso);
  if (d === todayStr())  return 'Today';
  if (d === yestStr())  return 'Yesterday';
  if (d === tomStr())   return 'Tomorrow';
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function countdown(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Soon';
  const h = Math.floor(diff / 36e5), m = Math.floor((diff % 36e5) / 6e4);
  if (h > 23) return `in ${Math.floor(h / 24)}d`;
  return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
}

function stageLabel(m: RichMatch) {
  if (m.groupId) return `Group ${m.groupId}`;
  const map: Record<string, string> = { r32:'R32', r16:'R16', qf:'QF', sf:'SF', '3rd':'3rd Place', final:'Final' };
  return map[m.stage] ?? m.stage.toUpperCase();
}

function mergeESPN(base: Match[], live: ESPNLiveMatch[]): RichMatch[] {
  const byKey = new Map(live.map(m => [`${m.homeCode}-${m.awayCode}`, m]));
  return base.map(m => {
    const o = byKey.get(`${m.homeId}-${m.awayId}`);
    if (!o) {
      if (m.status === 'live') {
        const kickoffTime = new Date(m.kickoffUtc).getTime();
        const threeHoursAgo = Date.now() - 3 * 3600 * 1000;
        if (kickoffTime < threeHoursAgo) {
          return { ...m, status: 'finished' };
        }
      }
      return m;
    }
    return { ...m, status: o.status, homeGoals: o.homeScore ?? m.homeGoals,
      awayGoals: o.awayScore ?? m.awayGoals, clock: o.clock || undefined, goals: o.goals };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────


function GoalLine({ g }: { g: ESPNGoal }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-gray-400 leading-snug">
      <span className="text-gray-500">⚽</span>
      <span className="text-gray-100">{g.scorer.split(' ').slice(-1)[0]}</span>
      {g.type === 'own-goal' && <span className="text-red-400 text-[10px] font-semibold">OG</span>}
      {g.type === 'penalty'  && <span className="text-amber-400 text-[10px] font-semibold">pen.</span>}
      <span className="text-gray-500 tabular-nums">{g.minute}&apos;</span>
    </span>
  );
}

// Scorer drawer — used inside finished cards
function ScorerDrawer({ goals, open }: { goals: ESPNGoal[]; open: boolean }) {
  const home = goals.filter(g => g.forHome);
  const away = goals.filter(g => !g.forHome);
  return (
    <div className={`scorer-grid ${open ? 'open' : ''}`}>
      <div className="scorer-inner">
        <div className="flex gap-2 pt-3 mt-3 hairline-t">
          {/* home side */}
          <div className="flex-1 flex flex-col gap-0.5">
            {home.length ? home.map((g, i) => <GoalLine key={i} g={g} />) : (
              <span className="text-[11px] text-gray-600">—</span>
            )}
          </div>
          {/* spacer matching score column */}
          <div className="w-20 flex-shrink-0" />
          {/* away side */}
          <div className="flex-1 flex flex-col items-end gap-0.5">
            {away.length ? away.map((g, i) => (
              <span key={i} className="flex items-center gap-1.5 text-[11px] text-gray-400 leading-snug">
                <span className="text-gray-500 tabular-nums">{g.minute}&apos;</span>
                {g.type === 'penalty'  && <span className="text-amber-400 text-[10px] font-semibold">pen.</span>}
                {g.type === 'own-goal' && <span className="text-red-400 text-[10px] font-semibold">OG</span>}
                <span className="text-gray-100">{g.scorer.split(' ').slice(-1)[0]}</span>
                <span className="text-gray-500">⚽</span>
              </span>
            )) : (
              <span className="text-[11px] text-gray-600">—</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LIVE CARD ────────────────────────────────────────────────────────────────
// Always shows scorers. Prominent, glowing.

function LiveCard({ m }: { m: RichMatch }) {
  const hW = (m.homeGoals ?? 0) > (m.awayGoals ?? 0);
  const aW = (m.awayGoals ?? 0) > (m.homeGoals ?? 0);
  const hGoals = m.goals?.filter(g => g.forHome) ?? [];
  const aGoals = m.goals?.filter(g => !g.forHome) ?? [];
  const hasGoals = hGoals.length + aGoals.length > 0;

  return (
    <div className="live-card relative rounded-2xl overflow-hidden">
      {/* top accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-500 to-transparent" />

      <div className="p-5">
        {/* Stage + clock */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="text-xs text-gray-400 uppercase tracking-widest font-medium">{stageLabel(m)}</span>
          <span className="flex items-center gap-1.5 bg-green-950/80 border border-green-800/60 rounded-full px-2.5 py-0.5">
            <span className="live-dot" />
            <span className="text-green-300 text-xs font-semibold tabular-nums">{m.clock || 'LIVE'}</span>
          </span>
        </div>

        {/* Teams + score */}
        <div className="flex items-center">
          {/* Home */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <Flag code={m.homeId} size={52} />
            <div className="text-center">
              <p className={`text-sm font-bold leading-tight ${hW ? 'text-gray-50' : 'text-gray-300'}`}>{teamName(m.homeId)}</p>
              <p className="text-[10px] font-mono text-gray-500 tracking-widest mt-0.5">{m.homeId}</p>
            </div>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center px-4">
            <div className="font-bold tabular-nums leading-none tracking-tight"
              style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)',
                textShadow: '0 0 30px rgba(255,255,255,0.12)' }}>
              <span className={hW ? 'text-gray-50' : 'text-gray-500'}>{m.homeGoals ?? '–'}</span>
              <span className="text-gray-600 mx-3">:</span>
              <span className={aW ? 'text-gray-50' : 'text-gray-500'}>{m.awayGoals ?? '–'}</span>
            </div>
          </div>

          {/* Away */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <Flag code={m.awayId} size={52} />
            <div className="text-center">
              <p className={`text-sm font-bold leading-tight ${aW ? 'text-gray-50' : 'text-gray-300'}`}>{teamName(m.awayId)}</p>
              <p className="text-[10px] font-mono text-gray-500 tracking-widest mt-0.5">{m.awayId}</p>
            </div>
          </div>
        </div>

        {/* Scorers — always visible for live */}
        {hasGoals && (
          <div className="flex gap-2 mt-4 pt-4 hairline-t">
            <div className="flex-1 flex flex-col gap-0.5">
              {hGoals.map((g, i) => <GoalLine key={i} g={g} />)}
            </div>
            <div className="w-16 flex-shrink-0" />
            <div className="flex-1 flex flex-col items-end gap-0.5">
              {aGoals.map((g, i) => (
                <span key={i} className="flex items-center gap-1.5 text-[11px] text-gray-400 leading-snug">
                  <span className="text-gray-500 tabular-nums">{g.minute}&apos;</span>
                  {g.type === 'penalty'  && <span className="text-amber-400 text-[10px] font-semibold">pen.</span>}
                  {g.type === 'own-goal' && <span className="text-red-400 text-[10px] font-semibold">OG</span>}
                  <span className="text-gray-100">{g.scorer.split(' ').slice(-1)[0]}</span>
                  <span className="text-gray-500">⚽</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FINISHED CARD ────────────────────────────────────────────────────────────
// Goals lazy-loaded from ESPN on first expand. Works for all historical matches.

function FinishedCard({ m }: { m: RichMatch }) {
  // null  = not yet fetched; []  = fetched, no goals (0-0); [...] = fetched, has goals
  const [goals, setGoals] = useState<ESPNGoal[] | null>(m.goals ?? null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const hW = (m.homeGoals ?? -1) > (m.awayGoals ?? -1);
  const aW = (m.awayGoals ?? -1) > (m.homeGoals ?? -1);
  // Non-zero score: worth fetching (0-0 could still have own-goals listed, but rare)
  const fetchable = m.id.startsWith('ESPN-');

  async function handleClick() {
    if (!open && goals === null && fetchable) {
      setLoading(true);
      const espnId = m.id.slice(5);
      const fetched = await fetchGoalsForEvent(espnId, m.homeId);
      setGoals(fetched);
      setLoading(false);
    }
    setOpen(o => !o);
  }

  const hasGoals = (goals?.length ?? 0) > 0;
  // Show chevron if we haven't fetched yet (optimistic) or have goals
  const showToggle = fetchable && (goals === null || hasGoals);

  return (
    <div
      className={`rounded-xl border transition-colors duration-150 overflow-hidden
        ${open ? 'bg-gray-900 border-gray-700' : 'bg-gray-900/80 border-gray-800/80'}
        ${showToggle ? 'cursor-pointer hover:border-gray-600 hover:bg-gray-900' : ''}`}
      onClick={showToggle ? handleClick : undefined}
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <span className="hidden sm:block text-[10px] text-gray-500 w-12 flex-shrink-0 uppercase tracking-wider text-center">
          {stageLabel(m)}
        </span>

        {/* Home */}
        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          <div className="text-right min-w-0">
            <p className={`text-sm font-semibold truncate leading-tight ${hW ? 'text-gray-50' : 'text-gray-400'}`}>
              {teamName(m.homeId)}
            </p>
            <p className="text-[10px] font-mono text-gray-500 tracking-widest">{m.homeId}</p>
          </div>
          <Flag code={m.homeId} size={28} />
        </div>

        {/* Score */}
        <div className="flex flex-col items-center w-20 flex-shrink-0 select-none">
          <div className="text-xl font-bold tabular-nums leading-none tracking-tight">
            <span className={hW ? 'text-gray-50' : 'text-gray-500'}>{m.homeGoals ?? '–'}</span>
            <span className="text-gray-600 mx-1.5">–</span>
            <span className={aW ? 'text-gray-50' : 'text-gray-500'}>{m.awayGoals ?? '–'}</span>
          </div>
          <span className="text-[10px] text-gray-500 mt-0.5 font-medium tracking-wide">FT</span>
        </div>

        {/* Away */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Flag code={m.awayId} size={28} />
          <div className="min-w-0">
            <p className={`text-sm font-semibold truncate leading-tight ${aW ? 'text-gray-50' : 'text-gray-400'}`}>
              {teamName(m.awayId)}
            </p>
            <p className="text-[10px] font-mono text-gray-500 tracking-widest">{m.awayId}</p>
          </div>
        </div>

        {/* Chevron / spinner */}
        {showToggle && (
          <span className={`text-gray-500 text-xs flex-shrink-0 ml-1 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            {loading ? '·' : '▾'}
          </span>
        )}
      </div>

      {/* Scorer drawer — shown once goals are loaded */}
      {open && (
        <div className="px-3 pb-3">
          {loading ? (
            <div className="pt-3 mt-3 hairline-t text-[11px] text-gray-600 text-center">Loading scorers…</div>
          ) : hasGoals ? (
            <ScorerDrawer goals={goals!} open />
          ) : goals !== null ? (
            <div className="pt-3 mt-3 hairline-t text-[11px] text-gray-600 text-center">No scorer data available</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── UPCOMING CARD ────────────────────────────────────────────────────────────

function UpcomingCard({ m, accent }: { m: RichMatch; accent?: boolean }) {
  const isToday = localDay(m.kickoffUtc) === todayStr();
  const diff    = new Date(m.kickoffUtc).getTime() - Date.now();
  const isSoon  = diff >= 0 && diff <= 12 * 36e5;   // within the next 12 hours
  // Soon matches always get the focus treatment (incl. after-midnight ones in
  // the Upcoming list); today's matches only when their section opts in.
  const hi = isSoon || (accent && isToday);
  return (
    <div className={`rounded-xl border px-3 py-3 flex items-center gap-2 transition-colors duration-150
      ${hi ? 'bg-gray-900 border-blue-900/70 hover:border-blue-700' : 'bg-gray-900/50 border-gray-800/50 hover:border-gray-700'}`}>
      <span className="hidden sm:block text-[10px] text-gray-500 w-12 flex-shrink-0 uppercase tracking-wider text-center">
        {stageLabel(m)}
      </span>

      {/* Home */}
      <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
        <div className="text-right min-w-0">
          <p className="text-sm font-semibold text-gray-300 truncate leading-tight">{teamName(m.homeId)}</p>
          <p className="text-[10px] font-mono text-gray-500 tracking-widest">{m.homeId}</p>
        </div>
        <Flag code={m.homeId} size={28} />
      </div>

      {/* Kickoff */}
      <div className="flex flex-col items-center w-20 flex-shrink-0">
        <span className={`text-xs font-semibold tabular-nums leading-tight text-center
          ${hi ? 'text-blue-300' : 'text-gray-400'}`}>
          {(isToday || isSoon) ? countdown(m.kickoffUtc) : formatKickoff(m.kickoffUtc)}
        </span>
        <span className="text-[10px] text-gray-500 mt-0.5">vs</span>
      </div>

      {/* Away */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Flag code={m.awayId} size={28} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-300 truncate leading-tight">{teamName(m.awayId)}</p>
          <p className="text-[10px] font-mono text-gray-500 tracking-widest">{m.awayId}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label, count, collapsible, collapsed, onToggle }:
  { label: string; count: number; collapsible?: boolean; collapsed?: boolean; onToggle?: () => void }) {
  return (
    <button className="flex items-center gap-3 w-full text-left group py-1"
      onClick={collapsible ? onToggle : undefined} disabled={!collapsible}>
      <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-gray-200 transition-colors">
        {label}
      </span>
      <span className="text-[11px] text-gray-500 font-mono">{count}</span>
      <div className="flex-1 h-px bg-gray-800/80" />
      {collapsible && (
        <span className={`text-gray-600 text-xs transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}>▾</span>
      )}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LiveScores() {
  const fetcher = useCallback(() => fetchScores(), []);
  const { data, loading, error } = usePolled(fetcher, 60_000);
  const { matches: espnMatches, hasLive, lastSync, failed } = useESPNLive(30_000);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(true);

  const all = useMemo(() => {
    if (!data) return [];
    return mergeESPN(data.matches, espnMatches);
  }, [data, espnMatches]);

  const live      = useMemo(() => all.filter(m => bucketOf(m) === 'live')
    .sort((a,b) => a.kickoffUtc.localeCompare(b.kickoffUtc)), [all]);
  const today     = useMemo(() => all.filter(m => bucketOf(m) === 'today')
    .sort((a,b) => b.kickoffUtc.localeCompare(a.kickoffUtc)), [all]);
  const yesterday = useMemo(() => all.filter(m => bucketOf(m) === 'yesterday')
    .sort((a,b) => b.kickoffUtc.localeCompare(a.kickoffUtc)), [all]);
  const earlier   = useMemo(() => all.filter(m => bucketOf(m) === 'earlier')
    .sort((a,b) => b.kickoffUtc.localeCompare(a.kickoffUtc)), [all]);
  const upcoming  = useMemo(() => all.filter(m => bucketOf(m) === 'upcoming')
    .sort((a,b) => a.kickoffUtc.localeCompare(b.kickoffUtc)), [all]);

  // Keep "Today" strictly calendar-today so after-midnight matches aren't
  // mislabelled. Matches within the next 12h still get focus styling (accent +
  // countdown) wherever they sit — see UpcomingCard — so a 2am kickoff shows up
  // highlighted under "Tomorrow" rather than pretending to be today.
  const todayUp   = upcoming.filter(m => localDay(m.kickoffUtc) === todayStr());
  const futureUp  = upcoming.filter(m => localDay(m.kickoffUtc) !== todayStr());
  const futureByDay = useMemo(() => {
    const map = new Map<string, RichMatch[]>();
    for (const m of futureUp) {
      const d = localDay(m.kickoffUtc);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(m);
    }
    return map;
  }, [futureUp]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-600 text-sm">Loading…</div>
  );
  if (error || !data) return (
    <div className="card text-red-400 text-sm">
      Failed to load scores: {error ?? 'unknown error'}.
    </div>
  );

  const todayCount = today.length + todayUp.length;

  return (
    <div className="space-y-7 max-w-2xl mx-auto">

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-bold tracking-tight">Scores</h2>
          {hasLive && (
            <span className="flex items-center gap-1.5 bg-green-950 border border-green-800/60 text-green-300 text-[11px] font-semibold px-2.5 py-1 rounded-full">
              <span className="live-dot" /> LIVE
            </span>
          )}
        </div>
        <span className="text-[11px] tabular-nums">
          {lastSync == null
            ? (failed
                ? <span className="text-amber-500/90">⚠ Live unavailable · saved scores</span>
                : <span className="text-amber-400/90 animate-pulse">Syncing live scores…</span>)
            : hasLive
              ? <span className="text-green-500">● Live · ESPN</span>
              : <span className="text-gray-400">
                  {failed ? 'Offline · ' : ''}Updated {lastSync.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                </span>}
        </span>
      </div>

      {/* ── LIVE NOW ── always-on scorers */}
      {live.length > 0 && (
        <section className="space-y-3">
          <SectionHeader label="Live Now" count={live.length} />
          {live.map(m => <LiveCard key={m.id} m={m} />)}
        </section>
      )}

      {/* ── TODAY ── finished open by default, upcoming below */}
      {todayCount > 0 && (
        <section className="space-y-2">
          <SectionHeader
            label={`Today · ${new Date().toLocaleDateString(undefined, { month:'short', day:'numeric' })}`}
            count={todayCount}
          />
          <div className="space-y-1.5">
            {today.map(m => <FinishedCard key={m.id} m={m} />)}
            {todayUp.map(m => <UpcomingCard key={m.id} m={m} accent />)}
          </div>
        </section>
      )}

      {/* ── YESTERDAY ── click-to-reveal */}
      {yesterday.length > 0 && (
        <section className="space-y-2">
          <SectionHeader
            label={`Yesterday · ${new Date(Date.now()-864e5).toLocaleDateString(undefined, { month:'short', day:'numeric' })}`}
            count={yesterday.length}
          />
          <div className="space-y-1.5">
            {yesterday.map(m => <FinishedCard key={m.id} m={m} />)}
          </div>
        </section>
      )}

      {/* ── EARLIER ── collapsed by default, click-to-reveal per card */}
      {earlier.length > 0 && (
        <section className="space-y-2">
          <SectionHeader label="Earlier Results" count={earlier.length}
            collapsible collapsed={!earlierOpen} onToggle={() => setEarlierOpen(o => !o)} />
          {earlierOpen && (
            <div className="space-y-1.5">
              {earlier.map(m => <FinishedCard key={m.id} m={m} />)}
            </div>
          )}
        </section>
      )}

      {/* ── UPCOMING ── grouped by day, collapsible section */}
      {futureUp.length > 0 && (
        <section className="space-y-2">
          <SectionHeader label="Upcoming Fixtures" count={futureUp.length}
            collapsible collapsed={!upcomingOpen} onToggle={() => setUpcomingOpen(o => !o)} />
          {upcomingOpen && (
            <div className="space-y-5">
              {[...futureByDay.entries()].map(([, ms]) => (
                <div key={localDay(ms[0].kickoffUtc)} className="space-y-1.5">
                  <p className="text-[11px] text-gray-500 font-semibold pl-1 uppercase tracking-widest">
                    {dayLabel(ms[0].kickoffUtc)}
                  </p>
                  {ms.map(m => <UpcomingCard key={m.id} m={m} />)}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

    </div>
  );
}
