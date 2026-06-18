/**
 * Browser-side single Monte Carlo run.
 * Pure math — no network calls, no Node APIs.
 * Re-implements the core sim loop from job/src/sim/ without the tally overhead.
 */

import type { Team, Match, PredictedMatch } from '@wc2026/shared';

// ─── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Poisson sampler ─────────────────────────────────────────────────────────

function poissonSample(lambda: number, rng: () => number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

// ─── Expected goals ───────────────────────────────────────────────────────────

const BASE_RATE = 1.25;

function lambdas(home: Team, away: Team): [number, number] {
  return [
    BASE_RATE * home.attackRating / away.defenseRating,
    BASE_RATE * away.attackRating / home.defenseRating,
  ];
}

// ─── Group standings ──────────────────────────────────────────────────────────

interface Standing {
  teamId: string; groupId: string;
  pts: number; gd: number; gf: number;
  w: number; d: number; l: number; played: number; ga: number;
}

function applyResult(home: Standing, away: Standing, hg: number, ag: number) {
  home.played++; away.played++;
  home.gf += hg; home.ga += ag; home.gd += hg - ag;
  away.gf += ag; away.ga += hg; away.gd += ag - hg;
  if (hg > ag) { home.w++; home.pts += 3; away.l++; }
  else if (hg < ag) { away.w++; away.pts += 3; home.l++; }
  else { home.d++; away.d++; home.pts++; away.pts++; }
}

function rankStandings(standings: Standing[], rng: () => number): Standing[] {
  return [...standings].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd  !== a.gd)  return b.gd  - a.gd;
    if (b.gf  !== a.gf)  return b.gf  - a.gf;
    return rng() < 0.5 ? -1 : 1; // random tiebreak on equal records
  });
}

// ─── Best-third selection ─────────────────────────────────────────────────────
// WC 2026: best 8 of 12 third-placed teams advance.

function selectBestThird(thirds: Standing[], rng: () => number): Standing[] {
  const sorted = [...thirds].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd  !== a.gd)  return b.gd  - a.gd;
    if (b.gf  !== a.gf)  return b.gf  - a.gf;
    return rng() < 0.5 ? -1 : 1;
  });
  return sorted.slice(0, 8);
}

// ─── Bracket constants (from job/src/sim/bracket.ts) ─────────────────────────

const R32: [string, string][] = [
  ['2A','2B'], ['1E','3X'], ['1F','2C'], ['1C','2F'],
  ['1I','3Y'], ['2E','2I'], ['1A','3Z'], ['1L','3W'],
  ['1D','3V'], ['1G','3U'], ['2K','2L'], ['1H','2J'],
  ['1B','3T'], ['1J','2H'], ['1K','3S'], ['2D','2G'],
];
const R16: [string, string][] = [
  ['R32-01','R32-02'], ['R32-03','R32-04'],
  ['R32-05','R32-06'], ['R32-07','R32-08'],
  ['R32-09','R32-10'], ['R32-11','R32-12'],
  ['R32-13','R32-14'], ['R32-15','R32-16'],
];
const QF: [string, string][] = [
  ['R16-01','R16-02'], ['R16-03','R16-04'],
  ['R16-05','R16-06'], ['R16-07','R16-08'],
];
const SF: [string, string][] = [
  ['QF-01','QF-02'], ['QF-03','QF-04'],
];

// ─── KO match simulation ──────────────────────────────────────────────────────

function simKO(
  homeId: string, awayId: string,
  teamMap: Map<string, Team>,
  rng: () => number,
): { hg: number; ag: number; winnerId: string } {
  const home = teamMap.get(homeId)!;
  const away = teamMap.get(awayId)!;
  const [lH, lA] = lambdas(home, away);
  let hg = poissonSample(lH, rng);
  let ag = poissonSample(lA, rng);

  if (hg !== ag) return { hg, ag, winnerId: hg > ag ? homeId : awayId };

  // Extra time
  const etH = poissonSample(lH * 0.33, rng);
  const etA = poissonSample(lA * 0.33, rng);
  hg += etH; ag += etA;
  if (hg !== ag) return { hg, ag, winnerId: hg > ag ? homeId : awayId };

  // Penalties — coin flip weighted by Elo
  const eloAdvantage = home.rankingElo - away.rankingElo;
  const homeWinPens = 0.5 + eloAdvantage * 0.0002;
  return { hg, ag, winnerId: rng() < homeWinPens ? homeId : awayId };
}

// ─── Main: run one full tournament ───────────────────────────────────────────

export interface SimGroupRow {
  teamId: string;
  pts: number; w: number; d: number; l: number;
  gf: number; ga: number; gd: number;
}

export interface OneSimResult {
  matches: PredictedMatch[];
  groups: Record<string, SimGroupRow[]>; // groupId → ranked rows
  champion: string;
  seed: number;
}

