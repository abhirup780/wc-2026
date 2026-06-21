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
  /** Model-only champion probability (Monte Carlo, before market blending) */
  pChampionModel?: number;
  /** Market-only champion probability (bookmaker outright odds, normalised) */
  pChampionMarket?: number;
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

// ─── R32 matchup projection (Monte-Carlo over remaining group games) ─────────
// Global ranking: across all 16 R32 slots and all sims, how often each exact
// two-team pairing materialises. Ranked high→low; `prob` is the probability
// those two teams meet anywhere in the Round of 32.

export interface R32Matchup {
  home: string;         // favourite (higher Elo) team code
  away: string;
  homeName: string;
  awayName: string;
  prob: number;         // P(these two teams meet in R32)
  homeWinProb: number;  // Elo head-to-head P(home advances)
}

export interface R32Projection {
  generatedAt: string;
  simCount: number;
  remainingGroupMatches: number;
  distinctMatchups: number;   // total distinct pairings seen across sims
  matchups: R32Matchup[];     // ranked high→low (top N)
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
 * Third-placed → R32-slot assignment.
 *
 * Uses FIFA's official Annex C table — the 495 combinations of which 8 of the 12
 * groups' third-placed teams qualify. Each combination maps the qualifying
 * thirds to the 8 group-winner slots that face a third. Falls back to rank-order
 * assignment when the combination isn't found (e.g. before all groups finish).
 */

// Column order of THIRD_PLACE_TABLE values (winner slots that face a 3rd).
const THIRD_WINNER_ORDER = ['1A', '1B', '1D', '1E', '1G', '1I', '1K', '1L'] as const;

// R32 third-placed pool slot → the group winner it faces (from R32_MATCHES).
const POOL_TO_WINNER: Record<string, string> = {
  '3-ABCDF': '1E', '3-CDFGH': '1I', '3-CEFHI': '1A', '3-EHIJK': '1L',
  '3-AEHIJ': '1G', '3-BEFIJ': '1D', '3-EFGIJ': '1B', '3-DEIJL': '1K',
};

/**
 * Official Annex C lookup: key = the 8 qualifying groups sorted (e.g. "ABCDEFGH"),
 * value = third-placed group assigned to each winner slot in THIRD_WINNER_ORDER.
 */
export const THIRD_PLACE_TABLE: Record<string, string> = {
  ABCDEFGH:'HGBCAFDE', ABCDEFGI:'CGBDAFEI', ABCDEFGJ:'CGBDAFEJ', ABCDEFGK:'CGBDAFEK', ABCDEFGL:'CGBDAFLE', ABCDEFHI:'HEBCAFDI',
  ABCDEFHJ:'HJBCAFDE', ABCDEFHK:'HEBCAFDK', ABCDEFHL:'HFBCADLE', ABCDEFIJ:'CJBDAFEI', ABCDEFIK:'CEBDAFIK', ABCDEFIL:'CEBDAFLI',
  ABCDEFJK:'CJBDAFEK', ABCDEFJL:'CJBDAFLE', ABCDEFKL:'CEBDAFLK', ABCDEGHI:'HGBCADEI', ABCDEGHJ:'HGBCADEJ', ABCDEGHK:'HGBCADEK',
  ABCDEGHL:'HGBCADLE', ABCDEGIJ:'EGBCADIJ', ABCDEGIK:'EGBCADIK', ABCDEGIL:'EGBCADLI', ABCDEGJK:'EGBCADJK', ABCDEGJL:'EGBCADLJ',
  ABCDEGKL:'EGBCADLK', ABCDEHIJ:'HJBCADEI', ABCDEHIK:'HEBCADIK', ABCDEHIL:'HEBCADLI', ABCDEHJK:'HJBCADEK', ABCDEHJL:'HJBCADLE',
  ABCDEHKL:'HEBCADLK', ABCDEIJK:'EJBCADIK', ABCDEIJL:'EJBCADLI', ABCDEIKL:'EIBCADLK', ABCDEJKL:'EJBCADLK', ABCDFGHI:'HGBCAFDI',
  ABCDFGHJ:'HGBCAFDJ', ABCDFGHK:'HGBCAFDK', ABCDFGHL:'CGBDAFLH', ABCDFGIJ:'CGBDAFIJ', ABCDFGIK:'CGBDAFIK', ABCDFGIL:'CGBDAFLI',
  ABCDFGJK:'CGBDAFJK', ABCDFGJL:'CGBDAFLJ', ABCDFGKL:'CGBDAFLK', ABCDFHIJ:'HJBCAFDI', ABCDFHIK:'HFBCADIK', ABCDFHIL:'HFBCADLI',
  ABCDFHJK:'HJBCAFDK', ABCDFHJL:'CJBDAFLH', ABCDFHKL:'HFBCADLK', ABCDFIJK:'CJBDAFIK', ABCDFIJL:'CJBDAFLI', ABCDFIKL:'CIBDAFLK',
  ABCDFJKL:'CJBDAFLK', ABCDGHIJ:'HGBCADIJ', ABCDGHIK:'HGBCADIK', ABCDGHIL:'HGBCADLI', ABCDGHJK:'HGBCADJK', ABCDGHJL:'HGBCADLJ',
  ABCDGHKL:'HGBCADLK', ABCDGIJK:'CJBDAGIK', ABCDGIJL:'CJBDAGLI', ABCDGIKL:'IGBCADLK', ABCDGJKL:'CJBDAGLK', ABCDHIJK:'HJBCADIK',
  ABCDHIJL:'HJBCADLI', ABCDHIKL:'HIBCADLK', ABCDHJKL:'HJBCADLK', ABCDIJKL:'IJBCADLK', ABCEFGHI:'HGBCAFEI', ABCEFGHJ:'HGBCAFEJ',
  ABCEFGHK:'HGBCAFEK', ABCEFGHL:'HGBCAFLE', ABCEFGIJ:'EGBCAFIJ', ABCEFGIK:'EGBCAFIK', ABCEFGIL:'EGBCAFLI', ABCEFGJK:'EGBCAFJK',
  ABCEFGJL:'EGBCAFLJ', ABCEFGKL:'EGBCAFLK', ABCEFHIJ:'HJBCAFEI', ABCEFHIK:'HEBCAFIK', ABCEFHIL:'HEBCAFLI', ABCEFHJK:'HJBCAFEK',
  ABCEFHJL:'HJBCAFLE', ABCEFHKL:'HEBCAFLK', ABCEFIJK:'EJBCAFIK', ABCEFIJL:'EJBCAFLI', ABCEFIKL:'EIBCAFLK', ABCEFJKL:'EJBCAFLK',
  ABCEGHIJ:'HJBCAGEI', ABCEGHIK:'EGBCAHIK', ABCEGHIL:'EGBCAHLI', ABCEGHJK:'HJBCAGEK', ABCEGHJL:'HJBCAGLE', ABCEGHKL:'EGBCAHLK',
  ABCEGIJK:'EJBCAGIK', ABCEGIJL:'EJBCAGLI', ABCEGIKL:'EGBAICLK', ABCEGJKL:'EJBCAGLK', ABCEHIJK:'EJBCAHIK', ABCEHIJL:'EJBCAHLI',
  ABCEHIKL:'EIBCAHLK', ABCEHJKL:'EJBCAHLK', ABCEIJKL:'EJBAICLK', ABCFGHIJ:'HGBCAFIJ', ABCFGHIK:'HGBCAFIK', ABCFGHIL:'HGBCAFLI',
  ABCFGHJK:'HGBCAFJK', ABCFGHJL:'HGBCAFLJ', ABCFGHKL:'HGBCAFLK', ABCFGIJK:'CJBFAGIK', ABCFGIJL:'CJBFAGLI', ABCFGIKL:'IGBCAFLK',
  ABCFGJKL:'CJBFAGLK', ABCFHIJK:'HJBCAFIK', ABCFHIJL:'HJBCAFLI', ABCFHIKL:'HIBCAFLK', ABCFHJKL:'HJBCAFLK', ABCFIJKL:'IJBCAFLK',
  ABCGHIJK:'HJBCAGIK', ABCGHIJL:'HJBCAGLI', ABCGHIKL:'IGBCAHLK', ABCGHJKL:'HJBCAGLK', ABCGIJKL:'IJBCAGLK', ABCHIJKL:'IJBCAHLK',
  ABDEFGHI:'HGBDAFEI', ABDEFGHJ:'HGBDAFEJ', ABDEFGHK:'HGBDAFEK', ABDEFGHL:'HGBDAFLE', ABDEFGIJ:'EGBDAFIJ', ABDEFGIK:'EGBDAFIK',
  ABDEFGIL:'EGBDAFLI', ABDEFGJK:'EGBDAFJK', ABDEFGJL:'EGBDAFLJ', ABDEFGKL:'EGBDAFLK', ABDEFHIJ:'HJBDAFEI', ABDEFHIK:'HEBDAFIK',
  ABDEFHIL:'HEBDAFLI', ABDEFHJK:'HJBDAFEK', ABDEFHJL:'HJBDAFLE', ABDEFHKL:'HEBDAFLK', ABDEFIJK:'EJBDAFIK', ABDEFIJL:'EJBDAFLI',
  ABDEFIKL:'EIBDAFLK', ABDEFJKL:'EJBDAFLK', ABDEGHIJ:'HJBDAGEI', ABDEGHIK:'EGBDAHIK', ABDEGHIL:'EGBDAHLI', ABDEGHJK:'HJBDAGEK',
  ABDEGHJL:'HJBDAGLE', ABDEGHKL:'EGBDAHLK', ABDEGIJK:'EJBDAGIK', ABDEGIJL:'EJBDAGLI', ABDEGIKL:'EGBAIDLK', ABDEGJKL:'EJBDAGLK',
  ABDEHIJK:'EJBDAHIK', ABDEHIJL:'EJBDAHLI', ABDEHIKL:'EIBDAHLK', ABDEHJKL:'EJBDAHLK', ABDEIJKL:'EJBAIDLK', ABDFGHIJ:'HGBDAFIJ',
  ABDFGHIK:'HGBDAFIK', ABDFGHIL:'HGBDAFLI', ABDFGHJK:'HGBDAFJK', ABDFGHJL:'HGBDAFLJ', ABDFGHKL:'HGBDAFLK', ABDFGIJK:'FJBDAGIK',
  ABDFGIJL:'FJBDAGLI', ABDFGIKL:'IGBDAFLK', ABDFGJKL:'FJBDAGLK', ABDFHIJK:'HJBDAFIK', ABDFHIJL:'HJBDAFLI', ABDFHIKL:'HIBDAFLK',
  ABDFHJKL:'HJBDAFLK', ABDFIJKL:'IJBDAFLK', ABDGHIJK:'HJBDAGIK', ABDGHIJL:'HJBDAGLI', ABDGHIKL:'IGBDAHLK', ABDGHJKL:'HJBDAGLK',
  ABDGIJKL:'IJBDAGLK', ABDHIJKL:'IJBDAHLK', ABEFGHIJ:'HJBFAGEI', ABEFGHIK:'EGBFAHIK', ABEFGHIL:'EGBFAHLI', ABEFGHJK:'HJBFAGEK',
  ABEFGHJL:'HJBFAGLE', ABEFGHKL:'EGBFAHLK', ABEFGIJK:'EJBFAGIK', ABEFGIJL:'EJBFAGLI', ABEFGIKL:'EGBAIFLK', ABEFGJKL:'EJBFAGLK',
  ABEFHIJK:'EJBFAHIK', ABEFHIJL:'EJBFAHLI', ABEFHIKL:'EIBFAHLK', ABEFHJKL:'EJBFAHLK', ABEFIJKL:'EJBAIFLK', ABEGHIJK:'EJBAHGIK',
  ABEGHIJL:'EJBAHGLI', ABEGHIKL:'EGBAIHLK', ABEGHJKL:'EJBAHGLK', ABEGIJKL:'EJBAIGLK', ABEHIJKL:'EJBAIHLK', ABFGHIJK:'HJBFAGIK',
  ABFGHIJL:'HJBFAGLI', ABFGHIKL:'HGBAIFLK', ABFGHJKL:'HJBFAGLK', ABFGIJKL:'IJBFAGLK', ABFHIJKL:'HJBAIFLK', ABGHIJKL:'HJBAIGLK',
  ACDEFGHI:'HGECAFDI', ACDEFGHJ:'HGJCAFDE', ACDEFGHK:'HGECAFDK', ACDEFGHL:'HGFCADLE', ACDEFGIJ:'CGJDAFEI', ACDEFGIK:'CGEDAFIK',
  ACDEFGIL:'CGEDAFLI', ACDEFGJK:'CGJDAFEK', ACDEFGJL:'CGJDAFLE', ACDEFGKL:'CGEDAFLK', ACDEFHIJ:'HJECAFDI', ACDEFHIK:'HEFCADIK',
  ACDEFHIL:'HEFCADLI', ACDEFHJK:'HJECAFDK', ACDEFHJL:'HJFCADLE', ACDEFHKL:'HEFCADLK', ACDEFIJK:'CJEDAFIK', ACDEFIJL:'CJEDAFLI',
  ACDEFIKL:'CEIDAFLK', ACDEFJKL:'CJEDAFLK', ACDEGHIJ:'HGJCADEI', ACDEGHIK:'HGECADIK', ACDEGHIL:'HGECADLI', ACDEGHJK:'HGJCADEK',
  ACDEGHJL:'HGJCADLE', ACDEGHKL:'HGECADLK', ACDEGIJK:'EGJCADIK', ACDEGIJL:'EGJCADLI', ACDEGIKL:'EGICADLK', ACDEGJKL:'EGJCADLK',
  ACDEHIJK:'HJECADIK', ACDEHIJL:'HJECADLI', ACDEHIKL:'HEICADLK', ACDEHJKL:'HJECADLK', ACDEIJKL:'EJICADLK', ACDFGHIJ:'HGJCAFDI',
  ACDFGHIK:'HGFCADIK', ACDFGHIL:'HGFCADLI', ACDFGHJK:'HGJCAFDK', ACDFGHJL:'CGJDAFLH', ACDFGHKL:'HGFCADLK', ACDFGIJK:'CGJDAFIK',
  ACDFGIJL:'CGJDAFLI', ACDFGIKL:'CGIDAFLK', ACDFGJKL:'CGJDAFLK', ACDFHIJK:'HJFCADIK', ACDFHIJL:'HJFCADLI', ACDFHIKL:'HFICADLK',
  ACDFHJKL:'HJFCADLK', ACDFIJKL:'CJIDAFLK', ACDGHIJK:'HGJCADIK', ACDGHIJL:'HGJCADLI', ACDGHIKL:'HGICADLK', ACDGHJKL:'HGJCADLK',
  ACDGIJKL:'IGJCADLK', ACDHIJKL:'HJICADLK', ACEFGHIJ:'HGJCAFEI', ACEFGHIK:'HGECAFIK', ACEFGHIL:'HGECAFLI', ACEFGHJK:'HGJCAFEK',
  ACEFGHJL:'HGJCAFLE', ACEFGHKL:'HGECAFLK', ACEFGIJK:'EGJCAFIK', ACEFGIJL:'EGJCAFLI', ACEFGIKL:'EGICAFLK', ACEFGJKL:'EGJCAFLK',
  ACEFHIJK:'HJECAFIK', ACEFHIJL:'HJECAFLI', ACEFHIKL:'HEICAFLK', ACEFHJKL:'HJECAFLK', ACEFIJKL:'EJICAFLK', ACEGHIJK:'EGJCAHIK',
  ACEGHIJL:'EGJCAHLI', ACEGHIKL:'EGICAHLK', ACEGHJKL:'EGJCAHLK', ACEGIJKL:'EJICAGLK', ACEHIJKL:'EJICAHLK', ACFGHIJK:'HGJCAFIK',
  ACFGHIJL:'HGJCAFLI', ACFGHIKL:'HGICAFLK', ACFGHJKL:'HGJCAFLK', ACFGIJKL:'IGJCAFLK', ACFHIJKL:'HJICAFLK', ACGHIJKL:'HJICAGLK',
  ADEFGHIJ:'HGJDAFEI', ADEFGHIK:'HGEDAFIK', ADEFGHIL:'HGEDAFLI', ADEFGHJK:'HGJDAFEK', ADEFGHJL:'HGJDAFLE', ADEFGHKL:'HGEDAFLK',
  ADEFGIJK:'EGJDAFIK', ADEFGIJL:'EGJDAFLI', ADEFGIKL:'EGIDAFLK', ADEFGJKL:'EGJDAFLK', ADEFHIJK:'HJEDAFIK', ADEFHIJL:'HJEDAFLI',
  ADEFHIKL:'HEIDAFLK', ADEFHJKL:'HJEDAFLK', ADEFIJKL:'EJIDAFLK', ADEGHIJK:'EGJDAHIK', ADEGHIJL:'EGJDAHLI', ADEGHIKL:'EGIDAHLK',
  ADEGHJKL:'EGJDAHLK', ADEGIJKL:'EJIDAGLK', ADEHIJKL:'EJIDAHLK', ADFGHIJK:'HGJDAFIK', ADFGHIJL:'HGJDAFLI', ADFGHIKL:'HGIDAFLK',
  ADFGHJKL:'HGJDAFLK', ADFGIJKL:'IGJDAFLK', ADFHIJKL:'HJIDAFLK', ADGHIJKL:'HJIDAGLK', AEFGHIJK:'EGJFAHIK', AEFGHIJL:'EGJFAHLI',
  AEFGHIKL:'EGIFAHLK', AEFGHJKL:'EGJFAHLK', AEFGIJKL:'EJIFAGLK', AEFHIJKL:'EJIFAHLK', AEGHIJKL:'EJIAHGLK', AFGHIJKL:'HJIFAGLK',
  BCDEFGHI:'CGBDHFEI', BCDEFGHJ:'HGBCJFDE', BCDEFGHK:'CGBDHFEK', BCDEFGHL:'CGBDHFLE', BCDEFGIJ:'CGBDJFEI', BCDEFGIK:'CGBDEFIK',
  BCDEFGIL:'CGBDEFLI', BCDEFGJK:'CGBDJFEK', BCDEFGJL:'CGBDJFLE', BCDEFGKL:'CGBDEFLK', BCDEFHIJ:'CJBDHFEI', BCDEFHIK:'CEBDHFIK',
  BCDEFHIL:'CEBDHFLI', BCDEFHJK:'CJBDHFEK', BCDEFHJL:'CJBDHFLE', BCDEFHKL:'CEBDHFLK', BCDEFIJK:'CJBDEFIK', BCDEFIJL:'CJBDEFLI',
  BCDEFIKL:'CEBDIFLK', BCDEFJKL:'CJBDEFLK', BCDEGHIJ:'HGBCJDEI', BCDEGHIK:'EGBCHDIK', BCDEGHIL:'EGBCHDLI', BCDEGHJK:'HGBCJDEK',
  BCDEGHJL:'HGBCJDLE', BCDEGHKL:'EGBCHDLK', BCDEGIJK:'EGBCJDIK', BCDEGIJL:'EGBCJDLI', BCDEGIKL:'EGBCIDLK', BCDEGJKL:'EGBCJDLK',
  BCDEHIJK:'EJBCHDIK', BCDEHIJL:'EJBCHDLI', BCDEHIKL:'EIBCHDLK', BCDEHJKL:'EJBCHDLK', BCDEIJKL:'EJBCIDLK', BCDFGHIJ:'HGBCJFDI',
  BCDFGHIK:'CGBDHFIK', BCDFGHIL:'CGBDHFLI', BCDFGHJK:'HGBCJFDK', BCDFGHJL:'CGBDHFLJ', BCDFGHKL:'CGBDHFLK', BCDFGIJK:'CGBDJFIK',
  BCDFGIJL:'CGBDJFLI', BCDFGIKL:'CGBDIFLK', BCDFGJKL:'CGBDJFLK', BCDFHIJK:'CJBDHFIK', BCDFHIJL:'CJBDHFLI', BCDFHIKL:'CIBDHFLK',
  BCDFHJKL:'CJBDHFLK', BCDFIJKL:'CJBDIFLK', BCDGHIJK:'HGBCJDIK', BCDGHIJL:'HGBCJDLI', BCDGHIKL:'HGBCIDLK', BCDGHJKL:'HGBCJDLK',
  BCDGIJKL:'IGBCJDLK', BCDHIJKL:'HJBCIDLK', BCEFGHIJ:'HGBCJFEI', BCEFGHIK:'EGBCHFIK', BCEFGHIL:'EGBCHFLI', BCEFGHJK:'HGBCJFEK',
  BCEFGHJL:'HGBCJFLE', BCEFGHKL:'EGBCHFLK', BCEFGIJK:'EGBCJFIK', BCEFGIJL:'EGBCJFLI', BCEFGIKL:'EGBCIFLK', BCEFGJKL:'EGBCJFLK',
  BCEFHIJK:'EJBCHFIK', BCEFHIJL:'EJBCHFLI', BCEFHIKL:'EIBCHFLK', BCEFHJKL:'EJBCHFLK', BCEFIJKL:'EJBCIFLK', BCEGHIJK:'EJBCHGIK',
  BCEGHIJL:'EJBCHGLI', BCEGHIKL:'EGBCIHLK', BCEGHJKL:'EJBCHGLK', BCEGIJKL:'EJBCIGLK', BCEHIJKL:'EJBCIHLK', BCFGHIJK:'HGBCJFIK',
  BCFGHIJL:'HGBCJFLI', BCFGHIKL:'HGBCIFLK', BCFGHJKL:'HGBCJFLK', BCFGIJKL:'IGBCJFLK', BCFHIJKL:'HJBCIFLK', BCGHIJKL:'HJBCIGLK',
  BDEFGHIJ:'HGBDJFEI', BDEFGHIK:'EGBDHFIK', BDEFGHIL:'EGBDHFLI', BDEFGHJK:'HGBDJFEK', BDEFGHJL:'HGBDJFLE', BDEFGHKL:'EGBDHFLK',
  BDEFGIJK:'EGBDJFIK', BDEFGIJL:'EGBDJFLI', BDEFGIKL:'EGBDIFLK', BDEFGJKL:'EGBDJFLK', BDEFHIJK:'EJBDHFIK', BDEFHIJL:'EJBDHFLI',
  BDEFHIKL:'EIBDHFLK', BDEFHJKL:'EJBDHFLK', BDEFIJKL:'EJBDIFLK', BDEGHIJK:'EJBDHGIK', BDEGHIJL:'EJBDHGLI', BDEGHIKL:'EGBDIHLK',
  BDEGHJKL:'EJBDHGLK', BDEGIJKL:'EJBDIGLK', BDEHIJKL:'EJBDIHLK', BDFGHIJK:'HGBDJFIK', BDFGHIJL:'HGBDJFLI', BDFGHIKL:'HGBDIFLK',
  BDFGHJKL:'HGBDJFLK', BDFGIJKL:'IGBDJFLK', BDFHIJKL:'HJBDIFLK', BDGHIJKL:'HJBDIGLK', BEFGHIJK:'EJBFHGIK', BEFGHIJL:'EJBFHGLI',
  BEFGHIKL:'EGBFIHLK', BEFGHJKL:'EJBFHGLK', BEFGIJKL:'EJBFIGLK', BEFHIJKL:'EJBFIHLK', BEGHIJKL:'EJIBHGLK', BFGHIJKL:'HJBFIGLK',
  CDEFGHIJ:'CGJDHFEI', CDEFGHIK:'CGEDHFIK', CDEFGHIL:'CGEDHFLI', CDEFGHJK:'CGJDHFEK', CDEFGHJL:'CGJDHFLE', CDEFGHKL:'CGEDHFLK',
  CDEFGIJK:'CGEDJFIK', CDEFGIJL:'CGEDJFLI', CDEFGIKL:'CGEDIFLK', CDEFGJKL:'CGEDJFLK', CDEFHIJK:'CJEDHFIK', CDEFHIJL:'CJEDHFLI',
  CDEFHIKL:'CEIDHFLK', CDEFHJKL:'CJEDHFLK', CDEFIJKL:'CJEDIFLK', CDEGHIJK:'EGJCHDIK', CDEGHIJL:'EGJCHDLI', CDEGHIKL:'EGICHDLK',
  CDEGHJKL:'EGJCHDLK', CDEGIJKL:'EGICJDLK', CDEHIJKL:'EJICHDLK', CDFGHIJK:'CGJDHFIK', CDFGHIJL:'CGJDHFLI', CDFGHIKL:'CGIDHFLK',
  CDFGHJKL:'CGJDHFLK', CDFGIJKL:'CGIDJFLK', CDFHIJKL:'CJIDHFLK', CDGHIJKL:'HGICJDLK', CEFGHIJK:'EGJCHFIK', CEFGHIJL:'EGJCHFLI',
  CEFGHIKL:'EGICHFLK', CEFGHJKL:'EGJCHFLK', CEFGIJKL:'EGICJFLK', CEFHIJKL:'EJICHFLK', CEGHIJKL:'EJICHGLK', CFGHIJKL:'HGICJFLK',
  DEFGHIJK:'EGJDHFIK', DEFGHIJL:'EGJDHFLI', DEFGHIKL:'EGIDHFLK', DEFGHJKL:'EGJDHFLK', DEFGIJKL:'EGIDJFLK', DEFHIJKL:'EJIDHFLK',
  DEGHIJKL:'EJIDHGLK', DFGHIJKL:'HGIDJFLK', EFGHIJKL:'EJIFHGLK',
};

export function assignBestThird(
  bestThird: Array<{ teamId: string; groupId: string }>,
): Map<string, string> {
  const map = new Map<string, string>();
  const thirdByGroup = new Map(bestThird.map(t => [t.groupId, t.teamId]));
  const key = bestThird.map(t => t.groupId).sort().join('');
  const assignment = THIRD_PLACE_TABLE[key];

  if (assignment && bestThird.length === 8) {
    // Official assignment: winner slot → third-placed group → team id.
    const winnerThird = new Map<string, string>();
    THIRD_WINNER_ORDER.forEach((w, i) => winnerThird.set(w, assignment[i]));
    for (const pool of BEST_THIRD_POOLS) {
      const grp = winnerThird.get(POOL_TO_WINNER[pool]);
      const teamId = grp ? thirdByGroup.get(grp) : undefined;
      if (teamId) map.set(pool, teamId);
    }
    return map;
  }

  // Fallback (pre-knockout or unknown combination): rank order into the pools.
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
