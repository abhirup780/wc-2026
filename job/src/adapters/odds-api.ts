/**
 * The Odds API adapter (https://the-odds-api.com)
 *
 * Free tier: 500 requests/month. Sign up at the-odds-api.com for a free key
 * and set ODDS_API_KEY in the GitHub Actions secret (and .env locally).
 *
 * Fetches h2h (1X2) market for upcoming FIFA World Cup matches, averages
 * decimal odds across all available bookmakers, and returns normalised
 * implied probabilities keyed as "homeId|awayId".
 *
 * SECURITY: The key only lives in the GitHub Actions secret / .env.
 * It is never written to any frontend output file.
 */

import type { MatchOdds } from '../sim/poisson.js';
import { NAME_TO_CODE } from './team-codes.js';

interface OddsApiOutcome {
  name: string;
  price: number;
}

interface OddsApiMarket {
  key: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  key: string;
  markets: OddsApiMarket[];
}

interface OddsApiEvent {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: OddsApiBookmaker[];
}

/** Map The Odds API full team names to our FIFA codes */
const ODDS_NAME_TO_CODE: Record<string, string> = {
  ...NAME_TO_CODE,
  // Overrides for names that differ from openfootball
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
};

function toCode(name: string): string {
  return ODDS_NAME_TO_CODE[name] ?? NAME_TO_CODE[name] ?? name.substring(0, 3).toUpperCase();
}

function normalise(home: number, draw: number, away: number): MatchOdds {
  const total = home + draw + away;
  return {
    homeWinP: home / total,
    drawP: draw / total,
    awayWinP: away / total,
  };
}

/**
 * Fetch market odds for all upcoming WC 2026 matches.
 *
 * Returns a Map keyed by "homeCode|awayCode" (e.g. "POR|COD").
 * Only matches with ≥1 bookmaker are included.
 */
export async function fetchOdds(
  apiKey: string,
  baseUrl: string,
): Promise<Map<string, MatchOdds>> {
  const url =
    `${baseUrl}/sports/soccer_fifa_world_cup/odds/` +
    `?apiKey=${apiKey}&regions=eu&markets=h2h&oddsFormat=decimal`;

  const res = await fetch(url);
  if (!res.ok) {
    const remaining = res.headers.get('x-requests-remaining') ?? '?';
    throw new Error(
      `The Odds API: ${res.status} ${res.statusText} (remaining: ${remaining})`,
    );
  }

  const events: OddsApiEvent[] = await res.json();
  const remaining = res.headers.get('x-requests-remaining');
  if (remaining) {
    console.log(`[odds-api] requests remaining this month: ${remaining}`);
  }

  const map = new Map<string, MatchOdds>();

  for (const event of events) {
    const homeCode = toCode(event.home_team);
    const awayCode = toCode(event.away_team);

    // Collect h2h outcomes from each bookmaker, then average
    const homePrices: number[] = [];
    const drawPrices: number[] = [];
    const awayPrices: number[] = [];

    for (const bm of event.bookmakers) {
      const h2h = bm.markets.find(mk => mk.key === 'h2h');
      if (!h2h) continue;

      const homeOut = h2h.outcomes.find(o => toCode(o.name) === homeCode);
      const awayOut = h2h.outcomes.find(o => toCode(o.name) === awayCode);
      const drawOut = h2h.outcomes.find(
        o => o.name.toLowerCase() === 'draw',
      );

      if (homeOut && awayOut && drawOut) {
        homePrices.push(1 / homeOut.price);
        drawPrices.push(1 / drawOut.price);
        awayPrices.push(1 / awayOut.price);
      }
    }

    if (homePrices.length === 0) continue;

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    map.set(
      `${homeCode}|${awayCode}`,
      normalise(avg(homePrices), avg(drawPrices), avg(awayPrices)),
    );
  }

  return map;
}
