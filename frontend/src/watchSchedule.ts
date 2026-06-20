// ─── Watch-tab broadcast schedule ──────────────────────────────────────────────
// FOX Sports' FIFA World Cup 2026 TV schedule (72 matches on FOX, 32 on FS1).
// Each match maps to the channel that carries it; the Watch tab uses this to
// surface the right live stream around kickoff. When two matches run at once one
// airs on FOX and the other on FS1, so the viewer just picks the channel.
//
// Times are the published ET kickoffs with the EDT offset (-04:00) baked in, so
// `new Date(iso)` is an absolute instant regardless of the viewer's timezone.
// Late-night entries the guide lists as "12:00 AM" under the prior day roll to
// the following calendar date (that's the real wall-clock instant).

export type Network = 'FOX' | 'FS1';

export const NETWORKS: Network[] = ['FOX', 'FS1'];

export const STREAMS: Record<Network, string> = {
  FOX: 'https://junkieembeds.pages.dev/embed/fox-usa',
  FS1: 'https://junkieembeds.pages.dev/embed/fox-sports-1',
};

export interface WatchMatch {
  no: number;
  kickoff: number;   // epoch ms
  stage: string;     // 'Group A' … 'Group L' | 'Round of 32' | … | 'Final'
  home: string;      // FIFA code (e.g. 'USA') or bracket slot (e.g. '2A', 'W73')
  away: string;
  venue: string;
  network: Network;
}

// [no, kickoff(ET ISO, -04:00 EDT), stage, home, away, venue, network]
type Row = [number, string, string, string, string, string, Network];

