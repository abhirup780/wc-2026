/**
 * Fetches FIFA World Cup 2026 tournament winner (outright) odds from
 * The Odds API — sport key: soccer_fifa_world_cup_winner.
 *
 * Averages implied probabilities across all available bookmakers,
 * removes overround (normalises to sum = 1.0), and returns a Map<code, prob>.
 *
 * These are used to directly set (or heavily weight) pChampion in the forecast.
 * Betfair exchange prices (betfair_ex_eu / betfair_ex_uk) carry extra weight
 * because they have lower overround than traditional bookmakers.
 */

import { NAME_TO_CODE } from './team-codes.js';

const SPORT_KEY = 'soccer_fifa_world_cup_winner';

/** Bookmakers to give extra weight (exchanges have lower overround) */
const EXCHANGE_KEYS = new Set(['betfair_ex_eu', 'betfair_ex_uk', 'smarkets']);

/** Map The Odds API team names to our FIFA codes */
const OUTRIGHT_NAME_TO_CODE: Record<string, string> = {
  ...NAME_TO_CODE,
  'United States': 'USA',
  'USA': 'USA',
  'South Korea': 'KOR',
  'Korea Republic': 'KOR',
  'DR Congo': 'COD',
  'Democratic Republic of Congo': 'COD',
  'Bosnia and Herzegovina': 'BIH',
  'Bosnia & Herzegovina': 'BIH',
  'Czech Republic': 'CZE',
  'Czechia': 'CZE',
  "Ivory Coast": 'CIV',
  "Cote d'Ivoire": 'CIV',
  'Cape Verde Islands': 'CPV',
  'Cape Verde': 'CPV',
  'Saudi Arabia': 'KSA',
  'Iran': 'IRN',
  'New Zealand': 'NZL',
  'Curaçao': 'CUW',
};

function toCode(name: string): string {
  return OUTRIGHT_NAME_TO_CODE[name] ?? name.substring(0, 3).toUpperCase();
}

/**
 * Fetch, average, and normalise tournament winner probabilities.
 * Returns Map<FIFA_code, probability>, summing to 1.0 across all 48 teams.
 */
export async function fetchOutrightOdds(
  apiKey: string,
  baseUrl: string,
): Promise<Map<string, number>> {
  const url =
    `${baseUrl}/sports/${SPORT_KEY}/odds/` +
    `?apiKey=${apiKey}&regions=eu,uk,us&markets=outrights&oddsFormat=decimal`;

  const res = await fetch(url);
  const remaining = res.headers.get('x-requests-remaining');
  if (remaining) console.log(`[outrights-api] requests remaining: ${remaining}`);
  if (!res.ok) throw new Error(`outrights-api: ${res.status} ${res.statusText}`);

  const events: any[] = await res.json();
  if (!events.length) throw new Error('outrights-api: no events returned');

  // Aggregate implied probabilities per team across bookmakers
  const teamProbs = new Map<string, { weightedSum: number; totalWeight: number }>();

  for (const event of events) {
    for (const bm of event.bookmakers) {
      const market = bm.markets?.[0];
      if (!market?.outcomes) continue;

      // Compute overround for this bookmaker's book
      const rawSum = market.outcomes.reduce((s: number, o: any) => s + 1 / o.price, 0);
      const bmWeight = EXCHANGE_KEYS.has(bm.key) ? 2.0 : 1.0; // exchanges weighted more

      for (const outcome of market.outcomes) {
        const code = toCode(outcome.name);
        const impliedP = (1 / outcome.price) / rawSum; // remove overround
        const cur = teamProbs.get(code) ?? { weightedSum: 0, totalWeight: 0 };
        cur.weightedSum  += impliedP * bmWeight;
        cur.totalWeight  += bmWeight;
        teamProbs.set(code, cur);
      }
    }
  }

  // Average across bookmakers
  const rawMap = new Map<string, number>();
  for (const [code, { weightedSum, totalWeight }] of teamProbs) {
    rawMap.set(code, weightedSum / totalWeight);
  }

  // Normalise to sum = 1.0
  const total = [...rawMap.values()].reduce((s, v) => s + v, 0);
  const result = new Map<string, number>();
  for (const [code, p] of rawMap) result.set(code, p / total);

  console.log(`[outrights-api] ${result.size} teams with market data`);
  return result;
}
