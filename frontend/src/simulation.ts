/**
 * Browser-side single Monte Carlo run.
 * Pure math — no network calls, no Node APIs.
 * Re-implements the core sim loop from job/src/sim/ without the tally overhead.
 */

import type { Team, Match, PredictedMatch, GroupStanding } from '@wc2026/shared';
import {
  R32_MATCHES, R16_PAIRS, QF_PAIRS, SF_PAIRS,
  resolveSlot, assignBestThird, selectBestThird,
} from '@wc2026/shared';

// Fraction of would-be upsets (lower-rated team winning) reverted to the
// favourite, so the dice still produces upsets but not wall-to-wall chaos.
const UPSET_DAMP = 0.6;

/** Revert a decisive scoreline to the favourite with probability UPSET_DAMP. */
function dampUpset(home: Team, away: Team, hg: number, ag: number, rng: () => number): [number, number] {
  if (hg === ag) return [hg, ag]; // draw is not an upset
  const homeWon = hg > ag;
  const favHome = home.rankingElo >= away.rankingElo;
  if (homeWon !== favHome && rng() < UPSET_DAMP) return [ag, hg]; // flip so favourite wins
  return [hg, ag];
}

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

// Bracket pairings (R32_MATCHES, R16_PAIRS, QF_PAIRS, SF_PAIRS) and third-place
// selection/assignment come from @wc2026/shared — the same official FIFA bracket
// the job uses, so the dice sim and the model never diverge.

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
  [hg, ag] = dampUpset(home, away, hg, ag, rng);

  if (hg !== ag) return { hg, ag, winnerId: hg > ag ? homeId : awayId };

  // Extra time
  const etH = poissonSample(lH * 0.33, rng);
  const etA = poissonSample(lA * 0.33, rng);
  hg += etH; ag += etA;
  [hg, ag] = dampUpset(home, away, hg, ag, rng);
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
    if ((m.status === 'finished' || m.status === 'live') && m.homeGoals != null && m.awayGoals != null) {
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
      [hg, ag] = dampUpset(home, away, hg, ag, rng);
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
  const slotMap = new Map<string, string>(); // "1A"/"2A" → teamId
  const thirds: GroupStanding[] = [];
  const groupResults: Record<string, SimGroupRow[]> = {};

  for (const [gid, gs] of standings.entries()) {
    const ranked = rankStandings([...gs.values()], rng);
    slotMap.set(`1${gid}`, ranked[0].teamId);
    slotMap.set(`2${gid}`, ranked[1].teamId);
    if (ranked[2]) {
      const t = ranked[2];
      thirds.push({
        groupId: gid, teamId: t.teamId, played: t.played,
        w: t.w, d: t.d, l: t.l, gf: t.gf, ga: t.ga, gd: t.gd, points: t.pts,
      });
    }
    groupResults[gid] = ranked.map(s => ({
      teamId: s.teamId, pts: s.pts, w: s.w, d: s.d, l: s.l,
      gf: s.gf, ga: s.ga, gd: s.gd,
    }));
  }

  // Best 8 third-placed → assigned to the official R32 third-place pools
  const bestThird = selectBestThird(thirds, rng);
  const bestThirdAssignment = assignBestThird(
    bestThird.map(t => ({ teamId: t.teamId, groupId: t.groupId })),
  );

  // Resolve every R32 slot ("2A", "1E", "3-ABCDF", …) to a team id
  const r32Slots = new Map<string, string>();
  for (const rm of R32_MATCHES) {
    const t1 = resolveSlot(rm.slot1, slotMap, bestThirdAssignment);
    const t2 = resolveSlot(rm.slot2, slotMap, bestThirdAssignment);
    if (t1) r32Slots.set(rm.slot1, t1);
    if (t2) r32Slots.set(rm.slot2, t2);
  }

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

      const matchId = `${prefix}-${String(i + 1).padStart(2, '0')}`;

      // Check if there is an existing finished or live knockout match between these teams
      const realMatch = allMatches.find(m =>
        m.stage === stage &&
        (m.status === 'finished' || m.status === 'live') &&
        m.homeGoals != null &&
        m.awayGoals != null &&
        ((m.homeId === homeId && m.awayId === awayId) || (m.homeId === awayId && m.awayId === homeId))
      );

      if (realMatch) {
        const hg = realMatch.homeGoalsAet != null ? realMatch.homeGoalsAet : (realMatch.homeGoals ?? 0);
        const ag = realMatch.awayGoalsAet != null ? realMatch.awayGoalsAet : (realMatch.awayGoals ?? 0);
        let winnerId = hg > ag ? realMatch.homeId : hg < ag ? realMatch.awayId : realMatch.homeId;
        if (hg === ag && realMatch.homePens != null && realMatch.awayPens != null) {
          winnerId = realMatch.homePens > realMatch.awayPens ? realMatch.homeId : realMatch.awayId;
        }
        predicted.push({
          id: matchId, stage, groupId: null,
          homeId, awayId, kickoffUtc: realMatch.kickoffUtc,
          homeXg: hg, awayXg: ag,
          homeGoals: hg, awayGoals: ag,
          winnerId,
        });
        winners.set(matchId, winnerId);
        return;
      }

      const home = teamMap.get(homeId);
      const away = teamMap.get(awayId);
      if (!home || !away) return;
      const [lH, lA] = lambdas(home, away);
      const { hg, ag, winnerId } = simKO(homeId, awayId, teamMap, rng);
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

  const r32Pairs = R32_MATCHES.map(rm => [rm.slot1, rm.slot2] as [string, string]);
  const r32Winners = playRound(r32Pairs, 'R32', 'r32', r32Slots);
  const r16Winners = playRound(R16_PAIRS.map(([a, b]) => [a, b] as [string, string]), 'R16', 'r16', r32Winners);
  const qfWinners  = playRound(QF_PAIRS.map(([a, b]) => [a, b] as [string, string]), 'QF', 'qf', r16Winners);
  const sfWinners  = playRound(SF_PAIRS.map(([a, b]) => [a, b] as [string, string]), 'SF', 'sf', qfWinners);
  const finalWinners = playRound([['SF-01', 'SF-02']], 'FINAL', 'final', sfWinners);

  return {
    matches: predicted,
    groups: groupResults,
    champion: finalWinners.get('FINAL-01') ?? '',
    seed: usedSeed,
  };
}

