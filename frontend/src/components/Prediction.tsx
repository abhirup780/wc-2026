import { useCallback, useState, useEffect, useMemo } from 'react';
import { usePolled, fetchFixtures, fetchForecast, useESPNLive } from '../api.ts';
import { teamName } from '../utils.ts';
import Flag from './Flag.tsx';
import { simulateLikely, type OneSimResult, type SimGroupRow } from '../simulation.ts';
import type { PredictedMatch, Stage, Match } from '@wc2026/shared';
import type { ESPNLiveMatch } from '../api.ts';

function mergeESPN(base: Match[], live: ESPNLiveMatch[]): Match[] {
  const byKey = new Map(live.map(m => [`${m.homeCode}-${m.awayCode}`, m]));
  return base.map(m => {
    const o = byKey.get(`${m.homeId}-${m.awayId}`);
    if (!o) return m;
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
      <div className={`flex items-center justify-between gap-2 py-0.5 ${isHomeWin ? 'text-white font-semibold' : 'text-gray-400'}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Flag code={m.homeId} size={16} />
          <span className="truncate">{teamName(m.homeId)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-gray-600 text-[10px]">{m.homeXg.toFixed(1)}</span>
          <span className={`w-4 text-center font-bold tabular-nums ${isHomeWin ? 'text-fifa-gold' : ''}`}>{m.homeGoals}</span>
        </div>
      </div>
      <div className={`flex items-center justify-between gap-2 py-0.5 ${isAwayWin ? 'text-white font-semibold' : 'text-gray-400'}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Flag code={m.awayId} size={16} />
          <span className="truncate">{teamName(m.awayId)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-gray-600 text-[10px]">{m.awayXg.toFixed(1)}</span>
          <span className={`w-4 text-center font-bold tabular-nums ${isAwayWin ? 'text-fifa-gold' : ''}`}>{m.awayGoals}</span>
        </div>
      </div>
      {m.homeGoals === m.awayGoals && m.winnerId && (
        <div className="text-[10px] text-gray-600 text-center mt-0.5 border-t border-gray-700/30 pt-0.5">
          {teamName(m.winnerId)} on pens
        </div>
      )}
    </div>
  );
}

// ─── Group standings table ────────────────────────────────────────────────────

function GroupTable({ groupId, rows }: { groupId: string; rows: SimGroupRow[] }) {
  return (
    <div className="bg-gray-800/40 rounded border border-gray-700/40 overflow-hidden">
      <div className="px-2 py-1 bg-gray-700/40 text-[10px] font-semibold text-gray-400 tracking-wider">
        GROUP {groupId}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-600 text-[10px]">
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
          {rows.map((r, i) => (
            <tr
              key={r.teamId}
              className={`border-t border-gray-700/30 ${i < 2 ? 'text-gray-200' : 'text-gray-500'}`}
            >
              <td className="pl-2 py-1 text-gray-600">{i + 1}</td>
              <td className="py-1">
                <div className="flex items-center gap-1">
                  <Flag code={r.teamId} size={14} />
                  <span className={i < 2 ? 'font-medium' : ''}>{teamName(r.teamId)}</span>
                  {i < 2 && <span className="text-[9px] text-green-500 ml-0.5">✓</span>}
                </div>
              </td>
              <td className="text-center py-1 tabular-nums">{r.w + r.d + r.l}</td>
              <td className="text-center py-1 tabular-nums">{r.w}</td>
              <td className="text-center py-1 tabular-nums">{r.d}</td>
              <td className="text-center py-1 tabular-nums">{r.l}</td>
              <td className="text-center py-1 tabular-nums">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
              <td className={`text-center py-1 tabular-nums font-bold ${i < 2 ? 'text-fifa-gold' : ''}`}>{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
  const fixturesFetcher  = useCallback(() => fetchFixtures(), []);
  const forecastFetcher  = useCallback(() => fetchForecast(), []);
  const { data: fixtures, loading: loadFix } = usePolled(fixturesFetcher, 300_000);
  const { data: forecast, loading: loadFc  } = usePolled(forecastFetcher, 60_000);
  const { matches: espnMatches } = useESPNLive(30_000);

  const [result, setResult] = useState<OneSimResult | null>(null);
  const [running, setRunning] = useState(false);

  // Build set of "likely" champion codes: teams with pChampion > 2% in the forecast
  const likelyCodes = useMemo<Set<string>>(() => {
    if (!forecast) return new Set();
    return new Set(forecast.teams.filter(t => t.pChampion >= 0.05).map(t => t.code));
  }, [forecast]);

  const runSim = useCallback(() => {
    if (!fixtures || likelyCodes.size === 0) return;
    setRunning(true);
    setTimeout(() => {
      const mergedMatches = mergeESPN(fixtures.matches, espnMatches);
      const r = simulateLikely(fixtures.teams, mergedMatches, likelyCodes);
      setResult(r);
      setRunning(false);
    }, 10);
  }, [fixtures, likelyCodes, espnMatches]);

  useEffect(() => { if (fixtures && likelyCodes.size > 0 && !result) runSim(); }, [fixtures, likelyCodes, result, runSim]);

  const loading = loadFix || loadFc;
  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500"><Spinner size={24} /><span className="ml-3">Loading data…</span></div>;

  const byRound = new Map<Stage, PredictedMatch[]>();
  for (const m of result?.matches ?? []) {
    if (!ROUND_LABELS[m.stage]) continue;
    const arr = byRound.get(m.stage) ?? [];
    arr.push(m);
    byRound.set(m.stage, arr);
  }

  const sortedGroups = Object.entries(result?.groups ?? {}).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">One Likely Outcome</h2>
          <p className="text-xs text-gray-500 mt-1">
            One Monte Carlo run filtered to show a probable champion (top contenders only).
            Each click gives a different valid scenario.
            {result && <span className="ml-2 text-gray-600">seed {result.seed}</span>}
          </p>
        </div>
        <button
          onClick={runSim}
          disabled={running || likelyCodes.size === 0}
          className="flex items-center gap-2 px-4 py-2 rounded bg-fifa-blue hover:bg-blue-600 disabled:opacity-50 disabled:cursor-wait text-sm font-medium transition-colors"
        >
          {running ? <><Spinner /><span>Running…</span></> : <><span>🎲</span><span>New Prediction</span></>}
        </button>
      </div>

      {/* Champion banner */}
      {result && (
        <div className="card flex items-center gap-4 border border-fifa-gold/30 bg-fifa-gold/5">
          <span className="text-3xl">🏆</span>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Predicted champion</div>
            <div className="flex items-center gap-2">
              <Flag code={result.champion} size={32} />
              <span className="text-2xl font-bold">{teamName(result.champion)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Group standings */}
      {sortedGroups.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Predicted Group Standings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedGroups.map(([gid, rows]) => (
              <GroupTable key={gid} groupId={gid} rows={rows} />
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

      <p className="text-xs text-gray-600 text-center">
        Numbers beside scores = expected goals (xG). KO draws go to simulated extra
        time then penalties (Elo-weighted).
      </p>
    </div>
  );
}
