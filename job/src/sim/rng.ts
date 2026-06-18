/**
 * Seedable pseudo-random number generator (Mulberry32).
 * Returns a factory that produces a () => number in [0, 1).
 * The same seed always produces the same sequence.
 */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}

/** Produce a deterministic child seed from a parent RNG */
export function childSeed(rng: () => number): number {
  return (rng() * 0x100000000) >>> 0;
}
