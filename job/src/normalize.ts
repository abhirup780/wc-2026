/**
 * Normalization utilities shared between adapters and the main job.
 * Compute canonical GroupStanding arrays from a list of finished matches.
 */

import type { Match, GroupStanding, Team } from '@wc2026/shared';

export function computeStandingsFromMatches(
  matches: Match[],
  teams: Team[],
): GroupStanding[] {
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
    if (m.stage !== 'group' || m.status !== 'finished') continue;
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

  return [...map.values()];
}

/** Extract only finished group matches */
export function finishedGroupMatches(matches: Match[]): Match[] {
  return matches.filter(m => m.stage === 'group' && m.status === 'finished');
}