/**
 * Build ranked group standings from a set of already-predicted matches
 * (e.g. the deterministic prediction.json). Deterministic tiebreak via a
 * fixed-seed RNG so the display is stable across renders.
 */
export function standingsFromPredicted(
  matches: PredictedMatch[],
): Record<string, SimGroupRow[]> {
  const rng = mulberry32(1);
  const standings = new Map<string, Map<string, Standing>>();
  const ensure = (gid: string, id: string): Standing => {
    if (!standings.has(gid)) standings.set(gid, new Map());
    const g = standings.get(gid)!;
    if (!g.has(id)) {
      g.set(id, { teamId: id, groupId: gid, pts: 0, gd: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0, played: 0 });
    }
    return g.get(id)!;
  };

  for (const m of matches) {
    if (m.stage !== 'group' || !m.groupId) continue;
    const h = ensure(m.groupId, m.homeId);
    const a = ensure(m.groupId, m.awayId);
    applyResult(h, a, m.homeGoals, m.awayGoals);
  }

  const out: Record<string, SimGroupRow[]> = {};
  for (const [gid, g] of standings.entries()) {
    out[gid] = rankStandings([...g.values()], rng).map(s => ({
      teamId: s.teamId, pts: s.pts, w: s.w, d: s.d, l: s.l, gf: s.gf, ga: s.ga, gd: s.gd,
    }));
  }
  return out;
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
