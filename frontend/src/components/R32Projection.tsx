import { useCallback, useMemo, useState } from 'react';
import { usePolled, fetchR32 } from '../api.ts';
import { FIFA_NAMES } from '../utils.ts';
import Flag from './Flag.tsx';
import type { R32MatchupProjection } from '@wc2026/shared';

const isTeamCode = (code: string) => code in FIFA_NAMES;
const pct = (p: number) => `${Math.round(p * 100)}%`;

// Flag, or a neutral badge for unresolved third-place slots.
function Side({ code, name, align = 'left' }: { code: string; name: string; align?: 'left' | 'right' }) {
  const flag = isTeamCode(code)
    ? <Flag code={code} size={22} />
    : <span className="inline-block w-[22px] h-[15px] rounded bg-gray-800" />;
  return (
    <span className={`flex items-center gap-2 min-w-0 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      {flag}
      <span className="truncate text-sm font-semibold text-gray-100">{name}</span>
    </span>
  );
}

function MatchupCard({ m, rank }: { m: R32MatchupProjection; rank: number }) {
  const homePctH2H = Math.round(m.homeWinProb * 100);

  return (
    <div className="card">
      {/* header — rank + slot pairing + matchup probability */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-gray-300 text-xs font-bold tabular-nums shrink-0">
            {rank}
          </span>
          <span className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold truncate">
            R32 · {m.slot1} v {m.slot2}
          </span>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-bold tabular-nums text-fifa-gold leading-none">{pct(m.prob)}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">likely tie</div>
        </div>
      </div>

      {/* matchup-probability bar */}
      <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden mb-3">
        <div className="h-full bg-fifa-gold/80 rounded-full" style={{ width: `${Math.min(100, m.prob * 100)}%` }} />
      </div>

      {/* the two teams + Elo head-to-head split */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0"><Side code={m.home} name={m.homeName} /></div>
        <div className="shrink-0 text-center px-1">
          <div className="text-[11px] font-bold tabular-nums text-gray-300">
            {homePctH2H}<span className="text-gray-600"> / </span>{100 - homePctH2H}
          </div>
          <div className="text-[9px] text-gray-500 uppercase tracking-wide">advance</div>
        </div>
        <div className="flex-1 min-w-0 flex justify-end"><Side code={m.away} name={m.awayName} align="right" /></div>
      </div>

      {/* head-to-head bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden mt-2 bg-gray-800">
        <div className="bg-green-500/70" style={{ width: `${homePctH2H}%` }} />
        <div className="bg-blue-500/70" style={{ width: `${100 - homePctH2H}%` }} />
      </div>

      {/* marginal slot probabilities */}
      <div className="mt-2.5 pt-2.5 hairline-t flex items-center justify-between text-[10px] text-gray-500">
        <span>reaches {m.slot1} · {pct(m.slot1Prob)}</span>
        <span>reaches {m.slot2} · {pct(m.slot2Prob)}</span>
      </div>
    </div>
  );
}

/**
 * Round-of-32 "most likely ties" — an embeddable section of the Forecast tab.
 * Lists projected R32 matchups high→low: every tie at ≥50%, but always at least
 * the top 10 (expandable to all 16).
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
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300">Round of 32 — most likely ties</h3>
      <p className="text-xs text-gray-500">Loading projection…</p>
    </section>
  );
  if (error || !data) return null; // stay quiet inside Forecast if the artifact isn't there yet

  // Show every matchup at ≥50%, but always at least the top 10.
  const focusCount = Math.max(10, sorted.filter(m => m.prob >= 0.5).length);
  const shown = showAll ? sorted : sorted.slice(0, focusCount);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-300">Round of 32 — most likely ties</h3>
        <span className="text-[10px] text-gray-600 text-right">
          {data.simCount.toLocaleString()} sims · {data.remainingGroupMatches} to play
        </span>
      </div>
      <p className="text-[11px] text-gray-500 -mt-1.5">
        Most probable knockout pairings from the current standings — updates after every game.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {shown.map((m, i) => <MatchupCard key={m.num} m={m} rank={i + 1} />)}
      </div>

      {sorted.length > focusCount && (
        <button
          onClick={() => setShowAll(s => !s)}
          className="w-full py-2.5 rounded-lg border border-gray-800 text-sm font-semibold text-gray-300 hover:border-gray-600 hover:text-gray-100 transition-colors"
        >
          {showAll ? 'Show fewer' : `Show all ${sorted.length} ties`}
        </button>
      )}

      <p className="text-[11px] leading-relaxed text-gray-500">
        “Likely tie” is the probability of that exact pairing forming; a team reaches its bracket slot more often
        than the tie itself occurs (its opponent varies). Head-to-head “advance” split is from current Elo; who
        fills each slot is market-blended from the remaining group games.
      </p>
    </section>
  );
}
