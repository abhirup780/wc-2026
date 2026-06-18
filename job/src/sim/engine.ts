/**
 * Monte Carlo simulation engine.
 *
 * For N iterations:
 *   1. Fix all finished matches as-is.
 *   2. Sample unplayed group matches using the Poisson model.
 *   3. Compute final group tables with official tiebreakers.
 *   4. Select top-2 from each group + 8 best 3rd-placed.
 *   5. Seed the bracket and simulate each knockout round.
 *   6. Tally results.
 *
 * Produces TeamForecast[] with per-team probabilities for each milestone.
 */

import type { Team, Match, GroupStanding, TeamForecast, Forecast, ModelConfig } from '@wc2026/shared';
import { createRng, childSeed } from './rng.js';
import { sampleMatch, resolveKnockout, type MatchOdds } from './poisson.js';
import { rankGroup } from './tiebreakers.js';
import { selectBestThird } from './best-third.js';
import {
  R32_MATCHES,
  R16_PAIRS,
  QF_PAIRS,
  SF_PAIRS,
  THIRD_PLACE_PAIR,
  resolveSlot,
  assignBestThird,
} from './bracket.js';
import { eloWinProb } from '../ratings.js';

// ─── Tallies ─────────────────────────────────────────────────────────────────

interface Tally {
  winGroup: number;
  advanceGroup: number;
  reachR16: number;
  reachQF: number;
  reachSF: number;
  reachFinal: number;
  champion: number;
}

function zeroTally(): Tally {
  return { winGroup: 0, advanceGroup: 0, reachR16: 0, reachQF: 0, reachSF: 0, reachFinal: 0, champion: 0 };
}

// ─── Group-stage simulation ───────────────────────────────────────────────────

function simulateGroupMatches(
  matches: Match[],
  teamMap: Map<string, Team>,
  config: ModelConfig,
  hostNations: Set<string>,
  rng: () => number,
  oddsMap?: Map<string, MatchOdds>,
): Match[] {
  return matches.map(m => {
    if (m.stage !== 'group' || m.status === 'finished') return m;

    const home = teamMap.get(m.homeId);
    const away = teamMap.get(m.awayId);
    if (!home || !away) return m;

    const hostMultiplier = hostNations.has(m.homeId) ? config.hostAdjustment : 1.0;
    const odds = oddsMap?.get(`${m.homeId}|${m.awayId}`);

    const { homeGoals, awayGoals } = sampleMatch(
      home, away, config.baseGoalsRate, hostMultiplier, rng, odds, config.blendOddsWeight,
    );

    return { ...m, status: 'finished' as const, homeGoals, awayGoals };
  });
}

// ─── Build standings from matches ─────────────────────────────────────────────

function buildStandings(
  groupMatches: Match[],
  teams: Team[],
): Map<string, GroupStanding[]> {
  const groups = new Map<string, GroupStanding[]>();

  for (const t of teams) {
    if (!t.groupId) continue;
    if (!groups.has(t.groupId)) groups.set(t.groupId, []);
    groups.get(t.groupId)!.push({
      groupId: t.groupId, teamId: t.id,
      played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, points: 0,
    });
  }

  for (const m of groupMatches) {
    if (m.status !== 'finished' || m.homeGoals == null || m.awayGoals == null) continue;
    const gStandings = groups.get(m.groupId!);
    if (!gStandings) continue;

    const home = gStandings.find(s => s.teamId === m.homeId)!;
    const away = gStandings.find(s => s.teamId === m.awayId)!;
    const hg = m.homeGoals;
    const ag = m.awayGoals;

    home.played++; away.played++;
    home.gf += hg; home.ga += ag; home.gd = home.gf - home.ga;
    away.gf += ag; away.ga += hg; away.gd = away.gf - away.ga;

    if (hg > ag) { home.w++; home.points += 3; away.l++; }
    else if (hg < ag) { away.w++; away.points += 3; home.l++; }
    else { home.d++; away.d++; home.points++; away.points++; }
  }

  return groups;
}

// ─── Select advancing teams ───────────────────────────────────────────────────

interface AdvancingTeams {
  groupResults: Map<string, string>; // "1A" → teamId, "2B" → teamId
  thirdPlaced: GroupStanding[];
  bestThird: GroupStanding[];
}

