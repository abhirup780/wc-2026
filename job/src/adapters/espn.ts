/**
 * ESPN public scoreboard API — no key required, CORS-open.
 * One request fetches all 104 WC 2026 matches.
 * ESPN team abbreviations already match our FIFA codes (MEX, BRA, FRA, …).
 */

import type { Team, Match, GroupStanding, MatchStatus, Stage } from '@wc2026/shared';
import { computeStandingsFromMatches } from '../normalize.js';
import { GROUP_TEAMS, TEAM_ELO } from './team-codes.js';
import { strengthFromElo } from '../ratings.js';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

export interface FetchResult {
  teams: Team[];
  matches: Match[];
  standings: GroupStanding[];
  snapshotAt: string;
}

// ─── ESPN raw types ────────────────────────────────────────────────────────────

interface ESPNStatusType { state: 'pre' | 'in' | 'post'; completed: boolean }
interface ESPNCompetitor {
  homeAway: 'home' | 'away';
  team: { abbreviation: string; displayName: string };
  score?: string;
}
interface ESPNCompetition {
  startDate: string;
  status: { type: ESPNStatusType };
  competitors: ESPNCompetitor[];
  altGameNote?: string;
}
interface ESPNEvent {
  id: string;
  date: string;
  season: { slug: string };
  competitions: ESPNCompetition[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugToStage(slug: string): Stage {
  switch (slug) {
    case 'group-stage':    return 'group';
    case 'round-of-32':    return 'r32';
    case 'round-of-16':    return 'r16';
    case 'quarterfinals':  return 'qf';
    case 'semifinals':     return 'sf';
    case '3rd-place-match':return '3rd';
    case 'final':          return 'final';
    default:               return 'group';
  }
}

function toStatus(state: string, completed: boolean): MatchStatus {
  if (state === 'post' || completed) return 'finished';
  if (state === 'in') return 'live';
  return 'scheduled';
}

function isSlotRef(abbr: string): boolean {
  return /^[12][A-L]$/.test(abbr) || /^[WL]\d+$/.test(abbr) ||
    /^(RD|SF|QF)\w*/.test(abbr) || /^3/.test(abbr);
}

function groupIdFromNote(note?: string): string | null {
  const m = note && /Group ([A-L])/i.exec(note);
  return m ? m[1].toUpperCase() : null;
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

export async function fetchFromESPN(): Promise<FetchResult> {
  const res = await fetch(`${BASE}?dates=20260611-20260719&limit=200`);
  if (!res.ok) throw new Error(`ESPN: ${res.status} ${res.statusText}`);
  const data: { events: ESPNEvent[] } = await res.json();

  // Build team registry from known group assignments; use ESPN displayName for readable name
  const displayNames = new Map<string, string>();
  for (const ev of data.events) {
    for (const c of ev.competitions[0]?.competitors ?? []) {
      if (!isSlotRef(c.team.abbreviation)) {
        displayNames.set(c.team.abbreviation, c.team.displayName);
      }
    }
  }

  const teamMap = new Map<string, Team>();
  for (const [groupId, codes] of Object.entries(GROUP_TEAMS)) {
    for (const code of codes) {
      const elo = TEAM_ELO[code] ?? 1500;
      const s = strengthFromElo(elo);
      teamMap.set(code, {
        id: code,
        name: displayNames.get(code) ?? code,
        code,
        groupId,
        rankingElo: elo,
        attackRating:  s,
        defenseRating: s,
      });
    }
  }

  const matches: Match[] = [];
  for (const event of data.events) {
    const comp = event.competitions[0];
    if (!comp) continue;

    const stage    = slugToStage(event.season.slug);
    const groupId  = stage === 'group' ? groupIdFromNote(comp.altGameNote) : null;
    const status   = toStatus(comp.status.type.state, comp.status.type.completed);
    const home     = comp.competitors.find(c => c.homeAway === 'home');
    const away     = comp.competitors.find(c => c.homeAway === 'away');
    if (!home || !away) continue;

    const homeId = isSlotRef(home.team.abbreviation) ? home.team.abbreviation : home.team.abbreviation;
    const awayId = isSlotRef(away.team.abbreviation) ? away.team.abbreviation : away.team.abbreviation;

    const hg = status !== 'scheduled' && home.score != null ? parseInt(home.score, 10) : null;
    const ag = status !== 'scheduled' && away.score != null ? parseInt(away.score, 10) : null;

    matches.push({
      id: `ESPN-${event.id}`,
      stage, groupId, homeId, awayId,
      kickoffUtc: comp.startDate ?? event.date,
      status,
      homeGoals: isNaN(hg as number) ? null : hg,
      awayGoals: isNaN(ag as number) ? null : ag,
      homeGoalsAet: null, awayGoalsAet: null,
      homePens: null, awayPens: null,
    });
  }

  const teams     = [...teamMap.values()];
  const standings = computeStandingsFromMatches(matches, teams);
  return { teams, matches, standings, snapshotAt: new Date().toISOString() };
}
