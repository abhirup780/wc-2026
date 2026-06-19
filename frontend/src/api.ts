/**
 * Data access layer for the frontend.
 *
 * Primary: pre-built JSON artifacts from /public/data/ — never exposes keys.
 * Live overlay: ESPN public scoreboard (CORS-open, no key) polled every 30s
 *   when at least one match is live.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Fixtures, Standings, Scores, Forecast, Prediction, Meta, Upcoming } from '@wc2026/shared';

const BASE = import.meta.env.BASE_URL + 'data';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}?_t=${Date.now()}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchFixtures = (): Promise<Fixtures> => fetchJson<Fixtures>('fixtures.json');
export const fetchStandings = (): Promise<Standings> => fetchJson<Standings>('standings.json');
export const fetchScores = (): Promise<Scores> => fetchJson<Scores>('scores.json');
export const fetchForecast = (): Promise<Forecast> => fetchJson<Forecast>('forecast.json');
export const fetchMeta = (): Promise<Meta> => fetchJson<Meta>('meta.json');
export const fetchPrediction = (): Promise<Prediction> => fetchJson<Prediction>('prediction.json');
export const fetchUpcoming = (): Promise<Upcoming> => fetchJson<Upcoming>('upcoming.json');

// ─── ESPN live overlay ────────────────────────────────────────────────────────

const ESPN_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

export interface ESPNGoal {
  scorer: string;
  minute: string;
  type: 'goal' | 'own-goal' | 'penalty';
  forHome: boolean;
}

export interface ESPNCard {
  player: string;
  minute: string;
  type: 'yellow' | 'red';
  forHome: boolean;
}

export interface ESPNStat {
  label: string;
  home: string;
  away: string;
  /** numeric values used to size the comparison bar */
  homeVal: number;
  awayVal: number;
}

export interface ESPNLineupPlayer {
  name: string;
  jersey: string;
  position: string;
  subbedOut: boolean;
  subbedIn: boolean;
}

export interface ESPNLineup {
  formation: string;
  starters: ESPNLineupPlayer[];
  subs: ESPNLineupPlayer[];
}

export interface ESPNComment {
  minute: string;
  text: string;
}

export interface ESPNH2HGame {
  date: string;
  homeCode: string;
  awayCode: string;
  homeScore: number;
  awayScore: number;
}

export interface ESPNMatchDetail {
  goals: ESPNGoal[];
  cards: ESPNCard[];
  stats: ESPNStat[];
  homeLineup?: ESPNLineup;
  awayLineup?: ESPNLineup;
  referee?: string;
  venue?: string;
  commentary: ESPNComment[];
  h2h: ESPNH2HGame[];
}

export interface ESPNLiveMatch {
  id: string;
  homeCode: string;
  awayCode: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'scheduled' | 'live' | 'finished';
  clock: string;
  venue?: string;
  homeForm?: string;
  awayForm?: string;
}

const ESPN_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';

const EMPTY_DETAIL: ESPNMatchDetail = { goals: [], cards: [], stats: [], commentary: [], h2h: [] };

// Curated, ordered match stats: [ESPN label, display label, format].
// ESPN is inconsistent: possessionPct is already 0–100, but passPct is a 0–1
// ratio — hence the explicit 'pct' vs 'ratio' formats.
type StatFmt = 'num' | 'pct' | 'ratio';
const STAT_SPEC: [string, string, StatFmt][] = [
  ['Possession', 'Possession', 'pct'],
  ['SHOTS', 'Shots', 'num'],
  ['ON GOAL', 'Shots on target', 'num'],
  ['Corner Kicks', 'Corners', 'num'],
  ['Fouls', 'Fouls', 'num'],
  ['Pass Completion %', 'Pass accuracy', 'ratio'],
  ['Saves', 'Saves', 'num'],
  ['Offsides', 'Offsides', 'num'],
  ['Yellow Cards', 'Yellow cards', 'num'],
  ['Red Cards', 'Red cards', 'num'],
];

const toNum = (v?: string) => {
  const n = parseFloat((v ?? '').replace('%', ''));
  return Number.isFinite(n) ? n : 0;
};

function fmtStat(raw: string | undefined, format: StatFmt): string {
  if (raw == null) return format === 'num' ? '0' : '0%';
  if (format === 'ratio') return `${Math.round(toNum(raw) * 100)}%`;
  if (format === 'pct') return `${raw}%`;
  return raw;
}

