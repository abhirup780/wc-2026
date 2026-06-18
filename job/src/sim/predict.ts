/**
 * Deterministic "most probable" tournament prediction.
 *
 * For every unplayed match:
 *   - Expected goals = Poisson λ (baseRate × attack/defense ratio)
 *   - Predicted score = round(λ_home), round(λ_away)
 *   - On any tie (group points or KO draw), higher Elo advances
 *
 * Finished matches are taken as-is from the live data.
 */

import type { Team, Match, ModelConfig, PredictedMatch, Prediction } from '@wc2026/shared';
import {
  R32_MATCHES, R16_PAIRS, QF_PAIRS, SF_PAIRS,
  resolveSlot, assignBestThird,
} from './bracket.js';
import { selectBestThird } from './best-third.js';
import { rankGroup } from './tiebreakers.js';
import type { GroupStanding } from '@wc2026/shared';

// ─── Expected goals ───────────────────────────────────────────────────────────

function lambdas(home: Team, away: Team, baseRate: number): [number, number] {
  const lH = baseRate * (home.attackRating / away.defenseRating);
  const lA = baseRate * (away.attackRating / home.defenseRating);
  return [lH, lA];
}

// ─── Group stage ──────────────────────────────────────────────────────────────

function predictGroupStage(
  teams: Team[],
  existingMatches: Match[],
  baseRate: number,
): { predictedMatches: PredictedMatch[]; groups: Map<string, GroupStanding[]> } {
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const predictedMatches: PredictedMatch[] = [];
  const resolvedMatches: Match[] = [];

  for (const m of existingMatches.filter(m => m.stage === 'group')) {
    if (m.status === 'finished' && m.homeGoals != null && m.awayGoals != null) {
      predictedMatches.push({
        id: m.id, stage: m.stage, groupId: m.groupId,
        homeId: m.homeId, awayId: m.awayId, kickoffUtc: m.kickoffUtc,
        homeXg: m.homeGoals, awayXg: m.awayGoals,
        homeGoals: m.homeGoals, awayGoals: m.awayGoals,
      });
      resolvedMatches.push({ ...m });
    } else {
      const home = teamMap.get(m.homeId);
      const away = teamMap.get(m.awayId);
      if (!home || !away) continue;
      const [lH, lA] = lambdas(home, away, baseRate);
      const hg = Math.round(lH);
      const ag = Math.round(lA);
      predictedMatches.push({
        id: m.id, stage: m.stage, groupId: m.groupId,
        homeId: m.homeId, awayId: m.awayId, kickoffUtc: m.kickoffUtc,
        homeXg: lH, awayXg: lA,
        homeGoals: hg, awayGoals: ag,
      });
      resolvedMatches.push({ ...m, status: 'finished', homeGoals: hg, awayGoals: ag });
    }
  }

  // Build standings
  const groups = new Map<string, GroupStanding[]>();
  for (const t of teams) {
    if (!t.groupId) continue;
    if (!groups.has(t.groupId)) groups.set(t.groupId, []);
    groups.get(t.groupId)!.push({
      groupId: t.groupId, teamId: t.id,
      played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, points: 0,
    });
  }
  for (const m of resolvedMatches) {
    if (m.homeGoals == null || m.awayGoals == null) continue;
    const gs = groups.get(m.groupId!);
    if (!gs) continue;
    const home = gs.find(s => s.teamId === m.homeId)!;
    const away = gs.find(s => s.teamId === m.awayId)!;
    home.played++; away.played++;
    home.gf += m.homeGoals; home.ga += m.awayGoals; home.gd = home.gf - home.ga;
    away.gf += m.awayGoals; away.ga += m.homeGoals; away.gd = away.gf - away.ga;
    if (m.homeGoals > m.awayGoals) { home.w++; home.points += 3; away.l++; }
    else if (m.homeGoals < m.awayGoals) { away.w++; away.points += 3; home.l++; }
    else { home.d++; away.d++; home.points++; away.points++; }
  }

  // Rank with tiebreaker — deterministic RNG (always same result)
  const deterministicRng = () => 0.5;
  for (const [gid, standings] of groups.entries()) {
    const gMatches = resolvedMatches.filter(m => m.groupId === gid);
    groups.set(gid, rankGroup(standings, gMatches, deterministicRng));
  }

  return { predictedMatches, groups };
}

// ─── KO round ────────────────────────────────────────────────────────────────

