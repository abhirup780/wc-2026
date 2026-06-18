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
