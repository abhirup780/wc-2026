import { describe, it, expect } from 'vitest';
import { rankGroup } from './tiebreakers.js';
import type { GroupStanding, Match } from '@wc2026/shared';

// Helper to build a standing row
function standing(
  teamId: string,
  pts: number,
  gd: number,
  gf: number,
  played = 3,
): GroupStanding {
  const ga = gf - gd;
  const w = Math.floor(pts / 3);
  const d = pts - w * 3;
  const l = played - w - d;
  return { groupId: 'A', teamId, played, w, d, l, gf, ga, gd, points: pts };
}

const noMatches: Match[] = [];

// Deterministic RNG stub (always returns 0.5)
const rng = () => 0.5;

describe('rankGroup – primary criteria', () => {
  it('sorts by points descending', () => {
    const s = [
      standing('C', 3, 0, 1),
      standing('A', 9, 5, 6),
      standing('B', 6, 2, 3),
      standing('D', 0, -7, 1),
    ];
    const ranked = rankGroup(s, noMatches, rng);
    expect(ranked.map(r => r.teamId)).toEqual(['A', 'B', 'C', 'D']);
    expect(ranked.map(r => r.position)).toEqual([1, 2, 3, 4]);
  });

  it('breaks points tie by goal difference', () => {
    const s = [
      standing('A', 7, 3, 5),
      standing('B', 7, 1, 3),
      standing('C', 4, -1, 2),
      standing('D', 3, -3, 1),
    ];
    const ranked = rankGroup(s, noMatches, rng);
    expect(ranked[0].teamId).toBe('A');
    expect(ranked[1].teamId).toBe('B');
  });

  it('breaks GD tie by goals scored', () => {
    const s = [
      standing('A', 7, 2, 4),
      standing('B', 7, 2, 3),
      standing('C', 4, -1, 2),
      standing('D', 3, -3, 1),
    ];
    const ranked = rankGroup(s, noMatches, rng);
    expect(ranked[0].teamId).toBe('A');
    expect(ranked[1].teamId).toBe('B');
  });
});

describe('rankGroup – head-to-head', () => {
  // Three teams tied on all primary criteria → use head-to-head
  it('uses head-to-head points for three-way tie', () => {
    const s = [
      standing('A', 4, 0, 3), // played 3: W1 D1 L1
      standing('B', 4, 0, 3),
      standing('C', 4, 0, 3),
      standing('D', 1, 0, 2),
    ];

    // Matches: A beat B, B beat C, C beat A (cyclic); D draws everyone
    const matches: Match[] = [
      { id: 'm1', stage: 'group', groupId: 'A', homeId: 'A', awayId: 'B', kickoffUtc: '', status: 'finished', homeGoals: 1, awayGoals: 0 },
      { id: 'm2', stage: 'group', groupId: 'A', homeId: 'B', awayId: 'C', kickoffUtc: '', status: 'finished', homeGoals: 2, awayGoals: 0 },
      { id: 'm3', stage: 'group', groupId: 'A', homeId: 'C', awayId: 'A', kickoffUtc: '', status: 'finished', homeGoals: 1, awayGoals: 0 },
    ];

    // h2h: A: 3pts (beat B), B: 3pts (beat C), C: 3pts (beat A) → still tied
    // Falls through to h2h GD: A: +1-1=0, B: +2-1=+1, C: +1-2=-1
    const ranked = rankGroup(s, matches, rng);
    expect(ranked[0].teamId).toBe('B'); // best h2h GD (+1)
    expect(ranked[2].teamId).toBe('C'); // worst h2h GD (-1)
  });
});

describe('rankGroup – lots', () => {
  it('uses seeded RNG for drawing of lots when all criteria equal', () => {
    // All perfectly equal – lots must be used
    const s = [
      standing('A', 3, 0, 1),
      standing('B', 3, 0, 1),
      standing('C', 3, 0, 1),
      standing('D', 3, 0, 1),
    ];
    // With rng returning 0.5, shuffles should produce a deterministic order
    const ranked1 = rankGroup(s, noMatches, () => 0.5);
    const ranked2 = rankGroup(s, noMatches, () => 0.5);
    // Same RNG → same result
    expect(ranked1.map(r => r.teamId)).toEqual(ranked2.map(r => r.teamId));
  });
});

describe('rankGroup – full four-team group', () => {
  it('correctly handles a realistic group table', () => {
    // Group: ARG(9,+7), POL(4,+1), MEX(4,-1), KSA(0,-7)
    const s = [
      standing('ARG', 9, 7, 8, 3),
      standing('POL', 4, 1, 3, 3),
      standing('MEX', 4, -1, 3, 3),
      standing('KSA', 0, -7, 1, 3),
    ];
    const ranked = rankGroup(s, noMatches, rng);
    expect(ranked[0].teamId).toBe('ARG');
    expect(ranked[3].teamId).toBe('KSA');
    // POL above MEX (better GD)
    expect(ranked[1].teamId).toBe('POL');
    expect(ranked[2].teamId).toBe('MEX');
  });
});
