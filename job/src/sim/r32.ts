/**
 * Round-of-32 matchup projection (global pairing frequencies).
 *
 * Keeps every played group result fixed, then Monte-Carlo predicts the
 * remaining group matches with the same market-blended Poisson model the engine
 * uses (favourite-leaning, minimal upset noise). Each simulation produces a full
 * R32 bracket via FIFA tiebreakers, the 8 best thirds and Annex-C assignment.
 *
 * Across all 16 slots and all sims it counts how often each exact two-team
 * pairing occurs, then ranks them high→low. `prob` is the probability those two
 * teams meet anywhere in the Round of 32. Re-runs whenever results change.
 */

import type { Team, Match, GroupStanding, ModelConfig, R32Projection, R32Matchup } from '@wc2026/shared';
import { R32_MATCHES, resolveSlot, assignBestThird } from './bracket.js';
import { selectBestThird } from './best-third.js';
import { rankGroup } from './tiebreakers.js';
import { sampleMatch, type MatchOdds } from './poisson.js';
import { eloWinProb } from '../ratings.js';
import { createRng, childSeed } from './rng.js';

const TOP_N = 50;

const isFixed = (m: Match) =>
  m.status === 'finished' || (m.status === 'live' && m.homeGoals != null && m.awayGoals != null);

export function projectR32(
  teams: Team[],
  matches: Match[],
  oddsMap: Map<string, MatchOdds> | undefined,
  config: ModelConfig,
  simCount: number,
  seed = 20260621,
): R32Projection {
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const groupMatches = matches.filter(m => m.stage === 'group');
  const remaining = groupMatches.filter(m => !isFixed(m)).length;

  // "A|B" (codes sorted) → number of sims the pair meets in the R32.
  const pairCount = new Map<string, number>();
  const rng = createRng(seed);

  for (let i = 0; i < simCount; i++) {
    const r = createRng(childSeed(rng));

    // 1. Resolve every group match (fixed kept; rest sampled, market-blended).
    const resolved: Match[] = groupMatches.map(m => {
      if (isFixed(m)) return m;
      const h = teamMap.get(m.homeId), a = teamMap.get(m.awayId);
      if (!h || !a) return m;
      const odds = oddsMap?.get(`${m.homeId}|${m.awayId}`);
      const { homeGoals, awayGoals } = sampleMatch(h, a, config.baseGoalsRate, r, odds, config.blendOddsWeight);
      return { ...m, status: 'finished' as const, homeGoals, awayGoals };
    });

    // 2. Standings.
    const groups = new Map<string, GroupStanding[]>();
    for (const t of teams) {
      if (!t.groupId) continue;
      if (!groups.has(t.groupId)) groups.set(t.groupId, []);
      groups.get(t.groupId)!.push({ groupId: t.groupId, teamId: t.id, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, points: 0 });
    }
    for (const m of resolved) {
      if (m.homeGoals == null || m.awayGoals == null) continue;
      const gs = groups.get(m.groupId!); if (!gs) continue;
      const H = gs.find(s => s.teamId === m.homeId)!, A = gs.find(s => s.teamId === m.awayId)!;
      H.played++; A.played++;
      H.gf += m.homeGoals; H.ga += m.awayGoals; H.gd = H.gf - H.ga;
      A.gf += m.awayGoals; A.ga += m.homeGoals; A.gd = A.gf - A.ga;
      if (m.homeGoals > m.awayGoals) { H.w++; H.points += 3; A.l++; }
      else if (m.homeGoals < m.awayGoals) { A.w++; A.points += 3; H.l++; }
      else { H.d++; A.d++; H.points++; A.points++; }
    }

    // 3. Winners / runners-up / thirds with FIFA tiebreakers.
    const groupResults = new Map<string, string>();
    const thirds: GroupStanding[] = [];
    for (const [gid, standings] of groups.entries()) {
      const gMatches = resolved.filter(m => m.groupId === gid);
      const ranked = rankGroup(standings, gMatches, r);
      groupResults.set(`1${gid}`, ranked[0].teamId);
      groupResults.set(`2${gid}`, ranked[1].teamId);
      if (ranked[2]) thirds.push(ranked[2]);
    }

    // 4. Best-8 thirds → Annex-C slot assignment.
    const bestThird = selectBestThird(thirds, r);
    const assignment = assignBestThird(bestThird.map(t => ({ teamId: t.teamId, groupId: t.groupId })));

    // 5. Resolve each R32 fixture; tally the (unordered) pairing globally.
    for (const rm of R32_MATCHES) {
      const t1 = resolveSlot(rm.slot1, groupResults, assignment);
      const t2 = resolveSlot(rm.slot2, groupResults, assignment);
      if (!t1 || !t2) continue;
      const key = t1 < t2 ? `${t1}|${t2}` : `${t2}|${t1}`;
      pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
    }
  }

  const nameOf = (id: string) => teamMap.get(id)?.name ?? id;
  const eloOf = (id: string) => teamMap.get(id)?.rankingElo ?? 1500;

  const matchups: R32Matchup[] = [...pairCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([key, cnt]) => {
      const [x, y] = key.split('|');
      const home = eloOf(x) >= eloOf(y) ? x : y; // favourite first
      const away = home === x ? y : x;
      return {
        home,
        away,
        homeName: nameOf(home),
        awayName: nameOf(away),
        prob: cnt / simCount,
        homeWinProb: eloWinProb(eloOf(home), eloOf(away)),
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    simCount,
    remainingGroupMatches: remaining,
    distinctMatchups: pairCount.size,
    matchups,
  };
}
