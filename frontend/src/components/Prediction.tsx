import { useCallback, useState, useMemo } from 'react';
import { usePolled, fetchFixtures, fetchForecast, useESPNLive } from '../api.ts';
import { teamName } from '../utils.ts';
import Flag from './Flag.tsx';
import { simulateLikely, simulateMostLikely, type OneSimResult, type SimGroupRow } from '../simulation.ts';
import type { PredictedMatch, Stage, Match } from '@wc2026/shared';
import type { ESPNLiveMatch } from '../api.ts';

interface DisplayResult {
  matches: PredictedMatch[];
  groups: Record<string, SimGroupRow[]>;
  champion: string;
  seed?: number;
}

function mergeESPN(base: Match[], live: ESPNLiveMatch[]): Match[] {
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
    return {
      ...m,
      status: o.status,
      homeGoals: o.homeScore ?? m.homeGoals,
      awayGoals: o.awayScore ?? m.awayGoals,
    };
  });
}

const ROUND_LABELS: Partial<Record<Stage, string>> = {
  r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarter-finals', sf: 'Semi-finals', final: 'Final',
};
const ROUND_ORDER: Stage[] = ['r32', 'r16', 'qf', 'sf', 'final'];

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({ m }: { m: PredictedMatch }) {
  const isHomeWin = m.winnerId === m.homeId;
  const isAwayWin = m.winnerId === m.awayId;
  return (
    <div className="bg-gray-800/50 rounded border border-gray-700/50 p-2 text-xs">
      <div className={`flex items-center justify-between gap-2 py-0.5 ${isHomeWin ? 'text-gray-50 font-semibold' : 'text-gray-300'}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Flag code={m.homeId} size={16} />
          <span className="truncate">{teamName(m.homeId)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-gray-500 text-[10px] tabular-nums">{m.homeXg.toFixed(1)}</span>
          <span className={`w-4 text-center font-bold tabular-nums ${isHomeWin ? 'text-fifa-gold' : ''}`}>{m.homeGoals}</span>
        </div>
      </div>
      <div className={`flex items-center justify-between gap-2 py-0.5 ${isAwayWin ? 'text-gray-50 font-semibold' : 'text-gray-300'}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Flag code={m.awayId} size={16} />
          <span className="truncate">{teamName(m.awayId)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-gray-500 text-[10px] tabular-nums">{m.awayXg.toFixed(1)}</span>
          <span className={`w-4 text-center font-bold tabular-nums ${isAwayWin ? 'text-fifa-gold' : ''}`}>{m.awayGoals}</span>
        </div>
      </div>
      {m.homeGoals === m.awayGoals && m.winnerId && (
        <div className="text-[10px] text-gray-500 text-center mt-0.5 border-t border-gray-700/30 pt-0.5">
          {teamName(m.winnerId)} on pens
        </div>
      )}
    </div>
  );
}

// ─── Group standings table ────────────────────────────────────────────────────

function GroupTable({ groupId, rows, advancing }: { groupId: string; rows: SimGroupRow[]; advancing: Set<string> }) {
  return (
    <div className="bg-gray-800/40 rounded border border-gray-700/40 overflow-hidden">
      <div className="px-2 py-1 bg-gray-700/40 text-[10px] font-semibold text-gray-300 tracking-wider font-display">
        GROUP {groupId}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 text-[10px]">
            <th className="text-left pl-2 py-0.5 font-normal w-6">#</th>
            <th className="text-left py-0.5 font-normal">Team</th>
            <th className="text-center py-0.5 font-normal w-6">P</th>
            <th className="text-center py-0.5 font-normal w-6">W</th>
            <th className="text-center py-0.5 font-normal w-6">D</th>
            <th className="text-center py-0.5 font-normal w-6">L</th>
            <th className="text-center py-0.5 font-normal w-8">GD</th>
            <th className="text-center py-0.5 font-normal w-6 text-fifa-gold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const auto = i < 2;                          // top two always advance
            const thirdQ = !auto && advancing.has(r.teamId); // best-third qualifier
            const qualified = auto || thirdQ;
            return (
            <tr
              key={r.teamId}
              className={`border-t border-gray-700/30 ${qualified ? 'text-gray-200' : 'text-gray-500'}`}
            >
              <td className="pl-2 py-1 text-gray-500">{i + 1}</td>
              <td className="py-1">
                <div className="flex items-center gap-1">
                  <Flag code={r.teamId} size={14} />
                  <span className={qualified ? 'font-medium' : ''}>{teamName(r.teamId)}</span>
                  {auto && <span className="text-[9px] text-green-500 ml-0.5 font-bold">Q</span>}
                  {thirdQ && <span className="text-[9px] text-amber-400 ml-0.5 font-bold" title="Qualified as a best third-placed team">Q³</span>}
                </div>
              </td>
              <td className="text-center py-1 tabular-nums">{r.w + r.d + r.l}</td>
              <td className="text-center py-1 tabular-nums">{r.w}</td>
              <td className="text-center py-1 tabular-nums">{r.d}</td>
              <td className="text-center py-1 tabular-nums">{r.l}</td>
              <td className="text-center py-1 tabular-nums">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
              <td className={`text-center py-1 tabular-nums font-bold ${qualified ? 'text-fifa-gold' : ''}`}>{r.pts}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 2h10v6a5 5 0 0 1-10 0V2z" />
      <path d="M7 4H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4" />
      <path d="M17 4h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4" />
      <line x1="12" y1="14" x2="12" y2="18" />
      <path d="M9 18h6" />
      <path d="M9 22h6" />
    </svg>
  );
}

function ShuffleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
    </svg>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      className="animate-spin"
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Prediction() {
  const fixturesFetcher   = useCallback(() => fetchFixtures(), []);
  const forecastFetcher   = useCallback(() => fetchForecast(), []);
  const { data: fixtures, loading: loadFix } = usePolled(fixturesFetcher, 300_000);
  const { data: forecast }   = usePolled(forecastFetcher, 30_000);
  const { matches: espnMatches } = useESPNLive(10_000);

  // 'likely' = deterministic favourites' path (computed live); 'random' = one re-rolled sim
  const [mode, setMode] = useState<'likely' | 'random'>('likely');
  const [random, setRandom] = useState<OneSimResult | null>(null);
  const [running, setRunning] = useState(false);

  // Set of "likely" champion codes (pChampion ≥ 5%) — keeps random rolls plausible
  const likelyCodes = useMemo<Set<string>>(() => {
    if (!forecast) return new Set();
    return new Set(forecast.teams.filter(t => t.pChampion >= 0.05).map(t => t.code));
  }, [forecast]);

  const rollDice = useCallback(() => {
    if (!fixtures || likelyCodes.size === 0) return;
    setRunning(true);
    setTimeout(() => {
      const mergedMatches = mergeESPN(fixtures.matches, espnMatches);
      const r = simulateLikely(fixtures.teams, mergedMatches, likelyCodes);
      setRandom(r);
      setMode('random');
      setRunning(false);
    }, 10);
  }, [fixtures, likelyCodes, espnMatches]);

  // Deterministic Most Likely Outcome, recomputed from LIVE-merged matches so it
  // reflects real results immediately (favourites advance, fixed seed = stable).
  const likely = useMemo<OneSimResult | null>(() => {
    if (!fixtures) return null;
    return simulateMostLikely(fixtures.teams, mergeESPN(fixtures.matches, espnMatches));
  }, [fixtures, espnMatches]);

  // The displayed outcome: most-likely by default, random roll on demand.
  const result: DisplayResult | null = (mode === 'random' && random) ? random : likely;

  if (loadFix && !result) return <div className="flex items-center justify-center h-64 text-gray-500"><Spinner size={24} /><span className="ml-3">Loading data…</span></div>;

  const byRound = new Map<Stage, PredictedMatch[]>();
  for (const m of result?.matches ?? []) {
    if (!ROUND_LABELS[m.stage]) continue;
    const arr = byRound.get(m.stage) ?? [];
    arr.push(m);
    byRound.set(m.stage, arr);
  }

  const sortedGroups = Object.entries(result?.groups ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const isRandom = mode === 'random' && random != null;

  // Teams that reached the Round of 32 — i.e. every group winner, runner-up, and
  // the best third-placed qualifiers. Used to badge the advancing teams below.
  const advancing = new Set<string>();
  for (const m of result?.matches ?? []) {
    if (m.stage === 'r32') { advancing.add(m.homeId); advancing.add(m.awayId); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{isRandom ? 'Random Scenario' : 'Most Likely Outcome'}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {isRandom
              ? 'A different but plausible way the tournament could play out.'
              : 'The most likely path, updating live as results come in.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRandom && (
            <button
              onClick={() => setMode('likely')}
              className="px-3 py-2 rounded border border-gray-700 text-gray-300 hover:text-gray-50 hover:border-gray-500 text-sm font-medium transition-colors"
            >
              ← Most likely
            </button>
          )}
          <button
            onClick={rollDice}
            disabled={running || likelyCodes.size === 0}
            className="flex items-center gap-2 px-4 py-2 rounded bg-fifa-blue text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-wait text-sm font-medium transition-colors"
          >
            {running ? <><Spinner /><span>Rolling…</span></> : <><ShuffleIcon className="w-4 h-4" /><span>Roll scenario</span></>}
          </button>
        </div>
      </div>

      {/* Champion banner */}
      {result && (
        <div className="card flex items-center gap-4 border border-fifa-gold/30 bg-fifa-gold/5">
          <TrophyIcon className="w-8 h-8 text-fifa-gold shrink-0" />
          <div>
            <div className="text-xs text-gray-400 mb-0.5">{isRandom ? 'Champion (this scenario)' : 'Predicted champion'}</div>
            <div className="flex items-center gap-2">
              <Flag code={result.champion} size={32} />
              <span className="font-display text-2xl font-bold">{teamName(result.champion)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Group standings */}
      {sortedGroups.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-300">Predicted Group Standings</h3>
            <span className="text-[10px] text-gray-500">
              <span className="text-green-500 font-bold">Q</span> top two ·{' '}
              <span className="text-amber-400 font-bold">Q³</span> best third
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedGroups.map(([gid, rows]) => (
              <GroupTable key={gid} groupId={gid} rows={rows} advancing={advancing} />
            ))}
          </div>
        </div>
      )}

      {/* KO rounds */}
      {result && ROUND_ORDER.filter(r => byRound.has(r)).map(round => (
        <div key={round}>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">{ROUND_LABELS[round]}</h3>
          <div className={`grid gap-2 ${
            round === 'r32' ? 'grid-cols-2 sm:grid-cols-4' :
            round === 'r16' ? 'grid-cols-2 sm:grid-cols-4' :
            round === 'qf'  ? 'grid-cols-2' :
            round === 'sf'  ? 'grid-cols-1 sm:grid-cols-2' :
                               'grid-cols-1 max-w-sm mx-auto'
          }`}>
            {(byRound.get(round) ?? []).map(m => <MatchCard key={m.id} m={m} />)}
          </div>
        </div>
      ))}

      <p className="text-xs text-gray-400 text-center">
        Faint numbers beside each score are expected goals. Knockout draws are
        decided in extra time, then a penalty shootout.
      </p>
    </div>
  );
}
