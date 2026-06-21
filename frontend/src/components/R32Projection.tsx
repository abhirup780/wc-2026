import { useCallback, useState } from 'react';
import { usePolled, fetchR32 } from '../api.ts';
import { FIFA_NAMES } from '../utils.ts';
import Flag from './Flag.tsx';
import type { R32Matchup, R32Contender } from '@wc2026/shared';

const isTeamCode = (code: string) => code in FIFA_NAMES;
const pct = (p: number) => `${Math.round(p * 100)}%`;

function MiniFlag({ code }: { code: string }) {
  return isTeamCode(code)
    ? <Flag code={code} size={16} />
    : <span className="inline-block w-4 h-[11px] rounded-sm bg-gray-700 shrink-0" />;
}

// One compact ranked row per matchup.
function MatchupRow({ m, rank }: { m: R32Matchup; rank: number }) {
  const h2h = Math.round(m.homeWinProb * 100);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-800/60 bg-gray-900/50 px-3 py-2">
      <span className="w-5 text-center text-[11px] font-bold tabular-nums text-gray-500 shrink-0">{rank}</span>
      <span className="w-9 text-right text-base font-bold tabular-nums text-fifa-gold shrink-0">{pct(m.prob)}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="flex items-center gap-1.5 min-w-0 flex-1">
            <MiniFlag code={m.home} /><span className="truncate font-semibold text-gray-100">{m.homeName}</span>
          </span>
          <span className="text-gray-600 text-xs shrink-0">v</span>
          <span className="flex items-center gap-1.5 min-w-0 flex-1">
            <MiniFlag code={m.away} /><span className="truncate font-semibold text-gray-100">{m.awayName}</span>
          </span>
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5 truncate">advance {h2h} / {100 - h2h}</div>
      </div>
    </div>
  );
}

// One row per title contender: team + its 2 most likely R32 opponents.
function ContenderRow({ c }: { c: R32Contender }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-gray-800/60 bg-gray-900/50 px-3 py-2">
      <MiniFlag code={c.code} />
      <span className="text-sm font-semibold text-gray-100 w-24 shrink-0 truncate">{c.name}</span>
      <span className="text-gray-600 text-xs shrink-0">vs</span>
      <span className="flex-1 min-w-0 text-xs truncate">
        {c.opponents.length === 0 && <span className="text-gray-500">—</span>}
        {c.opponents.map((o, i) => (
          <span key={o.code}>
            {i > 0 && <span className="text-gray-600"> · </span>}
            <span className="text-gray-300 font-medium">{o.name}</span>{' '}
            <span className="text-fifa-gold tabular-nums">{pct(o.prob)}</span>
          </span>
        ))}
      </span>
    </div>
  );
}

/**
 * Round-of-32 projections — a compact part of the Forecast tab. Two sections:
 *   1. global most-likely ties (how often each exact pairing forms), and
 *   2. each top title contender's most likely R32 opponent.
 * Both refresh after every match with the rest of the forecast.
 */
export default function R32Projection() {
  const fetcher = useCallback(() => fetchR32(), []);
  const { data, loading, error } = usePolled(fetcher, 60_000);
  const [showAll, setShowAll] = useState(false);

  if (loading) return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-300">Round of 32 — most likely ties</h3>
      <p className="text-xs text-gray-500">Loading projection…</p>
    </section>
  );
  if (error || !data) return null; // stay quiet inside Forecast if the artifact isn't there yet

  const DEFAULT_COUNT = 6;
  const shown = showAll ? data.matchups : data.matchups.slice(0, DEFAULT_COUNT);

  return (
    <>
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-300">Round of 32 — most likely ties</h3>
          <span className="text-[10px] text-gray-600 shrink-0 text-right">{data.remainingGroupMatches} games to play</span>
        </div>

        <div className="space-y-1.5">
          {shown.map((m, i) => <MatchupRow key={`${m.home}-${m.away}`} m={m} rank={i + 1} />)}
        </div>

        {data.matchups.length > DEFAULT_COUNT && (
          <button
            onClick={() => setShowAll(s => !s)}
            className="w-full py-2 rounded-lg border border-gray-800 text-xs font-semibold text-gray-300 hover:border-gray-600 hover:text-gray-100 transition-colors"
          >
            {showAll ? 'Show fewer' : `Show more (${data.matchups.length - DEFAULT_COUNT})`}
          </button>
        )}

        <p className="text-[10px] leading-relaxed text-gray-500">
          Probability that these two teams meet anywhere in the Round of 32 · advance split from current Elo ·
          from {data.distinctMatchups} possible pairings over {data.simCount.toLocaleString()} sims, updates after every game.
        </p>
      </section>

      {data.contenders && data.contenders.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-300">Top contenders — likely R32 opponent</h3>
          <div className="space-y-1.5">
            {data.contenders.map(c => <ContenderRow key={c.code} c={c} />)}
          </div>
          <p className="text-[10px] leading-relaxed text-gray-500">
            Each favourite’s most likely Round-of-32 opponent, as a % of the times that team reaches the R32.
          </p>
        </section>
      )}
    </>
  );
}
