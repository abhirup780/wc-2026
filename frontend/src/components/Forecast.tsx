import { useCallback, useState } from 'react';
import { usePolled, fetchForecast } from '../api.ts';
import { pct } from '../utils.ts';
import Flag from './Flag.tsx';
import type { TeamForecast } from '@wc2026/shared';

type SortKey = keyof Pick<TeamForecast, 'pChampion' | 'pReachFinal' | 'pReachSF' | 'pReachQF' | 'pAdvanceGroup' | 'pWinGroup'>;

const COLUMNS: { key: SortKey; label: string; short: string }[] = [
  { key: 'pWinGroup', label: 'Win Group', short: 'W.Grp' },
  { key: 'pAdvanceGroup', label: 'Advance', short: 'Adv.' },
  { key: 'pReachQF', label: 'Quarter-finals', short: 'QF' },
  { key: 'pReachSF', label: 'Semi-finals', short: 'SF' },
  { key: 'pReachFinal', label: 'Final', short: 'Fin.' },
  { key: 'pChampion', label: 'Champion', short: 'Champ.' },
];

function fmtProb(v: number): string {
  if (v <= 0) return '—';
  const r = Math.round(v * 100);
  return r === 0 ? '<1%' : `${r}%`;
}

function ProbBar({ value, highlight }: { value: number; highlight?: boolean }) {
  const pct100 = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-800 rounded-full h-1.5 hidden sm:block">
        <div
          className={`h-1.5 rounded-full ${highlight ? 'bg-fifa-gold' : 'bg-fifa-blue'}`}
          style={{ width: `${pct100}%` }}
        />
      </div>
      <span className={`tabular-nums text-sm w-12 text-right ${value <= 0 ? 'text-gray-600' : ''}`}>
        {fmtProb(value)}
      </span>
    </div>
  );
}

export default function Forecast() {
  const [sortKey, setSortKey] = useState<SortKey>('pChampion');
  const [filterGroup, setFilterGroup] = useState<string>('');

  const fetcher = useCallback(() => fetchForecast(), []);
  const { data: forecast, loading, error, lastUpdated } = usePolled(fetcher, 60_000);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Running forecast…</div>;
  }

  if (error || !forecast) {
    return (
      <div className="card text-red-400 text-sm">
        Forecast unavailable: {error}. Run{' '}
        <code className="bg-gray-800 px-1 rounded">npm run simulate:mock</code> first.
      </div>
    );
  }

  const groups = [...new Set(forecast.teams.map(t => t.groupId))].sort();

  const filtered = filterGroup
    ? forecast.teams.filter(t => t.groupId === filterGroup)
    : forecast.teams;

  const sorted = [...filtered].sort((a, b) => b[sortKey] - a[sortKey]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Championship Forecast</h2>
          <p className="text-xs text-gray-500">
            Based on {forecast.simCount.toLocaleString()} simulations ·{' '}
            {forecast.modelConfig.type} model · seed {forecast.seed}
            {lastUpdated ? ` · refreshed ${lastUpdated.toLocaleTimeString()}` : ''}
          </p>
        </div>

        {/* Group filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Group:</span>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setFilterGroup('')}
              className={`text-xs px-2 py-0.5 rounded border ${!filterGroup ? 'border-fifa-gold text-fifa-gold' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
            >
              All
            </button>
            {groups.map(g => (
              <button
                key={g}
                onClick={() => setFilterGroup(g === filterGroup ? '' : g)}
                className={`text-xs px-2 py-0.5 rounded border ${filterGroup === g ? 'border-fifa-gold text-fifa-gold' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-800">
              <th className="text-left pb-3 font-normal pr-4">Team</th>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className={`text-right pb-3 font-normal cursor-pointer select-none px-2 hover:text-gray-200 ${sortKey === col.key ? 'text-fifa-gold' : ''}`}
                  onClick={() => setSortKey(col.key)}
                >
                  <span className="hidden sm:inline">{col.label}</span>
                  <span className="sm:hidden">{col.short}</span>
                  {sortKey === col.key && <span className="ml-1">↓</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr key={t.teamId} className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors">
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 text-xs w-5 tabular-nums">{i + 1}</span>
                    <Flag code={t.code} size={22} />
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-gray-500">Grp {t.groupId}</div>
                    </div>
                  </div>
                </td>
                {COLUMNS.map(col => (
                  <td key={col.key} className="py-2 px-2">
                    <ProbBar value={t[col.key]} highlight={col.key === 'pChampion'} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Champion bar chart */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-3 text-gray-300">Champion probability</h3>
        <div className="space-y-1.5">
          {sorted
            .filter(t => t.pChampion > 0.001)
            .slice(0, 16)
            .map(t => (
              <div key={t.teamId} className="flex items-center gap-3">
                <Flag code={t.code} size={22} />
                <span className="text-xs text-gray-400 w-8">{t.code}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-3 relative">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-fifa-blue to-fifa-gold transition-all duration-500"
                    style={{ width: `${Math.min(100, t.pChampion * 200)}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums w-10 text-right text-gray-300">
                  {pct(t.pChampion)}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
