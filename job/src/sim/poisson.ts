/**
 * Poisson sampling and Dixon-Coles match model.
 *
 * Model:
 *   xG_A = baseRate * attackA / defenseB
 *   xG_B = baseRate * attackB / defenseA
 *   Score probability includes Dixon-Coles low-score correction (ρ = -0.13):
 *     τ(0,0), τ(1,0), τ(0,1), τ(1,1) adjust for over/under-represented
 *     low scores in World Cup matches.
 *
 * All WC 2026 matches are played on neutral ground — no home advantage.
 *
 * If market odds are provided, xG lambdas are scaled so the model's implied
 * win probability matches a blend of model + market probabilities.
 */

import type { Team } from '@wc2026/shared';
import { eloWinProb } from '../ratings.js';

const RHO = -0.13;

/** Dixon-Coles τ correction for low scorelines */
function tauDC(i: number, j: number, lH: number, lA: number): number {
  if (i === 0 && j === 0) return 1 - lH * lA * RHO;
  if (i === 1 && j === 0) return 1 + lA * RHO;
  if (i === 0 && j === 1) return 1 + lH * RHO;
  if (i === 1 && j === 1) return 1 - RHO;
  return 1;
}

export interface MatchOdds {
  homeWinP: number;
  drawP: number;
  awayWinP: number;
}

/** Sample from Poisson(lambda) using Knuth's algorithm (fast for lambda < 30) */
export function poissonSample(lambda: number, rng: () => number): number {
  if (lambda <= 0) return 0;
  if (lambda > 30) {
    // Normal approximation for large lambda
    return Math.max(0, Math.round(normalSample(lambda, Math.sqrt(lambda), rng)));
  }
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

/** Box-Muller normal sample */
function normalSample(mean: number, std: number, rng: () => number): number {
  const u1 = Math.max(1e-10, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

export interface MatchGoals {
  homeGoals: number;
  awayGoals: number;
}

/**
 * Sample a match scoreline using Dixon-Coles Poisson with optional odds blending.
 *
 * The DC correction resamples if the raw Poisson draw is a low scoreline
 * (0-0, 1-0, 0-1, 1-1) by accepting/rejecting with the τ weight — effectively
 * a rejection-sampling wrapper that adjusts the marginal probability of those
 * four scores without changing the mean.
 *
 * If odds are supplied, the xG ratio is adjusted so the model's implied
 * win probability (approximated via Elo) moves toward the market by
 * CONFIG.model.blendOddsWeight.
 */
export function sampleMatch(
  home: Team,
  away: Team,
  baseRate: number,
  rng: () => number,
  odds?: MatchOdds,
  oddsWeight = 0,
): MatchGoals {
  let lH = baseRate * (home.attackRating / away.defenseRating);
  let lA = baseRate * (away.attackRating / home.defenseRating);

  if (odds && oddsWeight > 0) {
    const modelP = eloWinProb(home.rankingElo, away.rankingElo);
    // Normalise market to home-vs-away (strip draw) to match Elo formula
    const mktP = odds.homeWinP / (odds.homeWinP + odds.awayWinP);
    const blended = (1 - oddsWeight) * modelP + oddsWeight * mktP;
    // Scale xG ratio so that homeXg/awayXg matches blended win ratio
    const currentRatio = lH / lA;
    const targetRatio = blended / (1 - blended);
    const scale = Math.sqrt(targetRatio / currentRatio);
    lH *= scale;
    lA /= scale;
  }

  // Dixon-Coles rejection sampling for low scores
  for (let attempt = 0; attempt < 20; attempt++) {
    const h = poissonSample(lH, rng);
    const a = poissonSample(lA, rng);
    const tau = tauDC(h, a, lH, lA);
    if (tau <= 0 || rng() < tau) {
      return { homeGoals: h, awayGoals: a };
    }
  }
  return { homeGoals: poissonSample(lH, rng), awayGoals: poissonSample(lA, rng) };
}

/**
 * For knockout matches, if goals are level after 90 min, simulate extra time
 * then penalties.
 */
export function resolveKnockout(
  homeGoals: number,
  awayGoals: number,
  home: Team,
  away: Team,
  baseRate: number,
  rng: () => number,
  _odds?: MatchOdds,
): { winnerId: string; homeGoalsFinal: number; awayGoalsFinal: number } {
  if (homeGoals !== awayGoals) {
    return {
      winnerId: homeGoals > awayGoals ? home.id : away.id,
      homeGoalsFinal: homeGoals,
      awayGoalsFinal: awayGoals,
    };
  }

  // Extra time: model as ~30% of normal-time scoring
  const etHome = poissonSample(baseRate * 0.3 * (home.attackRating / away.defenseRating), rng);
  const etAway = poissonSample(baseRate * 0.3 * (away.attackRating / home.defenseRating), rng);
  const hFinal = homeGoals + etHome;
  const aFinal = awayGoals + etAway;

  if (hFinal !== aFinal) {
    return {
      winnerId: hFinal > aFinal ? home.id : away.id,
      homeGoalsFinal: hFinal,
      awayGoalsFinal: aFinal,
    };
  }

  // Penalties: 50-50 with slight rating-based skew (FIFA /600 scale)
  const homeWinPens = rng() < 0.5 + 0.05 * Math.tanh((home.rankingElo - away.rankingElo) / 600);
  return {
    winnerId: homeWinPens ? home.id : away.id,
    homeGoalsFinal: hFinal,
    awayGoalsFinal: aFinal,
  };
}
