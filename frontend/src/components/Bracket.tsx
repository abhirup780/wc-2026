import { useCallback } from 'react';
import { usePolled, fetchForecast } from '../api.ts';
import { pct, teamName as getTeamName } from '../utils.ts';
import Flag from './Flag.tsx';

export default function Bracket() {
  const forecastFetcher = useCallback(() => fetchForecast(), []);
  const { data: forecast, loading } = usePolled(forecastFetcher, 60_000);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500">Loading bracket…</div>
  );
  if (!forecast) return (
    <div className="card text-yellow-500 text-sm">Bracket data not yet available.</div>
  );

  const topTeams = [...forecast.teams].sort((a, b) => b.pChampion - a.pChampion).slice(0, 8);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Knockout Bracket</h2>
        <p className="text-xs text-gray-500 mt-1">
          Probabilities from {forecast.simCount.toLocaleString()} simulations.
        </p>
      </div>

      {/* Top 8 contenders */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-gray-300">Top 8 Contenders</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: '380px' }}>
            <thead>
              <tr className="text-[11px] text-gray-600 border-b border-gray-800">
                <th className="text-left py-2 pl-4 pr-3 font-normal">Team</th>
                <th className="text-center py-2 px-2 font-normal">QF</th>
                <th className="text-center py-2 px-2 font-normal">SF</th>
                <th className="text-center py-2 px-2 font-normal">Final</th>
                <th className="text-center py-2 px-3 font-normal text-fifa-gold">🏆</th>
              </tr>
            </thead>
            <tbody>
              {topTeams.map((t, i) => {
                const stages = [
                  { p: t.pReachQF },
                  { p: t.pReachSF },
                  { p: t.pReachFinal },
                  { p: t.pChampion, gold: true },
                ];
                return (
                  <tr key={t.teamId} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                    <td className="py-2.5 pl-4 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-700 text-xs w-3 shrink-0 tabular-nums">{i + 1}</span>
                        <Flag code={t.code} size={22} />
                        <span className="text-sm font-medium truncate max-w-[100px] sm:max-w-none">{t.name}</span>
                      </div>
                    </td>
                    {stages.map((s, si) => (
                      <td key={si} className="py-2.5 px-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-16 sm:w-20 bg-gray-800 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${s.gold ? 'bg-fifa-gold' : 'bg-fifa-blue'}`}
                              style={{ width: `${Math.round(s.p * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-gray-400">{pct(s.p, 0)}</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* All teams table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-gray-300">All Teams – Advancement Probabilities</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: '480px' }}>
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2.5 pl-4 pr-2 font-normal">Team</th>
                <th className="text-center py-2.5 px-2 font-normal">Adv.</th>
                <th className="text-center py-2.5 px-2 font-normal">R16</th>
                <th className="text-center py-2.5 px-2 font-normal">QF</th>
                <th className="text-center py-2.5 px-2 font-normal">SF</th>
                <th className="text-center py-2.5 px-2 font-normal">Final</th>
                <th className="text-center py-2.5 px-3 font-normal text-fifa-gold">🏆</th>
                <th className="text-center py-2.5 px-3 font-normal text-gray-600">vs pre</th>
              </tr>
            </thead>
            <tbody>
              {[...forecast.teams].sort((a, b) => b.pChampion - a.pChampion).map(t => {
                const delta = t.pChampionInitial != null ? t.pChampion - t.pChampionInitial : null;
                const trendLabel = delta == null ? '' :
                  Math.abs(delta) < 0.002 ? '—' :
                  delta > 0 ? `↑+${Math.round(delta * 100)}%` : `↓${Math.round(delta * 100)}%`;
                const trendColor = delta == null || Math.abs(delta) < 0.002 ? 'text-gray-600'
                  : delta > 0 ? 'text-green-400' : 'text-red-400';
                return (
                  <tr key={t.teamId} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 pl-4 pr-2">
                      <div className="flex items-center gap-1.5">
                        <Flag code={t.code} size={16} />
                        <span className="font-medium truncate max-w-[80px]">{t.name}</span>
                      </div>
                    </td>
                    {[t.pAdvanceGroup, t.pReachR16, t.pReachQF, t.pReachSF, t.pReachFinal, t.pChampion].map((p, i) => (
                      <td key={i} className="py-2 px-2 text-center tabular-nums">
                        <span className={p > 0.5 ? 'text-green-400' : p > 0.2 ? 'text-yellow-400' : p > 0 ? 'text-gray-300' : 'text-gray-700'}>
                          {p <= 0 ? '0%' : Math.round(p * 100) === 0 ? '<1%' : pct(p, 0)}
                        </span>
                      </td>
                    ))}
                    <td className={`py-2 px-3 text-center tabular-nums font-medium ${trendColor}`}>
                      {trendLabel}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="sm:hidden text-center py-2 text-[10px] text-gray-700 border-t border-gray-800">
          ← scroll for more →
        </div>
      </div>

      <p className="text-xs text-gray-600 text-center">
        Bracket slot assignments are provisional — verify R32 seeding against FIFA's official bracket.
      </p>
    </div>
  );
}
