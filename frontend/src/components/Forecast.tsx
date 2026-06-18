import { useCallback, useState } from 'react';
import { usePolled, fetchForecast } from '../api.ts';
import { pct } from '../utils.ts';
import Flag from './Flag.tsx';
import type { TeamForecast } from '@wc2026/shared';

type SortKey = keyof Pick<TeamForecast, 'pChampion' | 'pReachFinal' | 'pReachSF' | 'pReachQF' | 'pReachR16' | 'pAdvanceGroup' | 'pWinGroup'>;

const COLUMNS: { key: SortKey; label: string; short: string }[] = [
  { key: 'pWinGroup',    label: 'Win Group',     short: 'W.Grp' },
  { key: 'pAdvanceGroup',label: 'Advance',        short: 'Adv.' },
  { key: 'pReachR16',    label: 'Round of 16',    short: 'R16'   },
  { key: 'pReachQF',     label: 'Quarter-finals', short: 'QF'   },
  { key: 'pReachSF',     label: 'Semi-finals',    short: 'SF'   },
  { key: 'pReachFinal',  label: 'Final',          short: 'Fin.' },
  { key: 'pChampion',    label: 'Champion',       short: '🏆'   },
];

function fmtProb(v: number): string {
  if (v <= 0) return '—';
  const r = Math.round(v * 100);
  return r === 0 ? '<1%' : `${r}%`;
}

export default function Forecast() {
  const [sortKey, setSortKey] = useState<SortKey>('pChampion');
  const [filterGroup, setFilterGroup] = useState<string>('');

  const fetcher = useCallback(() => fetchForecast(), []);
  const { data: forecast, loading, error, lastUpdated } = usePolled(fetcher, 60_000);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500">Running forecast…</div>
  );
  if (error || !forecast) return (
    <div className="card text-red-400 text-sm">Forecast unavailable: {error}</div>
  );

  const groups = [...new Set(forecast.teams.map(t => t.groupId))].sort();
  const filtered = filterGroup ? forecast.teams.filter(t => t.groupId === filterGroup) : forecast.teams;
  const sorted = [...filtered].sort((a, b) => b[sortKey] - a[sortKey]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Championship Forecast</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {forecast.simCount.toLocaleString()} simulations · {forecast.modelConfig.type} model
          {lastUpdated ? ` · ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
        </p>
      </div>

      {/* Champion probability bar chart — mobile-first, always visible */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-3 text-gray-300">Champion probability</h3>
        <div className="space-y-2">
          {[...forecast.teams]
            .sort((a, b) => b.pChampion - a.pChampion)
            .filter(t => t.pChampion > 0.001)
            .slice(0, 16)
            .map(t => (
              <div key={t.teamId} className="flex items-center gap-2">
                <Flag code={t.code} size={20} />
                <span className="text-xs text-gray-400 w-7 shrink-0 tabular-nums">{t.code}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-2.5 relative">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-fifa-blue to-fifa-gold transition-all duration-500"
                    style={{ width: `${Math.min(100, t.pChampion * 200)}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums w-9 text-right text-gray-300 shrink-0">
                  {pct(t.pChampion)}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Group filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 shrink-0">Group:</span>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFilterGroup('')}
            className={`text-xs px-2 py-1 rounded border ${!filterGroup ? 'border-fifa-gold text-fifa-gold' : 'border-gray-700 text-gray-400'}`}
          >
            All
          </button>
          {groups.map(g => (
            <button
              key={g}
              onClick={() => setFilterGroup(g === filterGroup ? '' : g)}
              className={`text-xs px-2 py-1 rounded border ${filterGroup === g ? 'border-fifa-gold text-fifa-gold' : 'border-gray-700 text-gray-400'}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Probability table — horizontally scrollable on mobile */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '560px' }}>
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left py-3 pl-4 pr-3 font-normal sticky left-0 bg-gray-900">Team</th>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className={`text-right py-3 px-3 font-normal cursor-pointer select-none hover:text-gray-200 whitespace-nowrap ${sortKey === col.key ? 'text-fifa-gold' : ''}`}
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
                  <td className="py-2 pl-4 pr-3 sticky left-0 bg-gray-900">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 text-xs w-4 tabular-nums shrink-0">{i + 1}</span>
                      <Flag code={t.code} size={20} />
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{t.name}</div>
                        <div className="text-xs text-gray-600">Grp {t.groupId}</div>
                      </div>
                    </div>
                  </td>
                  {COLUMNS.map(col => (
                    <td key={col.key} className="py-2 px-3 text-right tabular-nums text-sm">
                      <span className={
                        col.key === 'pChampion'
                          ? 'font-semibold text-gray-200'
                          : t[col.key] > 0.5 ? 'text-green-400'
                          : t[col.key] > 0.2 ? 'text-yellow-400'
                          : t[col.key] > 0  ? 'text-gray-400'
                          : 'text-gray-700'
                      }>
                        {fmtProb(t[col.key])}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sm:hidden text-center py-2 text-[10px] text-gray-700 border-t border-gray-800">
          ← scroll for more →
        </div>
      </div>
    </div>
  );
}
