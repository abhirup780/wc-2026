/**
 * Deterministic "most probable" tournament prediction.
 *
 * Scorelines are drawn from the SAME Dixon-Coles Poisson + extra-time/penalty
 * model the Monte Carlo engine uses, but each match is seeded deterministically
 * from its own id — so the predicted bracket is a single, stable, realistic
 * scenario that only changes when real results change the inputs (not on every
 * refresh). This avoids the degenerate round(λ) result where almost every close
 * match collapses to 1-1 and is "decided on penalties".
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
import { sampleMatch, poissonSample, type MatchOdds } from './poisson.js';
import type { GroupStanding } from '@wc2026/shared';

// Extra-time scoring rate (fraction of a full match). Higher than the engine's
// 0.3 so more level matches are settled in ET, keeping the predicted shootout
// rate near the historic WC norm (~13-15% of knockout ties) rather than ~25%+.
const ET_GOAL_RATE = 0.55;

// ─── Expected goals ───────────────────────────────────────────────────────────

function lambdas(home: Team, away: Team, baseRate: number): [number, number] {
  const lH = baseRate * (home.attackRating / away.defenseRating);
  const lA = baseRate * (away.attackRating / home.defenseRating);
  return [lH, lA];
}

/**
 * Stable per-match PRNG (mulberry32 seeded by an FNV-1a hash of a string key).
 * Same key → same sequence, so the predicted bracket is reproducible.
 */
function seededRng(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let s = h >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sample a realistic scoreline, then orient it so the higher-rated team never
 * loses. This keeps the "most likely outcome" an upset-free favourites' path
 * (no random Brazil-loses-to-Austria results) while preserving varied, lifelike
 * scorelines — and genuine draws, since a level sample is left level.
 * Returns goals split as favourite (sg) vs underdog (wg) plus which side is home.
 */
function favoredScoreline(
  home: Team,
  away: Team,
  baseRate: number,
  rng: () => number,
  odds: MatchOdds | undefined,
  oddsWeight: number,
): { favHome: boolean; sg: number; wg: number } {
  const reg = sampleMatch(home, away, baseRate, rng, odds, oddsWeight);
  const favHome = home.rankingElo >= away.rankingElo;
  let sg = favHome ? reg.homeGoals : reg.awayGoals;
  let wg = favHome ? reg.awayGoals : reg.homeGoals;
  if (sg < wg) { const t = sg; sg = wg; wg = t; } // favourite takes the better score
  return { favHome, sg, wg };
}

// ─── Group stage ──────────────────────────────────────────────────────────────

function predictGroupStage(
  teams: Team[],
  existingMatches: Match[],
  baseRate: number,
  oddsMap: Map<string, MatchOdds> | undefined,
  oddsWeight: number,
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
      const rng = seededRng(`${m.id}|${m.homeId}|${m.awayId}`);
      const odds = oddsMap?.get(`${m.homeId}|${m.awayId}`);
      const { favHome, sg, wg } = favoredScoreline(home, away, baseRate, rng, odds, oddsWeight);
      const hg = favHome ? sg : wg;
      const ag = favHome ? wg : sg;
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
  oddsMap: Map<string, MatchOdds> | undefined,
  oddsWeight: number,
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

    const matchId = `${roundPrefix}-${String(i + 1).padStart(2, '0')}`;
    const rng = seededRng(`${matchId}|${homeId}|${awayId}`);

    // Realistic regulation scoreline oriented so the favourite never loses,
    // then extra time, then (rarely) penalties — the favourite always advances.
    const odds = oddsMap?.get(`${homeId}|${awayId}`);
    const { favHome, sg, wg } = favoredScoreline(home, away, baseRate, rng, odds, oddsWeight);
    const favLambda = favHome ? lH : lA;
    const dogLambda = favHome ? lA : lH;
    let s = sg, w = wg;
    if (s === w) {
      // Extra time, still keeping the favourite from losing
      s += poissonSample(favLambda * ET_GOAL_RATE, rng);
      w += poissonSample(dogLambda * ET_GOAL_RATE, rng);
      if (s < w) { const t = s; s = w; w = t; }
      // If still level → penalties, won by the favourite (s === w stays a draw scoreline)
    }
    const winnerId = favHome ? homeId : awayId;
    const hg = favHome ? s : w;
    const ag = favHome ? w : s;

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
  oddsMap?: Map<string, MatchOdds>,
): Prediction {
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const allPredicted: PredictedMatch[] = [];
  const deterministicRng = () => 0.5;
  // Blend bookmaker odds into match scorelines when available (matches the forecast).
  const oddsWeight = oddsMap ? config.blendOddsWeight : 0;

  // 1. Group stage
  const { predictedMatches: groupPredictions, groups } = predictGroupStage(teams, matches, config.baseGoalsRate, oddsMap, oddsWeight);
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

  // 3. R32 — use reduced KO goal rate
  const koBaseRate = config.baseGoalsRate * config.knockoutGoalsMultiplier;
  const r32Slots = new Map<string, string>();
  for (const rm of R32_MATCHES) {
    const t1 = resolveSlot(rm.slot1, groupResults, bestThirdAssignment);
    const t2 = resolveSlot(rm.slot2, groupResults, bestThirdAssignment);
    if (t1) r32Slots.set(rm.slot1, t1);
    if (t2) r32Slots.set(rm.slot2, t2);
  }
  const r32Pairs = R32_MATCHES.map(rm => [rm.slot1, rm.slot2] as [string, string]);
  const { predictedMatches: r32, winners: r32Winners } = predictKoRound(r32Pairs, 'R32', 'r32', r32Slots, teamMap, koBaseRate, oddsMap, oddsWeight);
  allPredicted.push(...r32);

  // 4. R16
  const r16Pairs = R16_PAIRS.map(([a, b]) => [a, b] as [string, string]);
  const { predictedMatches: r16, winners: r16Winners } = predictKoRound(r16Pairs, 'R16', 'r16', r32Winners, teamMap, koBaseRate, oddsMap, oddsWeight);
  allPredicted.push(...r16);

  // 5. QF
  const qfPairs = QF_PAIRS.map(([a, b]) => [a, b] as [string, string]);
  const { predictedMatches: qf, winners: qfWinners } = predictKoRound(qfPairs, 'QF', 'qf', r16Winners, teamMap, koBaseRate, oddsMap, oddsWeight);
  allPredicted.push(...qf);

  // 6. SF
  const sfPairs = SF_PAIRS.map(([a, b]) => [a, b] as [string, string]);
  const { predictedMatches: sf, winners: sfWinners } = predictKoRound(sfPairs, 'SF', 'sf', qfWinners, teamMap, koBaseRate, oddsMap, oddsWeight);
  allPredicted.push(...sf);

  // 7. Final
  const { predictedMatches: final, winners: finalWinners } = predictKoRound(
    [['SF-01', 'SF-02']], 'FINAL', 'final', sfWinners, teamMap, koBaseRate, oddsMap, oddsWeight,
  );
  allPredicted.push(...final);

  const champion = finalWinners.get('FINAL-01') ?? '';

  return { matches: allPredicted, champion, generatedAt: new Date().toISOString() };
}