function predictKoRound(
  matchPairs: [string, string][],
  roundPrefix: string,
  stage: string,
  prevWinners: Map<string, string>,
  teamMap: Map<string, Team>,
  baseRate: number,
): { predictedMatches: PredictedMatch[]; winners: Map<string, string> } {
  const predictedMatches: PredictedMatch[] = [];
  const winners = new Map<string, string>();

  matchPairs.forEach(([slot1, slot2], i) => {
    const homeId = prevWinners.get(slot1);
    const awayId = prevWinners.get(slot2);
    if (!homeId || !awayId) return;

    const home = teamMap.get(homeId)!;
    const away = teamMap.get(awayId)!;
    const [lH, lA] = lambdas(home, away, baseRate);
    let hg = Math.round(lH);
    let ag = Math.round(lA);

    // On draw, higher Elo wins (deterministic tiebreak) — score stays equal
    const winnerId = hg > ag ? homeId : hg < ag ? awayId :
      home.rankingElo >= away.rankingElo ? homeId : awayId;

    const matchId = `${roundPrefix}-${String(i + 1).padStart(2, '0')}`;
    predictedMatches.push({
      id: matchId,
      stage: stage as any,
      groupId: null,
      homeId, awayId,
      kickoffUtc: '',
      homeXg: lH, awayXg: lA,
      homeGoals: hg, awayGoals: ag,
      winnerId,
    });
    winners.set(matchId, winnerId);
  });

  return { predictedMatches, winners };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function predictTournament(
  teams: Team[],
  matches: Match[],
  config: ModelConfig,
): Prediction {
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const allPredicted: PredictedMatch[] = [];
  const deterministicRng = () => 0.5;

  // 1. Group stage
  const { predictedMatches: groupPredictions, groups } = predictGroupStage(teams, matches, config.baseGoalsRate);
  allPredicted.push(...groupPredictions);

  // 2. Select advancing teams
  const groupResults = new Map<string, string>();
  const thirdPlaced: GroupStanding[] = [];
  for (const [groupId, standings] of groups.entries()) {
    const gMatches = groupPredictions.filter(m => m.groupId === groupId);
    const resolved: Match[] = gMatches.map(m => ({
      ...m, status: 'finished' as const,
    }));
    const ranked = rankGroup(standings, resolved, deterministicRng);
    groupResults.set(`1${groupId}`, ranked[0].teamId);
    groupResults.set(`2${groupId}`, ranked[1].teamId);
    if (ranked[2]) thirdPlaced.push(ranked[2]);
  }
  const bestThird = selectBestThird(thirdPlaced, deterministicRng);
  for (const t of bestThird) groupResults.set(`3${t.groupId}`, t.teamId);

  const bestThirdAssignment = assignBestThird(
    bestThird.map(t => ({ teamId: t.teamId, groupId: t.groupId })),
  );

  // 3. R32
  const r32Slots = new Map<string, string>();
  for (const rm of R32_MATCHES) {
    const t1 = resolveSlot(rm.slot1, groupResults, bestThirdAssignment);
    const t2 = resolveSlot(rm.slot2, groupResults, bestThirdAssignment);
    if (t1) r32Slots.set(rm.slot1, t1);
    if (t2) r32Slots.set(rm.slot2, t2);
  }
  const r32Pairs = R32_MATCHES.map(rm => [rm.slot1, rm.slot2] as [string, string]);
  const { predictedMatches: r32, winners: r32Winners } = predictKoRound(r32Pairs, 'R32', 'r32', r32Slots, teamMap, config.baseGoalsRate);
  allPredicted.push(...r32);

  // 4. R16
  const r16Pairs = R16_PAIRS.map(([a, b]) => [a, b] as [string, string]);
  const { predictedMatches: r16, winners: r16Winners } = predictKoRound(r16Pairs, 'R16', 'r16', r32Winners, teamMap, config.baseGoalsRate);
  allPredicted.push(...r16);

  // 5. QF
  const qfPairs = QF_PAIRS.map(([a, b]) => [a, b] as [string, string]);
  const { predictedMatches: qf, winners: qfWinners } = predictKoRound(qfPairs, 'QF', 'qf', r16Winners, teamMap, config.baseGoalsRate);
  allPredicted.push(...qf);

  // 6. SF
  const sfPairs = SF_PAIRS.map(([a, b]) => [a, b] as [string, string]);
  const { predictedMatches: sf, winners: sfWinners } = predictKoRound(sfPairs, 'SF', 'sf', qfWinners, teamMap, config.baseGoalsRate);
  allPredicted.push(...sf);

  // 7. Final
  const { predictedMatches: final, winners: finalWinners } = predictKoRound(
    [['SF-01', 'SF-02']], 'FINAL', 'final', sfWinners, teamMap, config.baseGoalsRate,
  );
  allPredicted.push(...final);

  const champion = finalWinners.get('FINAL-01') ?? '';

  return { matches: allPredicted, champion, generatedAt: new Date().toISOString() };
}
