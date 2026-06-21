import { useCallback, useMemo } from 'react';
import { usePolled, fetchStandings, fetchFixtures, useESPNLive } from '../api.ts';
import { teamName } from '../utils.ts';
import Flag from './Flag.tsx';
import type { GroupStanding, Fixtures, Team, Match } from '@wc2026/shared';
import type { ESPNLiveMatch } from '../api.ts';

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

function computeStandings(matches: Match[], teams: Team[]): Record<string, GroupStanding[]> {
  const map = new Map<string, GroupStanding>();

  for (const t of teams) {
    if (!t.groupId) continue;
    map.set(`${t.groupId}:${t.id}`, {
      groupId: t.groupId,
      teamId: t.id,
      played: 0, w: 0, d: 0, l: 0,
      gf: 0, ga: 0, gd: 0, points: 0,
    });
  }

  for (const m of matches) {
    if (m.stage !== 'group' || (m.status !== 'finished' && m.status !== 'live')) continue;
    if (m.homeGoals == null || m.awayGoals == null) continue;

    const homeKey = `${m.groupId}:${m.homeId}`;
    const awayKey = `${m.groupId}:${m.awayId}`;
    const home = map.get(homeKey);
    const away = map.get(awayKey);
    if (!home || !away) continue;

    const hg = m.homeGoals;
    const ag = m.awayGoals;

    home.played++;
    away.played++;
    home.gf += hg; home.ga += ag; home.gd = home.gf - home.ga;
    away.gf += ag; away.ga += hg; away.gd = away.gf - away.ga;

    if (hg > ag) { home.w++; home.points += 3; away.l++; }
    else if (hg < ag) { away.w++; away.points += 3; home.l++; }
    else { home.d++; away.d++; home.points++; away.points++; }
  }

  const grouped: Record<string, GroupStanding[]> = {};
  for (const s of map.values()) {
    if (!grouped[s.groupId]) grouped[s.groupId] = [];
    grouped[s.groupId].push(s);
  }
  return grouped;
}

function StandingsTable({ groupId, standings }: { groupId: string; standings: GroupStanding[] }) {
  const sorted = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });

  // Group is "decided" once every team has played all 3 matches — only then
  // are the top-2 qualification spots final, so only then do we show "Q".
  const groupDecided = sorted.length > 0 && sorted.every(s => s.played >= 3);

  return (
    <div className="card">
      <h3 className="font-display text-sm font-bold text-fifa-gold mb-3 tracking-wider">GROUP {groupId}</h3>
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
            <th className="text-center pb-2 font-normal w-10 text-gray-50 font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr
              key={s.teamId}
              className={`border-b border-gray-800/50 ${i < 2 ? 'text-gray-50' : 'text-gray-400'}`}
            >
              <td className="py-2 text-gray-500 text-xs">{i + 1}</td>
              <td className="py-2">
                <div className="flex items-center gap-2">
                  <Flag code={s.teamId} size={20} />
                  <span className="font-medium">{teamName(s.teamId)}</span>
                  {groupDecided && i < 2 && (
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

  const { data: standings, loading: sLoading, error: sError } = usePolled(standingsFetcher, 30_000);
  const { data: fixtures, loading: fLoading, error: fError } = usePolled(fixturesFetcher, 60_000);
  const { matches: espnMatches } = useESPNLive(10_000);

  const computedGroups = useMemo(() => {
    if (!fixtures) return null;
    const merged = mergeESPN(fixtures.matches, espnMatches);
    return computeStandings(merged, fixtures.teams);
  }, [fixtures, espnMatches]);

  const loading = sLoading || fLoading;
  const error = sError || fError;

  if (loading && !computedGroups) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading groups…</div>;
  }

  if (error && !computedGroups) {
    return (
      <div className="card text-red-400 text-sm">
        Failed to load standings: {error}
      </div>
    );
  }

  const groupIds = fixtures ? [...fixtures.groups].sort() : Object.keys(standings?.groups ?? {}).sort();
  const displayGroups = computedGroups || standings?.groups;

  if (!displayGroups) {
    return <div className="flex items-center justify-center h-64 text-gray-500">No data available</div>;
  }

  const timestamp = standings?.timestamp || new Date().toISOString();

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Group Stage</h2>
      <p className="text-xs text-gray-500">
        Q = qualified (top 2, shown once the group is decided). Best 8 third-placed teams also advance. · Updated{' '}
        {new Date(timestamp).toLocaleTimeString()}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groupIds.map(gid => (
          <StandingsTable
            key={gid}
            groupId={gid}
            standings={displayGroups[gid]}
          />
        ))}
      </div>
    </div>
  );
}
