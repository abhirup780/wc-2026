/**
 * Round-of-32 matchup projection.
 *
 * Monte-Carlo simulates the REMAINING group matches from current results using
 * the same Poisson model (market-blended), FIFA tiebreakers, best-third
 * selection and Annex-C bracket mapping as the main engine. For each of the 16
 * R32 fixtures it tallies which two teams meet, then reports the single most
 * likely matchup with its probability, marginal slot probabilities, and an Elo
 * head-to-head advance probability. Re-runs whenever results change, so the
 * projection sharpens after every match.
 */

import type { Team, Match, GroupStanding, ModelConfig, R32Projection, R32MatchupProjection } from '@wc2026/shared';
import { R32_MATCHES, resolveSlot, assignBestThird } from './bracket.js';
import { selectBestThird } from './best-third.js';
import { rankGroup } from './tiebreakers.js';
import { sampleMatch, type MatchOdds } from './poisson.js';
import { eloWinProb } from '../ratings.js';
import { createRng, childSeed } from './rng.js';

const isFixed = (m: Match) =>
  m.status === 'finished' || (m.status === 'live' && m.homeGoals != null && m.awayGoals != null);

export function projectR32(
  teams: Team[],
  matches: Match[],
  oddsMap: Map<string, MatchOdds> | undefined,
  config: ModelConfig,
  simCount: number,
  seed = 123456789,
): R32Projection {
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const groupMatches = matches.filter(m => m.stage === 'group');
  const remaining = groupMatches.filter(m => !isFixed(m)).length;

  // fixture num → "t1|t2" (ordered by slot) → count
  const matchupCounts = new Map<number, Map<string, number>>();
  // slot label → teamId → count
  const slotCounts = new Map<string, Map<string, number>>();
  for (const rm of R32_MATCHES) matchupCounts.set(rm.num, new Map());

  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
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

    // 5. Resolve each R32 fixture; tally matchup + marginal slot occupancy.
    for (const rm of R32_MATCHES) {
      const t1 = resolveSlot(rm.slot1, groupResults, assignment);
      const t2 = resolveSlot(rm.slot2, groupResults, assignment);
      if (!t1 || !t2) continue;
      bump(matchupCounts.get(rm.num)!, `${t1}|${t2}`);
      if (!slotCounts.has(rm.slot1)) slotCounts.set(rm.slot1, new Map());
      if (!slotCounts.has(rm.slot2)) slotCounts.set(rm.slot2, new Map());
      bump(slotCounts.get(rm.slot1)!, t1);
      bump(slotCounts.get(rm.slot2)!, t2);
    }
  }

  const nameOf = (id: string) => teamMap.get(id)?.name ?? id;
  const eloOf = (id: string) => teamMap.get(id)?.rankingElo ?? 1500;
  const slotProb = (slot: string, team: string) => (slotCounts.get(slot)?.get(team) ?? 0) / simCount;

  const matchups: R32MatchupProjection[] = R32_MATCHES.map(rm => {
    const counts = matchupCounts.get(rm.num)!;
    const [bestKey, bestCnt] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['?|?', 0];
    const [home, away] = bestKey.split('|');
    return {
      num: rm.num,
      slot1: rm.slot1,
      slot2: rm.slot2,
      home,
      away,
      homeName: nameOf(home),
      awayName: nameOf(away),
      prob: bestCnt / simCount,
      homeWinProb: eloWinProb(eloOf(home), eloOf(away)),
      slot1Prob: slotProb(rm.slot1, home),
      slot2Prob: slotProb(rm.slot2, away),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    simCount,
    remainingGroupMatches: remaining,
    matchups,
  };
}