interface RawSummary {
  keyEvents?: Array<{
    scoringPlay?: boolean;
    type?: { type?: string };
    clock?: { displayValue?: string };
    team?: { id?: string };
    participants?: Array<{ athlete?: { displayName?: string } }>;
    shortText?: string;
  }>;
  boxscore?: { teams?: Array<{ homeAway?: string; statistics?: Array<{ label?: string; displayValue?: string }> }> };
  rosters?: Array<{
    homeAway?: string;
    formation?: string;
    roster?: Array<{
      starter?: boolean; jersey?: string; subbedOut?: boolean; subbedIn?: boolean;
      athlete?: { displayName?: string }; position?: { abbreviation?: string };
    }>;
  }>;
  gameInfo?: {
    venue?: { fullName?: string; address?: { city?: string } };
    officials?: Array<{ fullName?: string; position?: { name?: string } }>;
  };
  commentary?: Array<{ time?: { displayValue?: string }; text?: string }>;
  headToHeadGames?: Array<{ events?: Array<{
    gameDate?: string; homeTeamId?: string; awayTeamId?: string; homeTeamScore?: string; awayTeamScore?: string;
  }> }>;
  header?: { competitions?: Array<{ competitors?: Array<{ homeAway?: string; team?: { id?: string; abbreviation?: string } }> }> };
}

function parseLineup(rosters: RawSummary['rosters'], side: 'home' | 'away'): ESPNLineup | undefined {
  const r = rosters?.find(x => x.homeAway === side);
  if (!r || !r.roster?.length) return undefined;
  const starters: ESPNLineupPlayer[] = [];
  const subs: ESPNLineupPlayer[] = [];
  for (const p of r.roster) {
    const player: ESPNLineupPlayer = {
      name: p.athlete?.displayName ?? '',
      jersey: p.jersey ?? '',
      position: p.position?.abbreviation ?? '',
      subbedOut: !!p.subbedOut,
      subbedIn: !!p.subbedIn,
    };
    (p.starter ? starters : subs).push(player);
  }
  return { formation: r.formation ?? '', starters, subs };
}

/** One rich fetch of ESPN's match summary → goals, cards, stats, lineups, ref, commentary. */
export async function fetchMatchDetail(eventId: string): Promise<ESPNMatchDetail> {
  try {
    const res = await fetch(`${ESPN_SUMMARY}?event=${eventId}`);
    if (!res.ok) return EMPTY_DETAIL;
    const data = await res.json() as RawSummary;

    const homeId = data.header?.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home')?.team?.id;
    const isHome = (id?: string) => id != null && homeId != null && String(id) === String(homeId);

    const goals: ESPNGoal[] = [];
    const cards: ESPNCard[] = [];
    for (const e of data.keyEvents ?? []) {
      const minute = e.clock?.displayValue ?? '';
      const forHome = isHome(e.team?.id);
      const player = e.participants?.[0]?.athlete?.displayName ?? e.shortText ?? '';
      const t = (e.type?.type ?? '').toLowerCase();
      if (e.scoringPlay) {
        const type: ESPNGoal['type'] = t === 'own-goal' ? 'own-goal' : t.includes('penalty') ? 'penalty' : 'goal';
        goals.push({ scorer: player, minute, type, forHome });
      } else if (t.includes('yellow')) {
        cards.push({ player, minute, type: 'yellow', forHome });
      } else if (t.includes('red')) {
        cards.push({ player, minute, type: 'red', forHome });
      }
    }

    const teams = data.boxscore?.teams;
    const home = teams?.find(t => t.homeAway === 'home');
    const away = teams?.find(t => t.homeAway === 'away');
    const statVal = (side: typeof home, label: string) =>
      side?.statistics?.find(s => s.label === label)?.displayValue;
    const stats: ESPNStat[] = [];
    for (const [label, display, format] of STAT_SPEC) {
      const h = statVal(home, label);
      const a = statVal(away, label);
      if (h == null && a == null) continue;
      stats.push({
        label: display,
        home: fmtStat(h, format),
        away: fmtStat(a, format),
        homeVal: toNum(h), awayVal: toNum(a),
      });
    }

    const referee = data.gameInfo?.officials?.find(o => o.position?.name === 'Referee')?.fullName;
    const v = data.gameInfo?.venue;
    const venue = v?.fullName ? [v.fullName, v.address?.city].filter(Boolean).join(' · ') : undefined;

    const commentary: ESPNComment[] = (data.commentary ?? [])
      .map(c => ({ minute: c.time?.displayValue ?? '', text: c.text ?? '' }))
      .filter(c => c.text);

    // Head-to-head: ESPN gives numeric team ids, so map them to our FIFA codes
    // via the header competitors (these games only involve the two teams).
    const idToCode: Record<string, string> = {};
    for (const c of data.header?.competitions?.[0]?.competitors ?? []) {
      if (c.team?.id) idToCode[String(c.team.id)] = c.team.abbreviation ?? '';
    }
    const h2h: ESPNH2HGame[] = (data.headToHeadGames?.[0]?.events ?? [])
      .map(e => ({
        date: e.gameDate ?? '',
        homeCode: idToCode[String(e.homeTeamId)] ?? '',
        awayCode: idToCode[String(e.awayTeamId)] ?? '',
        homeScore: parseInt(e.homeTeamScore ?? '', 10),
        awayScore: parseInt(e.awayTeamScore ?? '', 10),
      }))
      .filter(g => g.homeCode && g.awayCode && Number.isFinite(g.homeScore) && Number.isFinite(g.awayScore))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    return {
      goals, cards, stats,
      homeLineup: parseLineup(data.rosters, 'home'),
      awayLineup: parseLineup(data.rosters, 'away'),
      referee, venue, commentary, h2h,
    };
  } catch {
    return EMPTY_DETAIL;
  }
}