function selectAdvancing(
  groups: Map<string, GroupStanding[]>,
  allMatches: Match[],
  rng: () => number,
): AdvancingTeams {
  const groupResults = new Map<string, string>();
  const thirdPlaced: GroupStanding[] = [];

  for (const [groupId, standings] of groups.entries()) {
    const groupMatches = allMatches.filter(
      m => m.stage === 'group' && m.groupId === groupId,
    );
    const ranked = rankGroup(standings, groupMatches, rng);

    groupResults.set(`1${groupId}`, ranked[0].teamId);
    groupResults.set(`2${groupId}`, ranked[1].teamId);
    if (ranked[2]) thirdPlaced.push(ranked[2]);
  }

  const bestThird = selectBestThird(thirdPlaced, rng);

  return { groupResults, thirdPlaced, bestThird };
}

// ─── Knockout simulation ──────────────────────────────────────────────────────

function simulateKnockoutRound(
  matchPairs: [string, string][],
  roundPrefix: string,
  prevWinners: Map<string, string>,
  teamMap: Map<string, Team>,
  config: ModelConfig,
  hostNations: Set<string>,
  rng: () => number,
  oddsMap?: Map<string, MatchOdds>,
): Map<string, string> {
  const winners = new Map<string, string>();

  matchPairs.forEach(([slot1, slot2], i) => {
    const matchId = `${roundPrefix}-${String(i + 1).padStart(2, '0')}`;
    const homeId = prevWinners.get(slot1);
    const awayId = prevWinners.get(slot2);

    if (!homeId || !awayId) return;

    const home = teamMap.get(homeId)!;
    const away = teamMap.get(awayId)!;
    const hostMul = hostNations.has(homeId) ? config.hostAdjustment : 1.0;
    const odds = oddsMap?.get(`${homeId}|${awayId}`)
      ?? oddsMap?.get(`${awayId}|${homeId}`); // knockout teams may be in either order

    const { homeGoals, awayGoals } = sampleMatch(
      home, away, config.baseGoalsRate, hostMul, rng, odds, config.blendOddsWeight,
    );
    const { winnerId } = resolveKnockout(
      homeGoals, awayGoals, home, away, config.baseGoalsRate, hostMul, rng,
    );

    winners.set(matchId, winnerId);
  });

  return winners;
}

// ─── Elo-based model (alternative) ──────────────────────────────────────────

function simulateMatchElo(
  home: Team,
  away: Team,
  rng: () => number,
): { homeGoals: number; awayGoals: number } {
  const homeWin = eloWinProb(home.rankingElo, away.rankingElo);
  const draw = 0.25; // typical WC draw rate
  const r = rng();
  if (r < homeWin - draw / 2) return { homeGoals: 2, awayGoals: 0 };
  if (r < homeWin + draw / 2) return { homeGoals: 1, awayGoals: 1 };
  return { homeGoals: 0, awayGoals: 2 };
}

// ─── Main simulation entry point ──────────────────────────────────────────────

export interface SimConfig {
  simCount: number;
  seed: number;
  model: ModelConfig;
  hostNations: string[];
  /** Market odds keyed by "homeId|awayId". Applied when model.blendOddsWeight > 0. */
  oddsMap?: Map<string, MatchOdds>;
}

