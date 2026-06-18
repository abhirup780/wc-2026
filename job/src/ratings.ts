/**
 * In-tournament Elo updates using the eloratings.net methodology:
 *   K  = 60  (FIFA World Cup)
 *   G  = goal-difference multiplier (1 / 1.5 / (11+N)/8)
 *   We = 1 / (1 + 10^(-Δ/400))
 *   ΔElo = K × G × (W − We)
 *
 * After each Elo update, attackRating and defenseRating are re-derived from
 * the new Elo so the Poisson model stays calibrated to the Elo scale.
 *
 * Formula: strength = 10^((elo − 1500) / 1200)
 *   → lambdaA_vs_B = baseRate × strengthA / strengthB
 *                  = baseRate × 10^((eloA − eloB) / 1200)
 *
 * No hand-coded attack/defense values anywhere — ratings come solely from Elo.
 */

import type { Team, Match } from '@wc2026/shared';

const ELO_K = 60;   // WC finals — eloratings.net uses 60
const ELO_D = 400;
const ELO_LAMBDA_D = 1000; // calibrated so Poisson win-prob ≈ Elo win-prob (reduced upsets)

export function eloWinProb(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / ELO_D));
}

/** eloratings.net goal-difference multiplier */
function goalDiffMultiplier(gd: number): number {
  if (gd <= 1) return 1.0;
  if (gd === 2) return 1.5;
  return (11 + gd) / 8;
}

/** strength → attackRating = defenseRating, so lambda = baseRate × sA / sB = baseRate × 10^((eloA−eloB)/1200) */
export function strengthFromElo(elo: number): number {
  return Math.pow(10, (elo - 1500) / ELO_LAMBDA_D);
}

function updateElo(elo: number, opponentElo: number, score: number, goalDiff: number): number {
  const we = eloWinProb(elo, opponentElo);
  const g  = goalDiffMultiplier(Math.abs(goalDiff));
  return elo + ELO_K * g * (score - we);
}

/**
 * Apply in-tournament Elo updates from finished WC matches.
 * Automatically re-derives attackRating/defenseRating from updated Elo.
 */
export function applyInTournamentUpdates(
  teams: Map<string, Team>,
  finishedMatches: Match[],
): void {
  for (const m of finishedMatches) {
    if (m.homeGoals == null || m.awayGoals == null) continue;
    const home = teams.get(m.homeId);
    const away = teams.get(m.awayId);
    if (!home || !away) continue;

    const homeScore = m.homeGoals > m.awayGoals ? 1 : m.homeGoals < m.awayGoals ? 0 : 0.5;
    const gd = m.homeGoals - m.awayGoals;

    const prevHomeElo = home.rankingElo;
    const prevAwayElo = away.rankingElo;

    home.rankingElo = updateElo(prevHomeElo, prevAwayElo, homeScore,      gd);
    away.rankingElo = updateElo(prevAwayElo, prevHomeElo, 1 - homeScore, -gd);

    // Re-derive attack/defense so the Poisson model stays consistent
    home.attackRating  = strengthFromElo(home.rankingElo);
    home.defenseRating = strengthFromElo(home.rankingElo);
    away.attackRating  = strengthFromElo(away.rankingElo);
    away.defenseRating = strengthFromElo(away.rankingElo);
  }
}