const ROWS: Row[] = [
  // ── Group stage — matchday 1 ──
  [1,  '2026-06-11T15:00:00-04:00', 'Group A', 'MEX', 'RSA', 'Mexico City',            'FOX'],
  [2,  '2026-06-11T22:00:00-04:00', 'Group A', 'KOR', 'CZE', 'Guadalajara',            'FS1'],
  [3,  '2026-06-12T15:00:00-04:00', 'Group B', 'CAN', 'BIH', 'Toronto',                'FOX'],
  [4,  '2026-06-12T21:00:00-04:00', 'Group D', 'USA', 'PAR', 'Los Angeles',            'FOX'],
  [8,  '2026-06-13T15:00:00-04:00', 'Group B', 'QAT', 'SUI', 'San Francisco Bay Area', 'FOX'],
  [7,  '2026-06-13T18:00:00-04:00', 'Group C', 'BRA', 'MAR', 'New York/New Jersey',    'FOX'],
  [5,  '2026-06-13T21:00:00-04:00', 'Group C', 'HAI', 'SCO', 'Boston',                 'FOX'],
  [6,  '2026-06-14T00:00:00-04:00', 'Group D', 'AUS', 'TUR', 'Vancouver',              'FS1'],
  [10, '2026-06-14T13:00:00-04:00', 'Group E', 'GER', 'CUW', 'Houston',                'FOX'],
  [11, '2026-06-14T16:00:00-04:00', 'Group F', 'NED', 'JPN', 'Dallas',                 'FOX'],
  [9,  '2026-06-14T19:00:00-04:00', 'Group E', 'CIV', 'ECU', 'Philadelphia',           'FS1'],
  [12, '2026-06-14T22:00:00-04:00', 'Group F', 'SWE', 'TUN', 'Monterrey',              'FS1'],
  [14, '2026-06-15T12:00:00-04:00', 'Group H', 'ESP', 'CPV', 'Atlanta',                'FOX'],
  [16, '2026-06-15T15:00:00-04:00', 'Group G', 'BEL', 'EGY', 'Seattle',                'FOX'],
  [13, '2026-06-15T18:00:00-04:00', 'Group H', 'KSA', 'URU', 'Miami',                  'FS1'],
  [15, '2026-06-15T21:00:00-04:00', 'Group G', 'IRN', 'NZL', 'Los Angeles',            'FS1'],
  [17, '2026-06-16T15:00:00-04:00', 'Group I', 'FRA', 'SEN', 'New York/New Jersey',    'FOX'],
  [18, '2026-06-16T18:00:00-04:00', 'Group I', 'IRQ', 'NOR', 'Boston',                 'FOX'],
  [19, '2026-06-16T21:00:00-04:00', 'Group J', 'ARG', 'ALG', 'Kansas City',            'FOX'],
  [20, '2026-06-17T00:00:00-04:00', 'Group J', 'AUT', 'JOR', 'San Francisco Bay Area', 'FS1'],
  [23, '2026-06-17T13:00:00-04:00', 'Group K', 'POR', 'COD', 'Houston',                'FOX'],
  [22, '2026-06-17T16:00:00-04:00', 'Group L', 'ENG', 'CRO', 'Dallas',                 'FOX'],
  [21, '2026-06-17T19:00:00-04:00', 'Group L', 'GHA', 'PAN', 'Toronto',                'FS1'],
  [24, '2026-06-17T22:00:00-04:00', 'Group K', 'UZB', 'COL', 'Mexico City',            'FS1'],
  // ── Group stage — matchday 2 ──
  [25, '2026-06-18T12:00:00-04:00', 'Group A', 'CZE', 'RSA', 'Atlanta',                'FOX'],
  [26, '2026-06-18T15:00:00-04:00', 'Group B', 'SUI', 'BIH', 'Los Angeles',            'FOX'],
  [27, '2026-06-18T18:00:00-04:00', 'Group B', 'CAN', 'QAT', 'Vancouver',              'FS1'],
  [28, '2026-06-18T21:00:00-04:00', 'Group A', 'MEX', 'KOR', 'Guadalajara',            'FOX'],
  [32, '2026-06-19T15:00:00-04:00', 'Group D', 'USA', 'AUS', 'Seattle',                'FOX'],
  [30, '2026-06-19T18:00:00-04:00', 'Group C', 'SCO', 'MAR', 'Boston',                 'FOX'],
  [29, '2026-06-19T20:30:00-04:00', 'Group C', 'BRA', 'HAI', 'Philadelphia',           'FOX'],
  [31, '2026-06-19T23:00:00-04:00', 'Group D', 'TUR', 'PAR', 'San Francisco Bay Area', 'FS1'],
  [35, '2026-06-20T13:00:00-04:00', 'Group F', 'NED', 'SWE', 'Houston',                'FOX'],
  [33, '2026-06-20T16:00:00-04:00', 'Group E', 'GER', 'CIV', 'Toronto',                'FOX'],
  [34, '2026-06-20T20:00:00-04:00', 'Group E', 'ECU', 'CUW', 'Kansas City',            'FS1'],
  [36, '2026-06-21T00:00:00-04:00', 'Group F', 'TUN', 'JPN', 'Monterrey',              'FS1'],
  [38, '2026-06-21T12:00:00-04:00', 'Group H', 'ESP', 'KSA', 'Atlanta',                'FOX'],
  [39, '2026-06-21T15:00:00-04:00', 'Group G', 'BEL', 'IRN', 'Los Angeles',            'FS1'],
  [37, '2026-06-21T18:00:00-04:00', 'Group H', 'URU', 'CPV', 'Miami',                  'FS1'],
  [40, '2026-06-21T21:00:00-04:00', 'Group G', 'NZL', 'EGY', 'Vancouver',              'FS1'],
  [43, '2026-06-22T13:00:00-04:00', 'Group J', 'ARG', 'AUT', 'Dallas',                 'FOX'],
  [42, '2026-06-22T17:00:00-04:00', 'Group I', 'FRA', 'IRQ', 'Philadelphia',           'FOX'],
  [41, '2026-06-22T20:00:00-04:00', 'Group I', 'NOR', 'SEN', 'New York/New Jersey',    'FOX'],
  [44, '2026-06-22T23:00:00-04:00', 'Group J', 'JOR', 'ALG', 'San Francisco Bay Area', 'FS1'],
  [47, '2026-06-23T13:00:00-04:00', 'Group K', 'POR', 'UZB', 'Houston',                'FOX'],
  [45, '2026-06-23T16:00:00-04:00', 'Group L', 'ENG', 'GHA', 'Boston',                 'FOX'],
  [46, '2026-06-23T19:00:00-04:00', 'Group L', 'PAN', 'CRO', 'Toronto',                'FOX'],
  [48, '2026-06-23T22:00:00-04:00', 'Group K', 'COL', 'COD', 'Guadalajara',            'FS1'],
  // ── Group stage — matchday 3 (simultaneous kickoffs) ──
  [51, '2026-06-24T15:00:00-04:00', 'Group B', 'SUI', 'CAN', 'Vancouver',              'FOX'],
  [52, '2026-06-24T15:00:00-04:00', 'Group B', 'BIH', 'QAT', 'Seattle',                'FS1'],
  [49, '2026-06-24T18:00:00-04:00', 'Group C', 'SCO', 'BRA', 'Miami',                  'FOX'],
  [50, '2026-06-24T18:00:00-04:00', 'Group C', 'MAR', 'HAI', 'Atlanta',                'FS1'],
  [53, '2026-06-24T21:00:00-04:00', 'Group A', 'CZE', 'MEX', 'Mexico City',            'FOX'],
  [54, '2026-06-24T21:00:00-04:00', 'Group A', 'RSA', 'KOR', 'Monterrey',              'FS1'],
  [56, '2026-06-25T16:00:00-04:00', 'Group E', 'ECU', 'GER', 'New York/New Jersey',    'FOX'],
  [55, '2026-06-25T16:00:00-04:00', 'Group E', 'CUW', 'CIV', 'Philadelphia',           'FS1'],
  [58, '2026-06-25T19:00:00-04:00', 'Group F', 'TUN', 'NED', 'Kansas City',            'FOX'],
  [57, '2026-06-25T19:00:00-04:00', 'Group F', 'JPN', 'SWE', 'Dallas',                 'FS1'],
  [59, '2026-06-25T22:00:00-04:00', 'Group D', 'TUR', 'USA', 'Los Angeles',            'FOX'],
  [60, '2026-06-25T22:00:00-04:00', 'Group D', 'PAR', 'AUS', 'San Francisco Bay Area', 'FS1'],
  [61, '2026-06-26T15:00:00-04:00', 'Group I', 'NOR', 'FRA', 'Boston',                 'FOX'],
  [62, '2026-06-26T15:00:00-04:00', 'Group I', 'SEN', 'IRQ', 'Toronto',                'FS1'],
  [66, '2026-06-26T20:00:00-04:00', 'Group H', 'URU', 'ESP', 'Guadalajara',            'FOX'],
  [65, '2026-06-26T20:00:00-04:00', 'Group H', 'CPV', 'KSA', 'Houston',                'FS1'],
  [64, '2026-06-26T23:00:00-04:00', 'Group G', 'NZL', 'BEL', 'Vancouver',              'FOX'],
  [63, '2026-06-26T23:00:00-04:00', 'Group G', 'EGY', 'IRN', 'Seattle',                'FS1'],
  [67, '2026-06-27T17:00:00-04:00', 'Group L', 'PAN', 'ENG', 'New York/New Jersey',    'FOX'],
  [68, '2026-06-27T17:00:00-04:00', 'Group L', 'CRO', 'GHA', 'Philadelphia',           'FS1'],
  [71, '2026-06-27T19:30:00-04:00', 'Group K', 'COL', 'POR', 'Miami',                  'FOX'],
  [72, '2026-06-27T19:30:00-04:00', 'Group K', 'COD', 'UZB', 'Atlanta',                'FS1'],
  [70, '2026-06-27T22:00:00-04:00', 'Group J', 'JOR', 'ARG', 'Dallas',                 'FOX'],
  [69, '2026-06-27T22:00:00-04:00', 'Group J', 'ALG', 'AUT', 'Kansas City',            'FS1'],
  // ── Round of 32 ──
  [73, '2026-06-28T15:00:00-04:00', 'Round of 32', '2A',  '2B',      'Los Angeles',            'FOX'],
  [76, '2026-06-29T13:00:00-04:00', 'Round of 32', '1C',  '2F',      'Houston',                'FOX'],
  [74, '2026-06-29T16:30:00-04:00', 'Round of 32', '1E',  '3ABCDF',  'Boston',                 'FOX'],
  [75, '2026-06-29T21:00:00-04:00', 'Round of 32', '1F',  '2C',      'Monterrey',              'FOX'],
  [78, '2026-06-30T13:00:00-04:00', 'Round of 32', '2E',  '2I',      'Dallas',                 'FOX'],
  [77, '2026-06-30T17:00:00-04:00', 'Round of 32', '1I',  '3CDFGH',  'New York/New Jersey',    'FOX'],
  [79, '2026-06-30T21:00:00-04:00', 'Round of 32', '1A',  '3CEFHI',  'Mexico City',            'FOX'],
  [80, '2026-07-01T12:00:00-04:00', 'Round of 32', '1L',  '3EHIJK',  'Atlanta',                'FOX'],
  [82, '2026-07-01T16:00:00-04:00', 'Round of 32', '1G',  '3AEHIJ',  'Seattle',                'FS1'],
  [81, '2026-07-01T20:00:00-04:00', 'Round of 32', '1D',  '3BEFIJ',  'San Francisco Bay Area', 'FOX'],
  [84, '2026-07-02T15:00:00-04:00', 'Round of 32', '1H',  '2J',      'Los Angeles',            'FOX'],
  [83, '2026-07-02T19:00:00-04:00', 'Round of 32', '2K',  '2L',      'Toronto',                'FOX'],
  [85, '2026-07-02T23:00:00-04:00', 'Round of 32', '1B',  '3EFGIJ',  'Vancouver',              'FS1'],
  [88, '2026-07-03T14:00:00-04:00', 'Round of 32', '2D',  '2G',      'Dallas',                 'FOX'],
  [86, '2026-07-03T18:00:00-04:00', 'Round of 32', '1J',  '2H',      'Miami',                  'FOX'],
  [87, '2026-07-03T21:30:00-04:00', 'Round of 32', '1K',  '3DEIJL',  'Kansas City',            'FOX'],
  // ── Round of 16 ──
  [90, '2026-07-04T13:00:00-04:00', 'Round of 16', 'W73', 'W75', 'Houston',             'FOX'],
  [89, '2026-07-04T17:00:00-04:00', 'Round of 16', 'W74', 'W77', 'Philadelphia',        'FOX'],
  [91, '2026-07-05T16:00:00-04:00', 'Round of 16', 'W76', 'W78', 'New York/New Jersey', 'FOX'],
  [92, '2026-07-05T20:00:00-04:00', 'Round of 16', 'W79', 'W80', 'Mexico City',         'FOX'],
  [93, '2026-07-06T15:00:00-04:00', 'Round of 16', 'W83', 'W84', 'Dallas',              'FOX'],
  [94, '2026-07-06T20:00:00-04:00', 'Round of 16', 'W81', 'W82', 'Seattle',             'FOX'],
  [95, '2026-07-07T12:00:00-04:00', 'Round of 16', 'W86', 'W88', 'Atlanta',             'FOX'],
  [96, '2026-07-07T16:00:00-04:00', 'Round of 16', 'W85', 'W87', 'Vancouver',           'FOX'],
  // ── Quarter-finals ──
  [97,  '2026-07-09T16:00:00-04:00', 'Quarter-final', 'W89', 'W90',  'Boston',      'FOX'],
  [98,  '2026-07-10T15:00:00-04:00', 'Quarter-final', 'W93', 'W94',  'Los Angeles', 'FOX'],
  [99,  '2026-07-11T17:00:00-04:00', 'Quarter-final', 'W91', 'W92',  'Miami',       'FOX'],
  [100, '2026-07-11T21:00:00-04:00', 'Quarter-final', 'W95', 'W96',  'Kansas City', 'FOX'],
  // ── Semi-finals ──
  [101, '2026-07-14T15:00:00-04:00', 'Semi-final', 'W97', 'W98',  'Dallas',  'FOX'],
  [102, '2026-07-15T15:00:00-04:00', 'Semi-final', 'W99', 'W100', 'Atlanta', 'FOX'],
  // ── Finals ──
  [103, '2026-07-18T17:00:00-04:00', 'Bronze Final', 'L101', 'L102', 'Miami',               'FOX'],
  [104, '2026-07-19T15:00:00-04:00', 'Final',        'W101', 'W102', 'New York/New Jersey', 'FOX'],
];

