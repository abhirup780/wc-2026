import { useMemo, useState } from 'react';
import { useMatchDetail } from '../api.ts';
import type { ESPNH2HGame } from '../api.ts';
import { teamName } from '../utils.ts';
import Flag from './Flag.tsx';
import { Lineups } from './MatchDetail.tsx';
import WatchLink from './WatchLink.tsx';
import type { Match, UpcomingMatch } from '@wc2026/shared';

type SoonMatch = Match & { venue?: string; homeForm?: string; awayForm?: string };

const eventIdOf = (m: SoonMatch) => (m.id.startsWith('ESPN-') ? m.id.slice(5) : null);

function stageLabel(m: SoonMatch) {
  if (m.groupId) return `Group ${m.groupId}`;
  const map: Record<string, string> = { r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarter-final', sf: 'Semi-final', '3rd': 'Third place', final: 'Final' };
  return map[m.stage] ?? m.stage.toUpperCase();
}

function kicksIn(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Kicking off';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `Kicks off in ${mins}m`;
  const h = Math.floor(mins / 60);
  return `Kicks off in ${h}h ${mins % 60}m`;
}

// ─── Form pills ─────────────────────────────────────────────────────────────────

function FormPills({ form }: { form?: string }) {
  const last5 = (form ?? '').replace(/[^WLD]/gi, '').slice(-5).toUpperCase();
  if (!last5) return <span className="text-[10px] text-gray-500">—</span>;
  return (
    <span className="flex gap-1 shrink-0" title="Recent form (last 5)">
      {last5.split('').map((r, i) => (
        <span
          key={i}
          className="w-4 h-4 grid place-items-center rounded text-[9px] font-bold text-white"
          style={{ background: r === 'W' ? '#4f9d6b' : r === 'L' ? '#c47576' : '#6b7280' }}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

// ─── Prediction (our model + market) ────────────────────────────────────────────

function PredictionBlock({ p, homeId, awayId }: { p: UpcomingMatch; homeId: string; awayId: string }) {
  return (
    <div>
      {/* xG + win% sit directly under each team name so the side is unambiguous */}
      <div className="grid grid-cols-2 gap-3 mb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Flag code={homeId} size={18} />
            <span className="text-xs font-semibold text-gray-200 truncate">{teamName(homeId)}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tabular-nums text-green-400">{Math.round(p.pHome * 100)}%</span>
            <span className="text-[10px] text-gray-500 tabular-nums">{p.homeXg.toFixed(1)} xG</span>
          </div>
        </div>
        <div className="min-w-0 text-right">
          <div className="flex items-center gap-1.5 mb-1 justify-end">
            <span className="text-xs font-semibold text-gray-200 truncate">{teamName(awayId)}</span>
            <Flag code={awayId} size={18} />
          </div>
          <div className="flex items-baseline gap-2 justify-end">
            <span className="text-[10px] text-gray-500 tabular-nums">{p.awayXg.toFixed(1)} xG</span>
            <span className="text-xl font-bold tabular-nums text-blue-400">{Math.round(p.pAway * 100)}%</span>
          </div>
        </div>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-800">
        <div className="bg-green-500/80" style={{ width: `${p.pHome * 100}%` }} />
        <div className="bg-gray-500" style={{ width: `${p.pDraw * 100}%` }} />
        <div className="bg-fifa-blue" style={{ width: `${p.pAway * 100}%` }} />
      </div>
      <p className="text-center text-[10px] text-gray-400 mt-1.5 tabular-nums">Draw {Math.round(p.pDraw * 100)}%</p>
    </div>
  );
}

// ─── Head-to-head ───────────────────────────────────────────────────────────────

function H2HBlock({ games, loading }: { games: ESPNH2HGame[]; loading: boolean }) {
  if (loading && games.length === 0) return <p className="text-[11px] text-gray-500 text-center py-2">Loading…</p>;
  if (games.length === 0) return <p className="text-[11px] text-gray-500 text-center py-2">No recent meetings.</p>;
  return (
    <div className="space-y-1.5">
      {games.map((g, i) => (
        <div key={i} className="grid grid-cols-[2.2rem_1fr_auto_1fr] items-center gap-2 text-[11px]">
          <span className="text-gray-500 tabular-nums">{g.date.slice(0, 4)}</span>
          <span className="flex items-center gap-1.5 min-w-0 justify-end">
            <span className="truncate text-gray-300">{teamName(g.homeCode)}</span>
            <Flag code={g.homeCode} size={16} />
          </span>
          <span className="tabular-nums font-semibold text-gray-100 px-1">{g.homeScore}–{g.awayScore}</span>
          <span className="flex items-center gap-1.5 min-w-0 justify-start">
            <Flag code={g.awayCode} size={16} />
            <span className="truncate text-gray-300">{teamName(g.awayCode)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Expandable pre-match panel ─────────────────────────────────────────────────

type Tab = 'prediction' | 'h2h' | 'lineups';

function PreMatchPanel({ detail, loading, prediction, homeId, awayId }: {
  detail: ReturnType<typeof useMatchDetail>['detail'];
  loading: boolean;
  prediction?: UpcomingMatch;
  homeId: string;
  awayId: string;
}) {
  const tabs = useMemo<{ key: Tab; label: string }[]>(() => {
    const t: { key: Tab; label: string }[] = [];
    if (prediction) t.push({ key: 'prediction', label: 'Prediction' });
    t.push({ key: 'h2h', label: 'Head-to-head' });
    t.push({ key: 'lineups', label: 'Lineups' });
    return t;
  }, [prediction]);

  const [tab, setTab] = useState<Tab>(prediction ? 'prediction' : 'h2h');
  const active = tabs.some(t => t.key === tab) ? tab : tabs[0]?.key;

  return (
    <div>
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

      {active === 'prediction' && prediction && <PredictionBlock p={prediction} homeId={homeId} awayId={awayId} />}
      {active === 'h2h' && <H2HBlock games={detail?.h2h ?? []} loading={loading} />}
      {active === 'lineups' && (
        (detail?.homeLineup || detail?.awayLineup)
          ? <Lineups homeId={homeId} awayId={awayId} home={detail?.homeLineup} away={detail?.awayLineup} />
          : <p className="text-[11px] text-gray-500 text-center py-2">{loading ? 'Loading…' : 'Lineups not announced yet — usually confirmed about an hour before kickoff.'}</p>
      )}
    </div>
  );
}

// ─── Soon card ──────────────────────────────────────────────────────────────────

function TeamLine({ code, form }: { code: string; form?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <Flag code={code} size={24} />
      <span className="flex-1 min-w-0 truncate text-sm font-semibold text-gray-100">{teamName(code)}</span>
      <FormPills form={form} />
    </div>
  );
}

export default function SoonCard({ m, prediction }: { m: SoonMatch; prediction?: UpcomingMatch }) {
  const [open, setOpen] = useState(false);
  // Poll while open so lineups appear as soon as ESPN confirms them.
  const { detail, loading } = useMatchDetail(open ? eventIdOf(m) : null, 60_000);

  return (
    <div className="rounded-2xl border border-fifa-blue/40 bg-gray-900 overflow-hidden"
      style={{ boxShadow: '0 0 24px rgba(29,111,224,0.10)' }}>
      <div className="px-4 py-3 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-widest text-fifa-blue font-semibold">{stageLabel(m)}</span>
          <span className="text-xs font-semibold text-fifa-blue tabular-nums whitespace-nowrap">{kicksIn(m.kickoffUtc)}</span>
        </div>

        <TeamLine code={m.homeId} form={m.homeForm} />
        <TeamLine code={m.awayId} form={m.awayForm} />

        {/* Watch CTA — appears once the match enters its broadcast window (~1h out) */}
        <div className="mt-2.5" onClick={e => e.stopPropagation()}>
          <WatchLink homeId={m.homeId} awayId={m.awayId} className="w-full" />
        </div>

        <div className="flex items-center justify-between gap-2 mt-2 text-[10px] text-gray-500">
          <span className="truncate">{m.venue ?? ''}</span>
          <span className="flex items-center gap-1 shrink-0 text-gray-400">
            {open ? 'Hide info' : 'Match info'}
            <span className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
          </span>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-3 pt-3 hairline-t">
          <PreMatchPanel detail={detail} loading={loading} prediction={prediction} homeId={m.homeId} awayId={m.awayId} />
        </div>
      )}
    </div>
  );
}
