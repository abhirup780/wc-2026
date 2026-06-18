/**
 * Data access layer for the frontend.
 *
 * Primary: pre-built JSON artifacts from /public/data/ — never exposes keys.
 * Live overlay: ESPN public scoreboard (CORS-open, no key) polled every 30s
 *   when at least one match is live.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Fixtures, Standings, Scores, Forecast, Prediction, Meta } from '@wc2026/shared';

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

// ─── ESPN live overlay ────────────────────────────────────────────────────────

const ESPN_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

export interface ESPNGoal {
  scorer: string;
  minute: string;
  type: 'goal' | 'own-goal' | 'penalty';
  forHome: boolean;
}

export interface ESPNLiveMatch {
  id: string;
  homeCode: string;
  awayCode: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'scheduled' | 'live' | 'finished';
  clock: string;
  goals: ESPNGoal[];
}

const ESPN_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';

export async function fetchGoalsForEvent(eventId: string, homeCode: string): Promise<ESPNGoal[]> {
  return fetchGoals(eventId, homeCode);
}

async function fetchGoals(eventId: string, homeCode: string): Promise<ESPNGoal[]> {
  try {
    const res = await fetch(`${ESPN_SUMMARY}?event=${eventId}`);
    if (!res.ok) return [];
    const data = await res.json() as {
      keyEvents?: Array<{
        scoringPlay?: boolean;
        type?: { type?: string };
        clock?: { displayValue?: string };
        team?: { displayName?: string };
        participants?: Array<{ athlete?: { displayName?: string } }>;
      }>;
      header?: { competitions?: Array<{ competitors?: Array<{ homeAway?: string; team?: { displayName?: string } }> }> };
    };
    const homeTeamName = data.header?.competitions?.[0]?.competitors
      ?.find(c => c.homeAway === 'home')?.team?.displayName ?? '';
    return (data.keyEvents ?? [])
      .filter(e => e.scoringPlay)
      .map(e => {
        const rawType = e.type?.type ?? 'goal';
        const type: ESPNGoal['type'] =
          rawType === 'own-goal' ? 'own-goal'
          : rawType.includes('penalty') ? 'penalty'
          : 'goal';
        const scorer = e.participants?.[0]?.athlete?.displayName ?? '?';
        const forHome = (e.team?.displayName ?? '') === homeTeamName;
        return { scorer, minute: e.clock?.displayValue ?? '', type, forHome };
      });
  } catch {
    return [];
  }
}

async function fetchESPNLive(): Promise<ESPNLiveMatch[]> {
  const res = await fetch(`${ESPN_URL}?_t=${Date.now()}`);
  if (!res.ok) throw new Error(`ESPN: ${res.status}`);
  const data = await res.json() as { events?: unknown[] };
  if (!data.events) return [];

  type RawEvent = {
    id: string;
    competitions: Array<{
      competitors: Array<{ homeAway: string; team: { abbreviation: string }; score?: string }>;
      status: { type: { state: string; completed: boolean; displayClock?: string } };
    }>;
  };

  const rawMatches = (data.events as RawEvent[]).map(event => {
    const comp = event.competitions[0];
    const home = comp.competitors.find(c => c.homeAway === 'home');
    const away = comp.competitors.find(c => c.homeAway === 'away');
    const st = comp.status.type;
    const status: ESPNLiveMatch['status'] =
      st.completed || st.state === 'post' ? 'finished'
      : st.state === 'in' ? 'live'
      : 'scheduled';
    return {
      id: event.id,
      homeCode: home?.team.abbreviation ?? '',
      awayCode: away?.team.abbreviation ?? '',
      homeScore: home?.score != null ? parseInt(home.score, 10) : null,
      awayScore: away?.score != null ? parseInt(away.score, 10) : null,
      status,
      clock: comp.status.type.displayClock ?? '',
    };
  });

  // Fetch goal scorers for live and today-finished matches (not scheduled)
  const today = new Date().toISOString().slice(0, 10);
  const withGoals = await Promise.all(
    rawMatches.map(async m => {
      const needsGoals = m.status === 'live' || m.status === 'finished';
      const goals = needsGoals ? await fetchGoals(m.id, m.homeCode) : [];
      return { ...m, goals };
    }),
  );

  return withGoals;
  void today; // suppress unused warning
}

export function useESPNLive(pollMs = 30_000) {
  const [matches, setMatches] = useState<ESPNLiveMatch[]>([]);
  const [hasLive, setHasLive] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchESPNLive();
      setMatches(data);
      setHasLive(data.some(m => m.status === 'live'));
    } catch {
      // silent — ESPN is a bonus overlay, not required
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { matches, hasLive };
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
    return () => clearInterval(id);
  }, [fetch, intervalMs]);

  return { data, loading, error, lastUpdated, refresh: fetch };
}