export const MATCHES: WatchMatch[] = ROWS
  .map(([no, iso, stage, home, away, venue, network]) => ({
    no, kickoff: new Date(iso).getTime(), stage, home, away, venue, network,
  }))
  .sort((a, b) => a.kickoff - b.kickoff);

// ─── Air-window logic ──────────────────────────────────────────────────────────
// Stream is surfaced from 1h before kickoff through 1h after full time. A match
// is taken to run ~2h (play + half-time + stoppage), so the on-air window spans
// kickoff−1h … kickoff+3h.

const PRE_MS  = 60 * 60 * 1000;       // pre-match: 1h before kickoff
const PLAY_MS = 2 * 60 * 60 * 1000;   // match duration ~2h
const POST_MS = 60 * 60 * 1000;       // 1h after full time

export type MatchPhase = 'pre' | 'live' | 'post';

/** On-air phase for a match at `now`, or null when outside its window. */
export function phaseOf(m: WatchMatch, now: number): MatchPhase | null {
  if (now < m.kickoff - PRE_MS) return null;
  if (now < m.kickoff) return 'pre';
  if (now < m.kickoff + PLAY_MS) return 'live';
  if (now < m.kickoff + PLAY_MS + POST_MS) return 'post';
  return null;
}

const PHASE_RANK: Record<MatchPhase, number> = { live: 0, pre: 1, post: 2 };

