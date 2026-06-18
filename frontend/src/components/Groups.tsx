import { useCallback } from 'react';
import { usePolled, fetchStandings, fetchFixtures } from '../api.ts';
import { teamName } from '../utils.ts';
import Flag from './Flag.tsx';
import type { GroupStanding, Fixtures } from '@wc2026/shared';

function StandingsTable({ groupId, standings }: { groupId: string; standings: GroupStanding[] }) {
  const sorted = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });

  return (
    <div className="card">
      <h3 className="text-sm font-bold text-fifa-gold mb-3 tracking-wider">GROUP {groupId}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs border-b border-gray-800">
            <th className="text-left pb-2 font-normal w-6">#</th>
            <th className="text-left pb-2 font-normal">Team</th>
            <th className="text-center pb-2 font-normal w-8">P</th>
            <th className="text-center pb-2 font-normal w-8">W</th>
            <th className="text-center pb-2 font-normal w-8">D</th>
            <th className="text-center pb-2 font-normal w-8">L</th>
            <th className="text-center pb-2 font-normal w-10">GD</th>
            <th className="text-center pb-2 font-normal w-10 text-white font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr
              key={s.teamId}
              className={`border-b border-gray-800/50 ${i < 2 ? 'text-white' : 'text-gray-400'}`}
            >
              <td className="py-2 text-gray-600 text-xs">{i + 1}</td>
              <td className="py-2">
                <div className="flex items-center gap-2">
                  <Flag code={s.teamId} size={20} />
                  <span className="font-medium">{teamName(s.teamId)}</span>
                  {i < 2 && (
                    <span className="text-xs text-green-500 hidden sm:inline">Q</span>
                  )}
                </div>
              </td>
              <td className="text-center py-2 tabular-nums">{s.played}</td>
              <td className="text-center py-2 tabular-nums">{s.w}</td>
              <td className="text-center py-2 tabular-nums">{s.d}</td>
              <td className="text-center py-2 tabular-nums">{s.l}</td>
              <td className="text-center py-2 tabular-nums">
                <span className={s.gd > 0 ? 'text-green-400' : s.gd < 0 ? 'text-red-400' : 'text-gray-400'}>
                  {s.gd > 0 ? '+' : ''}{s.gd}
                </span>
              </td>
              <td className="text-center py-2 font-bold tabular-nums">{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Groups() {
  const standingsFetcher = useCallback(() => fetchStandings(), []);
  const fixturesFetcher = useCallback(() => fetchFixtures(), []);

  const { data: standings, loading: sLoading, error: sError } = usePolled(standingsFetcher, 60_000);
  const { data: fixtures } = usePolled(fixturesFetcher, 300_000);

  if (sLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading groups…</div>;
  }

  if (sError || !standings) {
    return (
      <div className="card text-red-400 text-sm">
        Failed to load standings: {sError}
      </div>
    );
  }

  const groupIds = Object.keys(standings.groups).sort();

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Group Stage</h2>
      <p className="text-xs text-gray-500">
        Q = qualified (top 2). Best 8 third-placed teams also advance. · Updated{' '}
        {new Date(standings.timestamp).toLocaleTimeString()}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groupIds.map(gid => (
          <StandingsTable
            key={gid}
            groupId={gid}
            standings={standings.groups[gid]}
          />
        ))}
      </div>
    </div>
  );
}