export function runSimulation(
  teams: Team[],
  matches: Match[],
  config: SimConfig,
): Omit<Forecast, 'dataSnapshotTimestamp'> {
  const rng = createRng(config.seed);
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const hostSet = new Set(config.hostNations);

  const tallies = new Map<string, Tally>(teams.map(t => [t.id, zeroTally()]));
  const championCounts = new Map<string, number>(teams.map(t => [t.id, 0]));

  const groupMatches = matches.filter(m => m.stage === 'group');

  for (let i = 0; i < config.simCount; i++) {
    const iterRng = createRng(childSeed(rng));

    // 1. Simulate group matches
    const simGroupMatches = simulateGroupMatches(
      groupMatches, teamMap, config.model, hostSet, iterRng, config.oddsMap,
    );

    // 2. Build group standings
    const groups = buildStandings(simGroupMatches, teams);

    // 3. Select advancing teams
    const { groupResults, bestThird } = selectAdvancing(groups, simGroupMatches, iterRng);

    // Tally group-stage outcomes
    for (const [slot, teamId] of groupResults.entries()) {
      const tally = tallies.get(teamId)!;
      if (slot.startsWith('1')) tally.winGroup++;
      tally.advanceGroup++;
      tally.reachR16++; // advancing means at least R32 (=R16 in old terminology)
    }
    for (const t of bestThird) {
      const tally = tallies.get(t.teamId);
      if (tally) { tally.advanceGroup++; tally.reachR16++; }
    }

    // 4. Assign best-third to bracket slots
    const bestThirdAssignment = assignBestThird(
      bestThird.map(t => ({ teamId: t.teamId, groupId: t.groupId })),
    );

    // Build slot → teamId map for R32
    const r32Slots = new Map<string, string>();
    for (const rm of R32_MATCHES) {
      const t1 = resolveSlot(rm.slot1, groupResults, bestThirdAssignment);
      const t2 = resolveSlot(rm.slot2, groupResults, bestThirdAssignment);
      if (t1) r32Slots.set(rm.slot1, t1);
      if (t2) r32Slots.set(rm.slot2, t2);
    }

    // 5. Simulate knockout rounds
    // R32 → produces R32-01..R32-16 winners
    const r32Pairs = R32_MATCHES.map(rm => [rm.slot1, rm.slot2] as [string, string]);
    const r32Winners = simulateKnockoutRound(
      r32Pairs, 'R32', r32Slots, teamMap, config.model, hostSet, iterRng, config.oddsMap,
    );

    // R16
    const r16Pairs = R16_PAIRS.map(([a, b]) => [a, b] as [string, string]);
    const r16Winners = simulateKnockoutRound(
      r16Pairs, 'R16', r32Winners, teamMap, config.model, hostSet, iterRng, config.oddsMap,
    );
    for (const teamId of r16Winners.values()) {
      const t = tallies.get(teamId); if (t) t.reachQF++;
    }

    // QF
    const qfPairs = QF_PAIRS.map(([a, b]) => [a, b] as [string, string]);
    const qfWinners = simulateKnockoutRound(
      qfPairs, 'QF', r16Winners, teamMap, config.model, hostSet, iterRng, config.oddsMap,
    );
    for (const teamId of qfWinners.values()) {
      const t = tallies.get(teamId); if (t) t.reachSF++;
    }

    // SF
    const sfPairs = SF_PAIRS.map(([a, b]) => [a, b] as [string, string]);
    const sfWinners = simulateKnockoutRound(
      sfPairs, 'SF', qfWinners, teamMap, config.model, hostSet, iterRng, config.oddsMap,
    );
    for (const teamId of sfWinners.values()) {
      const t = tallies.get(teamId); if (t) t.reachFinal++;
    }

    // Final
    const finalPair: [string, string][] = [['SF-01', 'SF-02']];
    const finalWinners = simulateKnockoutRound(
      finalPair, 'FINAL', sfWinners, teamMap, config.model, hostSet, iterRng, config.oddsMap,
    );
    const champion = finalWinners.get('FINAL-01');
    if (champion) {
      const t = tallies.get(champion); if (t) t.champion++;
      championCounts.set(champion, (championCounts.get(champion) ?? 0) + 1);
    }
  }

  // ─── Build output ────────────────────────────────────────────────────────────

  const N = config.simCount;

  const teamForecasts: TeamForecast[] = teams.map(t => {
    const tally = tallies.get(t.id) ?? zeroTally();
    return {
      teamId: t.id,
      name: t.name,
      code: t.code,
      groupId: t.groupId,
      pWinGroup: tally.winGroup / N,
      pAdvanceGroup: tally.advanceGroup / N,
      pReachR16: tally.reachR16 / N,
      pReachQF: tally.reachQF / N,
      pReachSF: tally.reachSF / N,
      pReachFinal: tally.reachFinal / N,
      pChampion: tally.champion / N,
    };
  });

  const championDistribution: Record<string, number> = {};
  for (const [teamId, count] of championCounts.entries()) {
    if (count > 0) championDistribution[teamId] = count / N;
  }

  // ─── Self-check: probabilities must sum correctly ─────────────────────────────
  validateForecast(teamForecasts, N, tallies);

  return {
    teams: teamForecasts,
    championDistribution,
    modelConfig: config.model,
    simCount: N,
    seed: config.seed,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForecast(
  forecasts: TeamForecast[],
  N: number,
  tallies: Map<string, Tally>,
): void {
  const totalChampion = forecasts.reduce((s, t) => s + t.pChampion, 0);
  // Should be very close to 1.0 (within rounding tolerance)
  if (Math.abs(totalChampion - 1.0) > 0.02) {
    throw new Error(
      `Forecast validation failed: champion probabilities sum to ${totalChampion.toFixed(4)}, expected ~1.0`,
    );
  }

  for (const t of forecasts) {
    // Monotonicity: advancing probabilities must be non-increasing
    const order = [t.pAdvanceGroup, t.pReachR16, t.pReachQF, t.pReachSF, t.pReachFinal, t.pChampion];
    for (let i = 1; i < order.length; i++) {
      if (order[i] > order[i - 1] + 1e-9) {
        throw new Error(
          `Forecast validation failed: non-monotonic probabilities for team ${t.teamId}`,
        );
      }
    }
  }
}