/** The match currently on air for a network — prefers live, then pre, then post. */
export function onAirFor(network: Network, now: number): { match: WatchMatch; phase: MatchPhase } | null {
  let best: { match: WatchMatch; phase: MatchPhase } | null = null;
  for (const match of MATCHES) {
    if (match.network !== network) continue;
    const phase = phaseOf(match, now);
    if (!phase) continue;
    if (
      !best ||
      PHASE_RANK[phase] < PHASE_RANK[best.phase] ||
      (PHASE_RANK[phase] === PHASE_RANK[best.phase] &&
        Math.abs(match.kickoff - now) < Math.abs(best.match.kickoff - now))
    ) {
      best = { match, phase };
    }
  }
  return best;
}

/**
 * The match a network should put in focus: a live or pre-match fixture only.
 * A just-ended (post) match is deliberately excluded so Live/Upcoming lead —
 * use {@link postFor} to surface the ended one as a secondary, still-watchable
 * option.
 */
export function focusFor(network: Network, now: number): { match: WatchMatch; phase: MatchPhase } | null {
  const air = onAirFor(network, now);
  return air && air.phase !== 'post' ? air : null;
}

/** A recently-finished match still inside its 1h post-match window, or null. */
export function postFor(network: Network, now: number): WatchMatch | null {
  let best: WatchMatch | null = null;
  for (const match of MATCHES) {
    if (match.network !== network) continue;
    if (phaseOf(match, now) !== 'post') continue;
    if (!best || match.kickoff > best.kickoff) best = match; // most recent
  }
  return best;
}

/** Next not-yet-on-air match for a network. */
export function nextFor(network: Network, now: number): WatchMatch | null {
  for (const match of MATCHES) {
    if (match.network !== network) continue;
    if (phaseOf(match, now)) continue;
    if (match.kickoff > now) return match;
  }
  return null;
}

/**
 * For a fixture identified by team codes, the schedule match that is currently
 * on air (within its stream window), or null. Orientation-agnostic so it works
 * regardless of which side a caller treats as home. Used by the Scores page to
 * deep-link a live/soon match straight to its broadcast channel.
 */
export function findAirByTeams(home: string, away: string, now: number):
  { match: WatchMatch; phase: MatchPhase } | null {
  for (const match of MATCHES) {
    const phase = phaseOf(match, now);
    if (!phase) continue;
    if ((match.home === home && match.away === away) || (match.home === away && match.away === home)) {
      return { match, phase };
    }
  }
  return null;
}
