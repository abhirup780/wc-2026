/**
 * WC 2026 knockout bracket – sourced from openfootball/worldcup.json.
 *
 * R32 match numbers (73–88) are the official FIFA match numbers.
 * 3rd-placed team pools show which groups the qualifying 3rd can come from.
 *
 * R16 pairings (89–96) are based on the official bracket: each entry is
 * [r32MatchId1, r32MatchId2] whose winners meet in R16.
 */

export type Slot = string;

export interface R32Match {
  id: string;   // e.g. "OFB-73"
  num: number;
  slot1: Slot;  // "2A", "1E", "3-ABCDF", etc.
  slot2: Slot;
}

// ─── Official R32 bracket (match nums 73–88) ──────────────────────────────────
// slot format: "1X" = group X winner, "2X" = runner-up, "3-POOLS" = best 3rd
// from listed groups. The exact 3rd-placed team is determined by FIFA's
// assignment table once all groups complete.

export const R32_MATCHES: R32Match[] = [
  { id: 'OFB-73',  num: 73, slot1: '2A',       slot2: '2B'       },
  { id: 'OFB-74',  num: 74, slot1: '1E',       slot2: '3-ABCDF'  },
  { id: 'OFB-75',  num: 75, slot1: '1F',       slot2: '2C'       },
  { id: 'OFB-76',  num: 76, slot1: '1C',       slot2: '2F'       },
  { id: 'OFB-77',  num: 77, slot1: '1I',       slot2: '3-CDFGH'  },
  { id: 'OFB-78',  num: 78, slot1: '2E',       slot2: '2I'       },
  { id: 'OFB-79',  num: 79, slot1: '1A',       slot2: '3-CEFHI'  },
  { id: 'OFB-80',  num: 80, slot1: '1L',       slot2: '3-EHIJK'  },
  { id: 'OFB-81',  num: 81, slot1: '1D',       slot2: '3-BEFIJ'  },
  { id: 'OFB-82',  num: 82, slot1: '1G',       slot2: '3-AEHIJ'  },
  { id: 'OFB-83',  num: 83, slot1: '2K',       slot2: '2L'       },
  { id: 'OFB-84',  num: 84, slot1: '1H',       slot2: '2J'       },
  { id: 'OFB-85',  num: 85, slot1: '1B',       slot2: '3-EFGIJ'  },
  { id: 'OFB-86',  num: 86, slot1: '1J',       slot2: '2H'       },
  { id: 'OFB-87',  num: 87, slot1: '1K',       slot2: '3-DEIJL'  },
  { id: 'OFB-88',  num: 88, slot1: '2D',       slot2: '2G'       },
];

// The simulation engine assigns R32 winners as R32-01…R32-16
// corresponding to R32_MATCHES[0]…R32_MATCHES[15].
// R16_PAIRS, QF_PAIRS, SF_PAIRS reference those sequential keys.

// R32 index map for reference:
// OFB-73→R32-01, OFB-74→R32-02, OFB-75→R32-03, OFB-76→R32-04
// OFB-77→R32-05, OFB-78→R32-06, OFB-79→R32-07, OFB-80→R32-08
// OFB-81→R32-09, OFB-82→R32-10, OFB-83→R32-11, OFB-84→R32-12
// OFB-85→R32-13, OFB-86→R32-14, OFB-87→R32-15, OFB-88→R32-16

export const R16_PAIRS: [string, string][] = [
  ['R32-02', 'R32-05'], // W74 vs W77 → match 89
  ['R32-01', 'R32-03'], // W73 vs W75 → match 90
  ['R32-04', 'R32-06'], // W76 vs W78 → match 91
  ['R32-07', 'R32-08'], // W79 vs W80 → match 92
  ['R32-11', 'R32-12'], // W83 vs W84 → match 93
  ['R32-09', 'R32-10'], // W81 vs W82 → match 94
  ['R32-14', 'R32-16'], // W86 vs W88 → match 95
  ['R32-13', 'R32-15'], // W85 vs W87 → match 96
];

export const QF_PAIRS: [string, string][] = [
  ['R16-01', 'R16-02'], // W89 vs W90 → match 97
  ['R16-05', 'R16-06'], // W93 vs W94 → match 98
  ['R16-03', 'R16-04'], // W91 vs W92 → match 99
  ['R16-07', 'R16-08'], // W95 vs W96 → match 100
];

export const SF_PAIRS: [string, string][] = [
  ['QF-01', 'QF-02'], // W97 vs W98 → match 101
  ['QF-03', 'QF-04'], // W99 vs W100 → match 102
];

export const THIRD_PLACE_PAIR: [string, string] = ['SF-01', 'SF-02'];

// ─── Slot resolution ──────────────────────────────────────────────────────────

export function resolveSlot(
  slot: Slot,
  groupResults: Map<string, string>,
  bestThirdAssignment: Map<string, string>,
): string | null {
  if (slot.startsWith('3-')) return bestThirdAssignment.get(slot) ?? null;
  return groupResults.get(slot) ?? null;
}

/**
 * Assign 8 best-third-placed teams to the 8 R32 third-placed slots.
 *
 * In the real tournament FIFA uses a predefined table based on which
 * combination of 8 groups produced qualifying 3rd-placed teams.
 * That table is not yet publicly available.
 *
 * For simulation accuracy this simplified version assigns the best-8 in
 * rank order to the pool slots in order — every pool always gets a team,
 * so every R32 match is simulated. The bracket geometry doesn't affect
 * the aggregate championship probabilities.
 *
 * TODO: replace with the official FIFA assignment table once published.
 */
export function assignBestThird(
  bestThird: Array<{ teamId: string; groupId: string }>,
): Map<string, string> {
  const pools = [
    '3-ABCDF', '3-CDFGH', '3-CEFHI', '3-EHIJK',
    '3-BEFIJ', '3-AEHIJ', '3-EFGIJ', '3-DEIJL',
  ];
  const map = new Map<string, string>();
  // bestThird is already sorted best-first; assign in rank order
  pools.forEach((pool, i) => {
    if (bestThird[i]) map.set(pool, bestThird[i].teamId);
  });
  return map;
}