async function fetchESPNLive(): Promise<ESPNLiveMatch[]> {
  const res = await fetch(`${ESPN_URL}?dates=20260611-20260719&limit=200&_t=${Date.now()}`);
  if (!res.ok) throw new Error(`ESPN: ${res.status}`);
  const data = await res.json() as { events?: unknown[] };
  if (!data.events) return [];

  type RawEvent = {
    id: string;
    competitions: Array<{
      competitors: Array<{ homeAway: string; team: { abbreviation: string }; score?: string; form?: string }>;
      venue?: { fullName?: string; address?: { city?: string } };
      status: {
        // ESPN puts the running clock ("23'", "45'+2'") and period directly on
        // `status`, NOT under `status.type` — reading the wrong path left it blank.
        displayClock?: string;
        period?: number;
        type: { state: string; completed: boolean; shortDetail?: string; description?: string };
      };
    }>;
  };

  // The scoreboard already carries everything we poll frequently (score, clock,
  // venue). The expensive per-match summary (goals, cards, stats, lineups,
  // commentary) is fetched lazily by each card via fetchMatchDetail instead, so
  // a board full of finished matches no longer triggers 50+ summary requests.
  return (data.events as RawEvent[]).map(event => {
    const comp = event.competitions[0];
    const home = comp.competitors.find(c => c.homeAway === 'home');
    const away = comp.competitors.find(c => c.homeAway === 'away');
    const st = comp.status.type;
    const status: ESPNLiveMatch['status'] =
      st.completed || st.state === 'post' ? 'finished'
      : st.state === 'in' ? 'live'
      : 'scheduled';
    const dc = comp.status.displayClock?.trim();
    const detail = st.shortDetail?.trim();
    const clock = dc && dc !== '0\'' ? dc : (detail || dc || '');
    const venue = comp.venue?.fullName
      ? [comp.venue.fullName, comp.venue.address?.city].filter(Boolean).join(' · ')
      : undefined;
    return {
      id: event.id,
      homeCode: home?.team.abbreviation ?? '',
      awayCode: away?.team.abbreviation ?? '',
      homeScore: home?.score != null ? parseInt(home.score, 10) : null,
      awayScore: away?.score != null ? parseInt(away.score, 10) : null,
      status,
      clock,
      venue,
      homeForm: home?.form,
      awayForm: away?.form,
    };
  });
}

export function useESPNLive(pollMs = 30_000) {
  const [matches, setMatches] = useState<ESPNLiveMatch[]>([]);
  const [hasLive, setHasLive] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null); // last successful live sync
  const [failed, setFailed] = useState(false);                 // last attempt errored

  const refresh = useCallback(async () => {
    try {
      const data = await fetchESPNLive();
      setMatches(data);
      setHasLive(data.some(m => m.status === 'live'));
      setLastSync(new Date());
      setFailed(false);
    } catch {
      setFailed(true); // keep last good data, but flag that live is unavailable
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollMs);
    // Refetch when the user returns to the tab or restores it from the
    // back/forward (bfcache) cache, so stale snapshots never linger.
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [refresh, pollMs]);

  return { matches, hasLive, lastSync, failed };
}

/**
 * Lazily load a single match's full detail (goals, cards, stats, lineups,
 * referee, commentary). When `pollMs` > 0 it refreshes on an interval — used by
 * live cards so stats and commentary tick along with the match.
 */
export function useMatchDetail(eventId: string | null, pollMs = 0) {
  const [detail, setDetail] = useState<ESPNMatchDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventId) { setDetail(null); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const d = await fetchMatchDetail(eventId);
      if (!cancelled) { setDetail(d); setLoading(false); }
    };
    load();
    const id = pollMs > 0 ? setInterval(load, pollMs) : undefined;
    return () => { cancelled = true; if (id) clearInterval(id); };
  }, [eventId, pollMs]);

  return { detail, loading };
}

// ─── Polling hook ─────────────────────────────────────────────────────────────

interface PolledResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

export function usePolled<T>(
  fetcher: () => Promise<T>,
  intervalMs = 60_000,
): PolledResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetch = useCallback(async () => {
    try {
      const result = await fetcher();
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, intervalMs);
    // Also refetch on tab re-focus / bfcache restore so back-navigation never
    // shows a stale cached snapshot.
    const onVisible = () => { if (document.visibilityState === 'visible') fetch(); };
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) fetch(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [fetch, intervalMs]);

  return { data, loading, error, lastUpdated, refresh: fetch };
}
