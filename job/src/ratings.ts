/**
 * In-tournament rating updates using FIFA's official "SUM" method
 * (FIFA/Coca-Cola World Ranking, in use since 2018):
 *
 *   P = P_before + I × (W − We)
 *
 *   I  = match-importance factor (WC group = 50, WC knockout = 60)
 *   W  = actual result   (win 1.0 / draw 0.5 / loss 0.0;
 *                         shootout win 0.75 / shootout loss 0.5)
 *   We = expected result = 1 / (1 + 10^(−Δ/600)),  Δ = ratingA − ratingB
 *
 * Unlike eloratings.net, FIFA SUM ignores goal difference entirely
 * (1-0 and 8-0 are identical) and does not consider home advantage.
 *
 * After each update, attackRating and defenseRating are re-derived from the
 * new rating so the Poisson goal model stays calibrated to the same scale.
 *
 * Formula: strength = 10^((rating − 1500) / 1500)
 *   → lambdaA_vs_B = baseRate × strengthA / strengthB
 *                  = baseRate × 10^((ratingA − ratingB) / 1500)
 *   The /1500 denominator is tuned so the Poisson-implied win probability
 *   tracks the /600 FIFA win-prob curve (the 1500 offset cancels in the ratio).
 *
 * No hand-coded attack/defense values anywhere — ratings come solely from the
 * FIFA points seed (see TEAM_ELO in adapters/team-codes.ts).
 */

import type { Team, Match } from '@wc2026/shared';

const ELO_D = 600;          // FIFA SUM win-prob denominator
const I_GROUP = 50;         // WC group-stage importance
const I_KNOCKOUT = 60;      // WC knockout-stage importance
const ELO_LAMBDA_D = 1500;  // tuned so Poisson win-prob ≈ FIFA /600 win-prob

export function eloWinProb(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / ELO_D));
}

/** strength → attackRating = defenseRating, so lambda = baseRate × sA / sB = baseRate × 10^((eloA−eloB)/1500) */
export function strengthFromElo(elo: number): number {
  return Math.pow(10, (elo - 1500) / ELO_LAMBDA_D);
}

/** FIFA SUM rating update: ΔP = I × (W − We). No goal-difference term. */
function updateElo(elo: number, opponentElo: number, w: number, importance: number): number {
  const we = eloWinProb(elo, opponentElo);
  return elo + importance * (w - we);
}

/**
 * Resolve the FIFA SUM actual-result values (W) for both teams from a finished
 * match. Knockout matches decided by a penalty shootout use 0.75 / 0.5;
 * everything else uses win 1.0 / draw 0.5 / loss 0.0 on the (post-ET) score.
 */
function resultW(m: Match): { homeW: number; awayW: number } | null {
  // Penalty shootout (knockout only): pens present and stored separately.
  if (m.homePens != null && m.awayPens != null && m.homePens !== m.awayPens) {
    const homeWon = m.homePens > m.awayPens;
    return homeWon ? { homeW: 0.75, awayW: 0.5 } : { homeW: 0.5, awayW: 0.75 };
  }

  // Use after-extra-time goals when available, else the regulation score.
  const homeGoals = m.homeGoalsAet ?? m.homeGoals;
  const awayGoals = m.awayGoalsAet ?? m.awayGoals;
  if (homeGoals == null || awayGoals == null) return null;

  if (homeGoals > awayGoals) return { homeW: 1.0, awayW: 0.0 };
  if (homeGoals < awayGoals) return { homeW: 0.0, awayW: 1.0 };
  return { homeW: 0.5, awayW: 0.5 };
}

/**
 * Apply in-tournament FIFA SUM updates from finished WC matches.
 * Automatically re-derives attackRating/defenseRating from updated ratings.
 */
export function applyInTournamentUpdates(
  teams: Map<string, Team>,
  finishedMatches: Match[],
): void {
  for (const m of finishedMatches) {
    const home = teams.get(m.homeId);
    const away = teams.get(m.awayId);
    if (!home || !away) continue;

    const w = resultW(m);
    if (!w) continue;

    const importance = m.stage === 'group' ? I_GROUP : I_KNOCKOUT;

    const prevHomeElo = home.rankingElo;
    const prevAwayElo = away.rankingElo;

    home.rankingElo = updateElo(prevHomeElo, prevAwayElo, w.homeW, importance);
    away.rankingElo = updateElo(prevAwayElo, prevHomeElo, w.awayW, importance);

    // Re-derive attack/defense so the Poisson model stays consistent
    home.attackRating  = strengthFromElo(home.rankingElo);
    home.defenseRating = strengthFromElo(home.rankingElo);
    away.attackRating  = strengthFromElo(away.rankingElo);
    away.defenseRating = strengthFromElo(away.rankingElo);
  }
}

/**
 * Regress all ratings toward the field mean.
 *
 * adjustedElo = mean + factor × (rawElo − mean)
 *
 * A factor of 0.90 shrinks 10% of the distance to the mean, reducing
 * overconfidence in extreme ratings while preserving relative ordering.
 * This models the observation that pre-tournament ratings contain noise
 * and the gap between the best and worst teams is often overstated.
 *
 * NOTE: FIFA points are already a compressed scale; combined with the /600
 * curve this regression can over-flatten favorites. Consider ELO_REGRESSION=1.0
 * (no regression) when running in FIFA mode.
 */
export function regressEloToMean(
  teams: Map<string, Team>,
  factor: number,
): void {
  if (factor >= 1.0) return; // no-op

  const elos = [...teams.values()].map(t => t.rankingElo);
  const mean = elos.reduce((a, b) => a + b, 0) / elos.length;

  for (const team of teams.values()) {
    team.rankingElo = mean + factor * (team.rankingElo - mean);
    team.attackRating  = strengthFromElo(team.rankingElo);
    team.defenseRating = strengthFromElo(team.rankingElo);
  }
}
