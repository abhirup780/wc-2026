import { describe, it, expect } from 'vitest';
import { poissonSample, sampleMatch, resolveKnockout } from './poisson.js';
import { createRng } from './rng.js';
import type { Team } from '@wc2026/shared';

const rng = createRng(42);

describe('poissonSample', () => {
  it('returns non-negative integer', () => {
    for (let i = 0; i < 100; i++) {
      const v = poissonSample(1.5, rng);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns 0 for lambda=0', () => {
    expect(poissonSample(0, rng)).toBe(0);
  });

  it('mean approximates lambda over many samples', () => {
    const r = createRng(99);
    const N = 10000;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += poissonSample(2.5, r);
    expect(Math.abs(sum / N - 2.5)).toBeLessThan(0.1);
  });
});

function makeTeam(id: string): Team {
  return { id, name: id, code: id, groupId: 'A', rankingElo: 1700, attackRating: 1.0, defenseRating: 1.0 };
}

describe('sampleMatch', () => {
  it('returns non-negative goal counts', () => {
    const home = makeTeam('A');
    const away = makeTeam('B');
    const r = createRng(1);
    const { homeGoals, awayGoals } = sampleMatch(home, away, 1.25, 1.0, r);
    expect(homeGoals).toBeGreaterThanOrEqual(0);
    expect(awayGoals).toBeGreaterThanOrEqual(0);
  });
});

describe('resolveKnockout', () => {
  it('returns winner immediately when goals differ', () => {
    const home = makeTeam('H');
    const away = makeTeam('A');
    const r = createRng(5);
    const { winnerId } = resolveKnockout(2, 1, home, away, 1.25, 1.0, r);
    expect(winnerId).toBe('H');
  });

  it('always produces a winner (no draw)', () => {
    const home = makeTeam('H');
    const away = makeTeam('A');
    for (let seed = 0; seed < 50; seed++) {
      const r = createRng(seed);
      const { winnerId } = resolveKnockout(1, 1, home, away, 1.25, 1.0, r);
      expect(['H', 'A']).toContain(winnerId);
    }
  });
});