export function simulateOnce(
  teams: Team[],
  allMatches: Match[],
  seed?: number,
): OneSimResult {
  const usedSeed = seed ?? (Date.now() & 0xffffffff);
  const rng = mulberry32(usedSeed);
  const teamMap = new Map(teams.map(t => [t.id, t]));

  const predicted: PredictedMatch[] = [];

  // ── Group stage ────────────────────────────────────────────────────────────
  const standings = new Map<string, Map<string, Standing>>();
  for (const t of teams) {
    if (!t.groupId) continue;
    if (!standings.has(t.groupId)) standings.set(t.groupId, new Map());
    standings.get(t.groupId)!.set(t.id, {
      teamId: t.id, groupId: t.groupId,
      pts: 0, gd: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0, played: 0,
    });
  }

  for (const m of allMatches.filter(m => m.stage === 'group')) {
    let hg: number, ag: number;
    if (m.status === 'finished' && m.homeGoals != null && m.awayGoals != null) {
      hg = m.homeGoals; ag = m.awayGoals;
      predicted.push({ id: m.id, stage: m.stage, groupId: m.groupId,
        homeId: m.homeId, awayId: m.awayId, kickoffUtc: m.kickoffUtc,
        homeXg: hg, awayXg: ag, homeGoals: hg, awayGoals: ag });
    } else {
      const home = teamMap.get(m.homeId);
      const away = teamMap.get(m.awayId);
      if (!home || !away) continue;
      const [lH, lA] = lambdas(home, away);
      hg = poissonSample(lH, rng);
      ag = poissonSample(lA, rng);
      predicted.push({ id: m.id, stage: m.stage, groupId: m.groupId,
        homeId: m.homeId, awayId: m.awayId, kickoffUtc: m.kickoffUtc,
        homeXg: lH, awayXg: lA, homeGoals: hg, awayGoals: ag });
    }
    const gs = standings.get(m.groupId!);
    if (gs) {
      const h = gs.get(m.homeId)!;
      const a = gs.get(m.awayId)!;
      applyResult(h, a, hg, ag);
    }
  }

  // Rank each group, collect advancing teams + export standings
  const slotMap = new Map<string, string>(); // "1A" → teamId
  const thirds: Standing[] = [];
  const groupResults: Record<string, SimGroupRow[]> = {};

  for (const [gid, gs] of standings.entries()) {
    const ranked = rankStandings([...gs.values()], rng);
    slotMap.set(`1${gid}`, ranked[0].teamId);
    slotMap.set(`2${gid}`, ranked[1].teamId);
    if (ranked[2]) thirds.push(ranked[2]);
    groupResults[gid] = ranked.map(s => ({
      teamId: s.teamId, pts: s.pts, w: s.w, d: s.d, l: s.l,
      gf: s.gf, ga: s.ga, gd: s.gd,
    }));
  }

  // Best 8 third-placed
  const best8thirds = selectBestThird(thirds, rng);
  // Assign to bracket slots — simplified: just use generic 3X/3Y/etc. placeholders
  // resolved by the bracket lookup below
  const thirdIds = best8thirds.map(t => t.teamId);
  const thirdSlotNames = ['3X','3Y','3Z','3W','3V','3U','3T','3S'];
  thirdSlotNames.forEach((s, i) => { if (thirdIds[i]) slotMap.set(s, thirdIds[i]); });

  // ── KO rounds ──────────────────────────────────────────────────────────────
  function playRound(
    pairs: [string, string][],
    prefix: string,
    stage: PredictedMatch['stage'],
    prevMap: Map<string, string>,
  ): Map<string, string> {
    const winners = new Map<string, string>();
    pairs.forEach(([s1, s2], i) => {
      const homeId = prevMap.get(s1);
      const awayId = prevMap.get(s2);
      if (!homeId || !awayId) return;
      const home = teamMap.get(homeId);
      const away = teamMap.get(awayId);
      if (!home || !away) return;
      const [lH, lA] = lambdas(home, away);
      const { hg, ag, winnerId } = simKO(homeId, awayId, teamMap, rng);
      const matchId = `${prefix}-${String(i + 1).padStart(2, '0')}`;
      predicted.push({
        id: matchId, stage, groupId: null,
        homeId, awayId, kickoffUtc: '',
        homeXg: lH, awayXg: lA,
        homeGoals: hg, awayGoals: ag,
        winnerId,
      });
      winners.set(matchId, winnerId);
    });
    return winners;
  }

  const r32Winners = playRound(R32, 'R32', 'r32', slotMap);
  const r16Winners = playRound(R16, 'R16', 'r16', r32Winners);
  const qfWinners  = playRound(QF,  'QF',  'qf',  r16Winners);
  const sfWinners  = playRound(SF,  'SF',  'sf',  qfWinners);
  const finalWinners = playRound([['SF-01','SF-02']], 'FINAL', 'final', sfWinners);

  return {
    matches: predicted,
    groups: groupResults,
    champion: finalWinners.get('FINAL-01') ?? '',
    seed: usedSeed,
  };
}

/**
 * Run simulations until the champion is among the likely contenders.
 * likelyCodes = set of team codes with pChampion > threshold (e.g. 2%).
 * Almost always resolves in <10 attempts for top-8 coverage (~85%).
 */
export function simulateLikely(
  teams: Team[],
  matches: Match[],
  likelyCodes: Set<string>,
  maxAttempts = 300,
): OneSimResult {
  for (let i = 0; i < maxAttempts; i++) {
    const r = simulateOnce(teams, matches);
    if (likelyCodes.has(r.champion)) return r;
  }
  return simulateOnce(teams, matches); // safety fallback
}
