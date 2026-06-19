import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ESPNMatchDetail, ESPNGoal, ESPNCard, ESPNStat, ESPNLineup, ESPNLineupPlayer } from '../api.ts';
import { teamName } from '../utils.ts';
import Flag from './Flag.tsx';

// ─── Small icons ──────────────────────────────────────────────────────────────

function CardGlyph({ type }: { type: 'yellow' | 'red' }) {
  return (
    <span
      className="inline-block w-2.5 h-3.5 rounded-[2px] shrink-0"
      style={{ background: type === 'yellow' ? '#eab308' : '#dc2626' }}
    />
  );
}
function Ball() {
  return <span className="text-gray-500 text-[11px]">⚽</span>;
}
function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function WhistleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11a5 5 0 0 0 5 5h2l4 3v-9H8a5 5 0 0 0-5 1z" /><circle cx="17" cy="12" r="4" />
    </svg>
  );
}

// ─── Teams header (anchors which side is home / away) ───────────────────────────

function TeamsHeader({ homeId, awayId, variant, colors }: { homeId: string; awayId: string; variant: 'rail' | 'spread'; colors?: boolean }) {
  // 'rail' hugs the centre line to line up with the timeline's event columns;
  // 'spread' pushes teams to the edges to align with full-width stat bars.
  if (variant === 'rail') {
    return (
      <div className="grid grid-cols-[1fr_2.5rem_1fr] items-center gap-2 pb-2 mb-3 hairline-b text-[11px]">
        <span className="flex items-center gap-1.5 min-w-0 justify-end">
          <span className="font-semibold text-gray-200 truncate">{teamName(homeId)}</span>
          <Flag code={homeId} size={18} />
        </span>
        <span aria-hidden />
        <span className="flex items-center gap-1.5 min-w-0 justify-start">
          <Flag code={awayId} size={18} />
          <span className="font-semibold text-gray-200 truncate">{teamName(awayId)}</span>
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2 pb-2 mb-3 hairline-b text-[11px]">
      <span className="flex items-center gap-1.5 min-w-0">
        <Flag code={homeId} size={18} />
        {colors && <span className="w-2 h-2 rounded-full bg-fifa-blue shrink-0" />}
        <span className="font-semibold text-gray-200 truncate">{teamName(homeId)}</span>
      </span>
      <span className="flex items-center gap-1.5 min-w-0 justify-end">
        <span className="font-semibold text-gray-200 truncate">{teamName(awayId)}</span>
        {colors && <span className="w-2 h-2 rounded-full bg-fifa-gold shrink-0" />}
        <Flag code={awayId} size={18} />
      </span>
    </div>
  );
}

// ─── Event timeline (goals + cards, centre-rail) ────────────────────────────────

type TLEvent = { minute: string; order: number; forHome: boolean; node: ReactNode };

const minuteNum = (m: string) => {
  const base = parseInt(m, 10) || 0;
  const add = m.includes('+') ? parseInt(m.split('+')[1], 10) || 0 : 0;
  return base * 100 + add;
};

function goalNode(g: ESPNGoal, side: 'home' | 'away') {
  const tag = g.type === 'penalty' ? 'pen.' : g.type === 'own-goal' ? 'OG' : '';
  const name = g.scorer.split(' ').slice(-1)[0] || g.scorer;
  const inner = (
    <>
      <Ball />
      <span className="text-gray-100 font-medium truncate">{name}</span>
      {tag && <span className={`text-[10px] font-semibold ${g.type === 'own-goal' ? 'text-red-400' : 'text-amber-400'}`}>{tag}</span>}
    </>
  );
  return side === 'home'
    ? <span className="flex items-center gap-1.5 justify-end flex-row-reverse">{inner}</span>
    : <span className="flex items-center gap-1.5">{inner}</span>;
}

function cardNode(c: ESPNCard, side: 'home' | 'away') {
  const name = c.player.split(' ').slice(-1)[0] || c.player;
  const inner = (
    <>
      <CardGlyph type={c.type} />
      <span className="text-gray-300 truncate">{name}</span>
    </>
  );
  return side === 'home'
    ? <span className="flex items-center gap-1.5 justify-end flex-row-reverse">{inner}</span>
    : <span className="flex items-center gap-1.5">{inner}</span>;
}

function EventTimeline({ goals, cards }: { goals: ESPNGoal[]; cards: ESPNCard[] }) {
  const events = useMemo<TLEvent[]>(() => {
    const list: TLEvent[] = [];
    goals.forEach((g, i) => list.push({ minute: g.minute, order: minuteNum(g.minute) * 10 + i, forHome: g.forHome, node: goalNode(g, g.forHome ? 'home' : 'away') }));
    cards.forEach((c, i) => list.push({ minute: c.minute, order: minuteNum(c.minute) * 10 + i, forHome: c.forHome, node: cardNode(c, c.forHome ? 'home' : 'away') }));
    return list.sort((a, b) => a.order - b.order);
  }, [goals, cards]);

  if (events.length === 0) {
    return <p className="text-[11px] text-gray-500 text-center py-2">No goals or cards recorded.</p>;
  }
  return (
    <div className="space-y-1.5">
      {events.map((ev, i) => (
        <div key={i} className="grid grid-cols-[1fr_2.5rem_1fr] items-center gap-2 text-[11px]">
          <div className="flex justify-end min-w-0">{ev.forHome ? ev.node : null}</div>
          <span className="justify-self-center text-[10px] text-gray-500 tabular-nums bg-gray-800 rounded px-1.5 py-0.5 leading-none">{ev.minute}</span>
          <div className="flex justify-start min-w-0">{!ev.forHome ? ev.node : null}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Stats comparison bars ──────────────────────────────────────────────────────

function StatsBars({ stats }: { stats: ESPNStat[] }) {
  return (
    <div className="space-y-2.5">
      {stats.map((s, i) => {
        const total = s.homeVal + s.awayVal;
        const hPct = total > 0 ? (s.homeVal / total) * 100 : 50;
        const homeLead = s.homeVal >= s.awayVal;
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className={`tabular-nums w-10 ${homeLead ? 'text-gray-100 font-semibold' : 'text-gray-400'}`}>{s.home}</span>
              <span className="text-gray-400 text-[10px] uppercase tracking-wide">{s.label}</span>
              <span className={`tabular-nums w-10 text-right ${!homeLead ? 'text-gray-100 font-semibold' : 'text-gray-400'}`}>{s.away}</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-800 gap-px">
              <div className="bg-fifa-blue rounded-l-full transition-all duration-500" style={{ width: `${hPct}%` }} />
              <div className="bg-fifa-gold rounded-r-full transition-all duration-500" style={{ width: `${100 - hPct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Lineups ────────────────────────────────────────────────────────────────────

function PlayerRow({ p, muted }: { p: ESPNLineupPlayer; muted?: boolean }) {
  return (
    <li className="flex items-center gap-2 py-[3px] text-[11px]">
      <span className="grid place-items-center w-5 h-5 rounded bg-gray-800 text-gray-400 text-[10px] tabular-nums shrink-0">{p.jersey || '–'}</span>
      <span className={`truncate ${muted ? 'text-gray-400' : 'text-gray-200'}`}>{p.name}</span>
      {p.position && <span className="ml-auto text-[10px] text-gray-500 font-mono shrink-0">{p.position}</span>}
    </li>
  );
}

function TeamLineup({ code, lineup }: { code: string; lineup: ESPNLineup }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <Flag code={code} size={18} />
        <span className="text-xs font-semibold text-gray-200 truncate">{teamName(code)}</span>
        {lineup.formation && <span className="ml-auto text-[10px] text-gray-500 font-mono shrink-0">{lineup.formation}</span>}
      </div>
      <ul>{lineup.starters.map((p, i) => <PlayerRow key={i} p={p} />)}</ul>
      {lineup.subs.length > 0 && (
        <div className="mt-2 pt-2 hairline-t">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Substitutes</p>
          <ul>{lineup.subs.map((p, i) => <PlayerRow key={i} p={p} muted />)}</ul>
        </div>
      )}
    </div>
  );
}

export function Lineups({ homeId, awayId, home, away }: { homeId: string; awayId: string; home?: ESPNLineup; away?: ESPNLineup }) {
  if (!home && !away) return <p className="text-[11px] text-gray-500 text-center py-2">Lineups not available yet.</p>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      {home && <TeamLineup code={homeId} lineup={home} />}
      {away && <TeamLineup code={awayId} lineup={away} />}
    </div>
  );
}

// ─── Commentary ─────────────────────────────────────────────────────────────────

function Commentary({ items }: { items: { minute: string; text: string }[] }) {
  if (items.length === 0) return <p className="text-[11px] text-gray-500 text-center py-2">No commentary yet.</p>;
  return (
    <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
      {items.map((c, i) => (
        <div key={i} className="flex gap-2 text-[11px]">
          {c.minute
            ? <span className="text-[10px] text-gray-500 tabular-nums bg-gray-800 rounded px-1.5 py-0.5 leading-none shrink-0 mt-px">{c.minute}</span>
            : <span className="w-1.5 h-1.5 rounded-full bg-gray-700 shrink-0 mt-1.5" />}
          <span className="text-gray-300 leading-snug">{c.text}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Meta row ───────────────────────────────────────────────────────────────────

function MatchMeta({ venue, referee }: { venue?: string; referee?: string }) {
  if (!venue && !referee) return null;
  return (
    <div className="flex flex-wrap items-center justify-center text-center gap-x-4 gap-y-1 text-[10px] text-gray-500 mb-3">
      {venue && <span className="flex items-center gap-1"><PinIcon />{venue}</span>}
      {referee && <span className="flex items-center gap-1"><WhistleIcon />{referee}</span>}
    </div>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────────────────

type TabKey = 'timeline' | 'stats' | 'lineups' | 'commentary';

export default function MatchDetailPanel({
  detail, homeId, awayId, live, loading,
}: {
  detail: ESPNMatchDetail | null;
  homeId: string;
  awayId: string;
  live: boolean;
  loading: boolean;
}) {
  const tabs = useMemo<{ key: TabKey; label: string }[]>(() => {
    if (!detail) return [];
    const t: { key: TabKey; label: string }[] = [{ key: 'timeline', label: 'Timeline' }];
    if (detail.stats.length) t.push({ key: 'stats', label: 'Stats' });
    if (detail.homeLineup || detail.awayLineup) t.push({ key: 'lineups', label: 'Lineups' });
    if (live && detail.commentary.length) t.push({ key: 'commentary', label: 'Commentary' });
    return t;
  }, [detail, live]);

  const [tab, setTab] = useState<TabKey>('timeline');
  const active = tabs.some(t => t.key === tab) ? tab : 'timeline';

  if (loading && !detail) {
    return <div className="text-[11px] text-gray-500 text-center py-4">Loading match details…</div>;
  }
  if (!detail) return null;

  const commentaryItems = live ? [...detail.commentary].reverse() : detail.commentary;

  return (
    <div>
      <MatchMeta venue={detail.venue} referee={detail.referee} />

      {tabs.length > 1 && (
        <div className="flex gap-1 mb-3 p-0.5 bg-gray-800/60 rounded-lg w-fit mx-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                active === t.key ? 'bg-gray-900 text-gray-100 shadow-sm' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {active === 'timeline' && (
        <div className="max-w-md mx-auto">
          <TeamsHeader homeId={homeId} awayId={awayId} variant="rail" />
          <EventTimeline goals={detail.goals} cards={detail.cards} />
        </div>
      )}
      {active === 'stats' && (
        <div>
          <TeamsHeader homeId={homeId} awayId={awayId} variant="spread" colors />
          <StatsBars stats={detail.stats} />
        </div>
      )}
      {active === 'lineups' && <Lineups homeId={homeId} awayId={awayId} home={detail.homeLineup} away={detail.awayLineup} />}
      {active === 'commentary' && <Commentary items={commentaryItems} />}
    </div>
  );
}
