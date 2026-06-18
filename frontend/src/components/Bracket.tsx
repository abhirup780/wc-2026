import { useCallback } from 'react';
import { usePolled, fetchForecast, fetchFixtures } from '../api.ts';
import { pct, teamName as getTeamName } from '../utils.ts';
import Flag from './Flag.tsx';
import type { TeamForecast, Fixtures } from '@wc2026/shared';

interface BracketSlotProps {
  teamId: string | null;
  teamName?: string;
  probability?: number;
  isWinner?: boolean;
}

function BracketSlot({ teamId, teamName, probability, isWinner }: BracketSlotProps) {
  if (!teamId) {
    return (
      <div className="h-10 flex items-center px-3 rounded bg-gray-800/40 border border-gray-700/40 text-gray-600 text-xs">
        TBD
      </div>
    );
  }
  return (
    <div
      className={`h-10 flex items-center justify-between px-3 rounded border text-sm transition-colors ${
        isWinner
          ? 'bg-fifa-gold/10 border-fifa-gold text-white'
          : 'bg-gray-800/60 border-gray-700 text-gray-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <Flag code={teamId} size={20} />
        <span className="font-medium">{getTeamName(teamId)}</span>
      </div>
      {probability != null && probability > 0 && (
        <span className="text-xs text-gray-500 tabular-nums">{pct(probability, 0)}</span>
      )}
    </div>
  );
}

function BracketMatch({
  matchId,
  slot1,
  slot2,
  label,
}: {
  matchId: string;
  slot1: string | null;
  slot2: string | null;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-xs text-gray-600 mb-1 text-center">{label}</div>
      <BracketSlot teamId={slot1} />
      <BracketSlot teamId={slot2} />
    </div>
  );
}

export default function Bracket() {
  const forecastFetcher = useCallback(() => fetchForecast(), []);
  const fixturesFetcher = useCallback(() => fetchFixtures(), []);

  const { data: forecast, loading } = usePolled(forecastFetcher, 60_000);
  const { data: fixtures } = usePolled(fixturesFetcher, 300_000);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading bracket…</div>;
  }

  if (!forecast) {
    return (
      <div className="card text-yellow-500 text-sm">
        Bracket data not yet available. Run{' '}
        <code className="bg-gray-800 px-1 rounded">npm run simulate:mock</code> to generate it.
      </div>
    );
  }

  // Sort teams by champion probability for display
  const topTeams = [...forecast.teams]
    .sort((a, b) => b.pChampion - a.pChampion)
    .slice(0, 8);

  const probMap = new Map(forecast.teams.map(t => [t.teamId, t]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Knockout Bracket</h2>
        <p className="text-xs text-gray-500 mt-1">
          Percentages show probability of advancing from each round based on {forecast.simCount.toLocaleString()} simulations.
          Bracket slots are confirmed as matches are played.
        </p>
      </div>

      {/* Simplified bracket view – top 8 by championship probability */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Top 8 Contenders by Championship Probability</h3>
        <div className="space-y-2">
          {topTeams.map((t, i) => {
            const stages = [
              { label: 'QF', p: t.pReachQF },
              { label: 'SF', p: t.pReachSF },
              { label: 'F', p: t.pReachFinal },
              { label: '🏆', p: t.pChampion },
            ];
            return (
              <div key={t.teamId} className="flex items-center gap-3">
                <span className="text-gray-600 text-xs w-4">{i + 1}</span>
                <Flag code={t.code} size={24} />
                <span className="text-sm font-medium">{t.name}</span>
                {stages.map(s => (
                  <div key={s.label} className="flex-1">
                    <div className="text-xs text-gray-500 text-center mb-0.5">{s.label}</div>
                    <div className="bg-gray-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${s.label === '🏆' ? 'bg-fifa-gold' : 'bg-fifa-blue'}`}
                        style={{ width: `${Math.round(s.p * 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 text-center mt-0.5 tabular-nums">
                      {pct(s.p, 0)}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* All advancing probabilities */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">All Teams – Advancement Probabilities</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-2 font-normal">Team</th>
                <th className="text-center pb-2 font-normal">Advance</th>
                <th className="text-center pb-2 font-normal">R16</th>
                <th className="text-center pb-2 font-normal">QF</th>
                <th className="text-center pb-2 font-normal">SF</th>
                <th className="text-center pb-2 font-normal">Final</th>
                <th className="text-center pb-2 font-normal text-fifa-gold">🏆</th>
                <th className="text-center pb-2 font-normal text-gray-600 text-xs">vs pre-tourn.</th>
              </tr>
            </thead>
            <tbody>
              {[...forecast.teams]
                .sort((a, b) => b.pChampion - a.pChampion)
                .map(t => {
                  const delta = t.pChampionInitial != null
                    ? t.pChampion - t.pChampionInitial
                    : null;
                  const trendLabel = delta == null ? '' :
                    Math.abs(delta) < 0.002 ? '—' :
                    delta > 0
                      ? `↑ +${Math.round(delta * 100)}%`
                      : `↓ ${Math.round(delta * 100)}%`;
                  const trendColor = delta == null || Math.abs(delta) < 0.002
                    ? 'text-gray-600'
                    : delta > 0 ? 'text-green-400' : 'text-red-400';
                  return (
                  <tr key={t.teamId} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-1.5">
                      <div className="flex items-center gap-1.5">
                        <Flag code={t.code} size={18} />
                        <span className="font-medium">{t.name}</span>
                        <span className="text-gray-600">Grp {t.groupId}</span>
                      </div>
                    </td>
                    {[t.pAdvanceGroup, t.pReachR16, t.pReachQF, t.pReachSF, t.pReachFinal, t.pChampion].map((p, i) => (
                      <td key={i} className="text-center py-1.5 tabular-nums">
                        <span className={p > 0.5 ? 'text-green-400' : p > 0.2 ? 'text-yellow-400' : p > 0 ? 'text-gray-300' : 'text-gray-700'}>
                          {p <= 0 ? '0%' : Math.round(p * 100) === 0 ? '<1%' : pct(p, 0)}
                        </span>
                      </td>
                    ))}
                    <td className={`text-center py-1.5 tabular-nums text-xs font-medium ${trendColor}`}>
                      {trendLabel}
                    </td>
                  </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-gray-600 text-center">
        Bracket slot assignments are provisional — verify R32 seeding against FIFA's official bracket.
      </div>
    </div>
  );
}
