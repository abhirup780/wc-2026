// ─── Canonical data model ────────────────────────────────────────────────────
// All adapters must map their provider responses into these types.
// The simulation and UI depend ONLY on these types.

export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | '3rd' | 'final';
export type MatchStatus = 'scheduled' | 'live' | 'finished';

export interface Team {
  id: string;           // 3-letter FIFA code, e.g. "MEX"
  name: string;         // Full name, e.g. "Mexico"
  code: string;         // Same as id by convention
  groupId: string;      // "A" through "L"
  rankingElo: number;   // Elo-based strength rating
  attackRating: number; // Derived from Elo; multiplier around 1.0
  defenseRating: number;
}

export interface Match {
  id: string;
  stage: Stage;
  groupId: string | null;  // null for knockout
  homeId: string;
  awayId: string;
  kickoffUtc: string;      // ISO 8601
  status: MatchStatus;
  homeGoals: number | null;
  awayGoals: number | null;
  // Knockout only – goals after extra time (pens not included in goal total)
  homeGoalsAet?: number | null;
  awayGoalsAet?: number | null;
  homePens?: number | null;
  awayPens?: number | null;
}

export interface GroupStanding {
  groupId: string;
  teamId: string;
  played: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

// ─── Forecast types ──────────────────────────────────────────────────────────

export interface TeamForecast {
  teamId: string;
  name: string;
  code: string;
  groupId: string;
  pWinGroup: number;
  pAdvanceGroup: number; // top-2 or best-3rd
  pReachR16: number;
  pReachQF: number;
  pReachSF: number;
  pReachFinal: number;
  pChampion: number;
  /** Pre-tournament baseline champion probability (initial Elo, no match results) */
  pChampionInitial?: number;
}

export interface Forecast {
  teams: TeamForecast[];
  championDistribution: Record<string, number>; // teamId → probability
  modelConfig: ModelConfig;
  simCount: number;
  seed: number;
  dataSnapshotTimestamp: string;
  generatedAt: string;
}

export interface ModelConfig {
  type: 'poisson' | 'elo';
  baseGoalsRate: number;  // avg expected goals per team per match
  blendOddsWeight: number; // 0 = ignore odds, 1 = use only odds
  /** Multiplier for knockout-stage goal rate (e.g. 0.85 = 15% fewer goals). */
  knockoutGoalsMultiplier: number;
  /** Per-iteration strength noise σ. Models "good/bad day" form variance (e.g. 0.05). */
  formVolatility: number;
  /** Shrinkage factor toward field Elo mean before simulation (e.g. 0.90). 1.0 = no regression. */
  eloRegressionFactor: number;
}

// ─── Artifact shapes (written by job, read by frontend) ─────────────────────

// ─── Deterministic tournament prediction ─────────────────────────────────────

export interface PredictedMatch {
  id: string;
  stage: Stage;
  groupId: string | null;
  homeId: string;
  awayId: string;
  kickoffUtc: string;
  /** Expected goals (Poisson λ) — may be fractional */
  homeXg: number;
  awayXg: number;
  /** Rounded predicted score */
  homeGoals: number;
  awayGoals: number;
  /** KO only — code of predicted winner (higher-Elo team wins ties) */
  winnerId?: string;
}

export interface Prediction {
  matches: PredictedMatch[];
  champion: string;
  generatedAt: string;
}

export interface Meta {
  dataSource: string;
  lastUpdated: string;   // ISO 8601
  seed: number;
  simCount: number;
  version: string;
}

// ─── Upcoming-match predictions (model 1X2 blended with bookmaker odds) ───────

export interface UpcomingMatch {
  id: string;
  stage: Stage;
  groupId: string | null;
  homeId: string;
  awayId: string;
  kickoffUtc: string;
  /** Model expected goals (Poisson λ) */
  homeXg: number;
  awayXg: number;
  /** Outcome probabilities — blended with market odds when available, else model-only. Sum to 1. */
  pHome: number;
  pDraw: number;
  pAway: number;
  /** True when bookmaker odds were blended into the probabilities above. */
  marketBlended: boolean;
}

export interface Upcoming {
  timestamp: string;
  /** Market weight used in the blend (0 = model only). */
  blendWeight: number;
  matches: UpcomingMatch[];
}

export interface Scores {
  timestamp: string;
  matches: Match[];
}

export interface Fixtures {
  teams: Team[];
  matches: Match[];
  groups: string[];  // ["A", "B", ..., "L"]
}

export interface Standings {
  timestamp: string;
  groups: Record<string, GroupStanding[]>; // groupId → sorted standings
}

// ─── Knockout bracket — single source of truth (job + frontend dice sim) ──────
// Defined here (not a separate file) so every toolchain — tsc, Vite, vitest and
// tsx — resolves it via the one `@wc2026/shared` entry. R32 match numbers 73–88
// are the official FIFA numbers; R16 pairings 89–96 follow the official bracket.

export type Slot = string;

export interface R32Match {
  id: string;
  num: number;
  slot1: Slot;  // "2A", "1E", "3-ABCDF", etc.
  slot2: Slot;
}

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

// R32 index map: OFB-73→R32-01 … OFB-88→R32-16 (sequential).
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

/** The 8 third-placed pool slots, in R32 assignment order. */
export const BEST_THIRD_POOLS = [
  '3-ABCDF', '3-CDFGH', '3-CEFHI', '3-EHIJK',
  '3-BEFIJ', '3-AEHIJ', '3-EFGIJ', '3-DEIJL',
] as const;

export function resolveSlot(
  slot: Slot,
  groupResults: Map<string, string>,
  bestThirdAssignment: Map<string, string>,
): string | null {
  if (slot.startsWith('3-')) return bestThirdAssignment.get(slot) ?? null;
  return groupResults.get(slot) ?? null;
}

/**
 * Assign the 8 best third-placed teams to the 8 R32 third-placed slots.
 * FIFA's published table is keyed on which groups produced the qualifying
 * thirds (not yet released), so we assign best-8 in rank order to the pools in
 * order — every pool always gets a team and bracket geometry doesn't bias the
 * aggregate probabilities.
 */
export function assignBestThird(
  bestThird: Array<{ teamId: string; groupId: string }>,
): Map<string, string> {
  const map = new Map<string, string>();
  BEST_THIRD_POOLS.forEach((pool, i) => {
    if (bestThird[i]) map.set(pool, bestThird[i].teamId);
  });
  return map;
}

export interface ThirdPlaced extends GroupStanding {
  rank: number; // 1 = best among all 3rd-placed, 8 = last qualifier
}

function compareThird(a: GroupStanding, b: GroupStanding): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return 0; // resolved by lots
}

function fisherYates<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Return the 8 best third-placed teams (FIFA criteria), best-to-worst, ranked. */
export function selectBestThird(
  thirdPlaced: GroupStanding[],
  rng: () => number,
): ThirdPlaced[] {
  const shuffled = fisherYates([...thirdPlaced], rng); // randomise lots first
  shuffled.sort(compareThird);                          // stable sort keeps shuffle on ties
  return shuffled.slice(0, 8).map((s, i) => ({ ...s, rank: i + 1 }));
}
