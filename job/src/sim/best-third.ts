/**
 * Best third-placed team selection for WC 2026.
 *
 * After the group stage, one team finishes 3rd in each of 12 groups (A–L).
 * The 8 best third-placed teams advance to the Round of 32.
 *
 * FIFA ranking criteria among 3rd-placed teams:
 *   1. Points
 *   2. Goal difference
 *   3. Goals scored
 *   4. Fair play (not modelled – omitted)
 *   5. Drawing of lots (seeded RNG)
 *
 * Reference: FIFA WC 2026 Competition Regulations.
 */

import type { GroupStanding } from '@wc2026/shared';

export interface ThirdPlaced extends GroupStanding {
  rank: number; // 1 = best among all 3rd-placed, 8 = last qualifier
}

function compareThird(a: GroupStanding, b: GroupStanding): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return 0; // resolved by lots
}

/**
 * Given a list where each entry is the 3rd-placed team from one group,
 * return the 8 best, sorted best-to-worst with a rank field.
 * Ties are broken by the seeded RNG.
 */
export function selectBestThird(
  thirdPlaced: GroupStanding[],
  rng: () => number,
): ThirdPlaced[] {
  // Shuffle first to randomise lots, then sort by criteria (stable sort preserves shuffle order for equal elements)
  const shuffled = fisherYates([...thirdPlaced], rng);
  shuffled.sort(compareThird);
  return shuffled.slice(0, 8).map((s, i) => ({ ...s, rank: i + 1 }));
}

function fisherYates<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
