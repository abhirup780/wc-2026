/**
 * Official FIFA group-stage ranking criteria for WC 2026.
 *
 * Order (same as WC 2022 regulations, Art. 20):
 *   1. Points
 *   2. Goal difference
 *   3. Goals scored
 *   4. Head-to-head points (among tied subset only)
 *   5. Head-to-head goal difference
 *   6. Head-to-head goals scored
 *   7. Fair play (not modelled in simulation – skip)
 *   8. Drawing of lots (seeded random in simulation)
 *
 * Reference: FIFA World Cup 2026™ Competition Regulations (apply once published).
 * Flag any change in ordering here if the official document differs.
 */

import type { GroupStanding, Match } from '@wc2026/shared';

export interface RankedStanding extends GroupStanding {
  /** Position within the group after tiebreakers: 1-4 */
  position: number;
}

// ─── Single comparator ────────────────────────────────────────────────────────

type Comparator = (a: GroupStanding, b: GroupStanding) => number;

function cmp(fn: (s: GroupStanding) => number): Comparator {
  return (a, b) => fn(b) - fn(a); // descending
}

const PRIMARY_COMPARATORS: Comparator[] = [
  cmp(s => s.points),
  cmp(s => s.gd),
  cmp(s => s.gf),
];

// ─── Head-to-head sub-table ───────────────────────────────────────────────────

function headToHeadStandings(
  tiedTeamIds: string[],
  groupMatches: Match[],
): Map<string, { points: number; gd: number; gf: number }> {
  const h2h = new Map<string, { points: number; gd: number; gf: number }>();
  for (const id of tiedTeamIds) h2h.set(id, { points: 0, gd: 0, gf: 0 });

  for (const m of groupMatches) {
    if (m.status !== 'finished') continue;
    if (m.homeGoals == null || m.awayGoals == null) continue;
    if (!tiedTeamIds.includes(m.homeId) || !tiedTeamIds.includes(m.awayId)) continue;

    const hg = m.homeGoals;
    const ag = m.awayGoals;
    const home = h2h.get(m.homeId)!;
    const away = h2h.get(m.awayId)!;

    home.gf += hg; home.gd += hg - ag;
    away.gf += ag; away.gd += ag - hg;

    if (hg > ag) { home.points += 3; }
    else if (hg < ag) { away.points += 3; }
    else { home.points += 1; away.points += 1; }
  }

  return h2h;
}

// ─── Recursive sort with h2h applied inside tied clusters ─────────────────────

export function sortGroup(
  standings: GroupStanding[],
  groupMatches: Match[],
  rng: () => number,
): GroupStanding[] {
  return recursiveSort([...standings], groupMatches, rng, PRIMARY_COMPARATORS);
}

function recursiveSort(
  group: GroupStanding[],
  groupMatches: Match[],
  rng: () => number,
  comparators: Comparator[],
): GroupStanding[] {
  if (group.length <= 1) return group;

  // Partition into tied clusters by the first comparator
  const sorted = stableSort(group, comparators[0]);
  const clusters = clusterBy(sorted, comparators[0]);

  const result: GroupStanding[] = [];
  for (const cluster of clusters) {
    if (cluster.length === 1) {
      result.push(cluster[0]);
      continue;
    }

    // Try remaining primary comparators within cluster
    const remainingPrimary = comparators.slice(1);
    let resolved = cluster;

    if (remainingPrimary.length > 0) {
      const sorted2 = stableSort(resolved, remainingPrimary[0]);
      const subClusters = clusterBy(sorted2, remainingPrimary[0]);
      if (subClusters.length > 1) {
        // Multiple distinct sub-clusters; recurse each
        for (const sub of subClusters) {
          result.push(...recursiveSort(sub, groupMatches, rng, remainingPrimary.slice(1)));
        }
        continue;
      }
      // Still all tied on primary criteria – apply h2h
      resolved = sorted2;
    }

    // Apply head-to-head
    const tiedIds = resolved.map(s => s.teamId);
    const h2h = headToHeadStandings(tiedIds, groupMatches);

    const h2hComparators: Comparator[] = [
      (a, b) => (h2h.get(b.teamId)?.points ?? 0) - (h2h.get(a.teamId)?.points ?? 0),
      (a, b) => (h2h.get(b.teamId)?.gd ?? 0) - (h2h.get(a.teamId)?.gd ?? 0),
      (a, b) => (h2h.get(b.teamId)?.gf ?? 0) - (h2h.get(a.teamId)?.gf ?? 0),
    ];

    let h2hResolved = stableSort(resolved, h2hComparators[0]);
    let h2hClusters = clusterBy(h2hResolved, h2hComparators[0]);

    if (h2hClusters.every(c => c.length === 1)) {
      result.push(...h2hResolved);
      continue;
    }

    // Try h2h gd and gf
    for (const cmp2 of h2hComparators.slice(1)) {
      h2hResolved = stableSort(resolved, cmp2);
      h2hClusters = clusterBy(h2hResolved, cmp2);
      if (h2hClusters.every(c => c.length === 1)) break;
    }

    if (h2hClusters.every(c => c.length === 1)) {
      result.push(...h2hResolved);
      continue;
    }

    // Drawing of lots: shuffle remaining tied teams with seeded RNG
    const shuffled = shuffleRng(h2hResolved, rng);
    result.push(...shuffled);
  }

  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stableSort<T>(arr: T[], cmp: (a: T, b: T) => number): T[] {
  return [...arr].sort(cmp);
}

/** Split a sorted array into clusters where adjacent items compare equal */
function clusterBy<T>(sorted: T[], cmp: (a: T, b: T) => number): T[][] {
  if (sorted.length === 0) return [];
  const clusters: T[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    if (cmp(sorted[i - 1], sorted[i]) === 0) {
      clusters[clusters.length - 1].push(sorted[i]);
    } else {
      clusters.push([sorted[i]]);
    }
  }
  return clusters;
}

function shuffleRng<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Produce RankedStanding array for a full group ───────────────────────────

export function rankGroup(
  standings: GroupStanding[],
  groupMatches: Match[],
  rng: () => number,
): RankedStanding[] {
  const sorted = sortGroup(standings, groupMatches, rng);
  return sorted.map((s, i) => ({ ...s, position: i + 1 }));
}
