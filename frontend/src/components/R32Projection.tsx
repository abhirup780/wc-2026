import { useCallback, useMemo, useState } from 'react';
import { usePolled, fetchR32 } from '../api.ts';
import { FIFA_NAMES } from '../utils.ts';
import Flag from './Flag.tsx';
import type { R32MatchupProjection } from '@wc2026/shared';

const isTeamCode = (code: string) => code in FIFA_NAMES;
const pct = (p: number) => `${Math.round(p * 100)}%`;

// Small flag, or a neutral badge for unresolved third-place slots.
function MiniFlag({ code }: { code: string }) {
  return isTeamCode(code)
    ? <Flag code={code} size={16} />
    : <span className="inline-block w-4 h-[11px] rounded-sm bg-gray-700 shrink-0" />;
}

// One compact ranked row per tie.
function MatchupRow({ m, rank }: { m: R32MatchupProjection; rank: number }) {
  const h2h = Math.round(m.homeWinProb * 100);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-800/60 bg-gray-900/50 px-3 py-2">
      <span className="w-4 text-center text-[11px] font-bold tabular-nums text-gray-500 shrink-0">{rank}</span>
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
        <div className="text-[10px] text-gray-500 mt-0.5 truncate">
          {m.slot1} v {m.slot2} · advance {h2h}/{100 - h2h}
        </div>
      </div>
    </div>
  );
}

/**
 * Round-of-32 "most likely ties" — a compact, embeddable section of the
 * Forecast tab. Top 6 ties by default (high→low), the rest behind "Show more".
 */
export default function R32Projection() {
  const fetcher = useCallback(() => fetchR32(), []);
  const { data, loading, error } = usePolled(fetcher, 120_000);
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(
    () => (data ? [...data.matchups].sort((a, b) => b.prob - a.prob) : []),
    [data],
  );

  if (loading) return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-300">Round of 32 — most likely ties</h3>
      <p className="text-xs text-gray-500">Loading projection…</p>
    </section>
  );
  if (error || !data) return null; // stay quiet inside Forecast if the artifact isn't there yet

  const DEFAULT_COUNT = 6;
  const shown = showAll ? sorted : sorted.slice(0, DEFAULT_COUNT);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-300">Round of 32 — most likely ties</h3>
        <span className="text-[10px] text-gray-600 shrink-0">{data.remainingGroupMatches} games to play</span>
      </div>

      <div className="space-y-1.5">
        {shown.map((m, i) => <MatchupRow key={m.num} m={m} rank={i + 1} />)}
      </div>

      {sorted.length > DEFAULT_COUNT && (
        <button
          onClick={() => setShowAll(s => !s)}
          className="w-full py-2 rounded-lg border border-gray-800 text-xs font-semibold text-gray-300 hover:border-gray-600 hover:text-gray-100 transition-colors"
        >
          {showAll ? 'Show fewer' : `Show more (${sorted.length - DEFAULT_COUNT})`}
        </button>
      )}

      <p className="text-[10px] leading-relaxed text-gray-500">
        Probability of each exact pairing forming · advance split from current Elo · {data.simCount.toLocaleString()} sims, updates after every game.
      </p>
    </section>
  );
}
