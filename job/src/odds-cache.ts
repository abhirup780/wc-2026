/**
 * On-disk cache of the last odds fetched from The Odds API, so the simulation
 * can re-run after every match using the most recently gathered odds — without
 * spending an API request each time. The cache lives outside the public web
 * output and is persisted across CI runs via GitHub Actions cache (private, not
 * redistributed).
 */

import fs from 'fs';
import path from 'path';
import type { MatchOdds } from './sim/poisson.js';

export interface OddsCache {
  fetchedAt: string;                       // ISO timestamp of the API fetch
  matchOdds: Record<string, MatchOdds>;    // "HOME|AWAY" → implied 1X2
  outrights: Record<string, number>;       // teamCode → champion probability
}

export function readOddsCache(file: string): OddsCache | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as OddsCache;
  } catch {
    return null;
  }
}

export function writeOddsCache(file: string, cache: OddsCache): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cache), 'utf8');
}

export function mapToObj<V>(m: Map<string, V> | undefined): Record<string, V> {
  const o: Record<string, V> = {};
  if (m) for (const [k, v] of m) o[k] = v;
  return o;
}

export function objToMap<V>(o: Record<string, V> | undefined): Map<string, V> {
  return new Map(Object.entries(o ?? {}));
}
