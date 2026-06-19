import fs from 'fs';
import path from 'path';
import { CONFIG } from './config.js';
import { fetchFromESPN } from './adapters/espn.js';
import { fetchOdds } from './adapters/odds-api.js';
import { fetchOutrightOdds } from './adapters/outrights-api.js';
import { computeStandingsFromMatches } from './normalize.js';
import { applyInTournamentUpdates, regressEloToMean } from './ratings.js';
import { runSimulation } from './sim/engine.js';
import { predictTournament } from './sim/predict.js';
import { predictUpcoming } from './sim/upcoming.js';
import { readOddsCache, writeOddsCache, mapToObj, objToMap } from './odds-cache.js';
import { writeArtifacts } from './write-artifacts.js';
import type { Fixtures, Standings, Scores, Forecast, Meta, Match } from '@wc2026/shared';
import type { MatchOdds } from './sim/poisson.js';

/** True if any match's status or score differs from the last committed fixtures. */
function matchesChanged(prev: Match[], cur: Match[]): boolean {
  if (prev.length !== cur.length) return true;
  const key = (m: Match) => `${m.status}:${m.homeGoals}:${m.awayGoals}`;
  const prevById = new Map(prev.map(m => [m.id, key(m)]));
  return cur.some(m => prevById.get(m.id) !== key(m));
}

function readPrevMatches(dir: string): Match[] | null {
  try {
    return (JSON.parse(fs.readFileSync(path.join(dir, 'fixtures.json'), 'utf8')) as Fixtures).matches;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  console.log(`WC 2026 job [${new Date().toISOString()}]  n=${CONFIG.simCount}`);

  // 1. Fetch live data from ESPN
  console.log('Fetching from ESPN…');
  const { teams: rawTeams, matches, snapshotAt } = await fetchFromESPN();
  console.log(`ESPN: ${matches.length} matches, ${rawTeams.length} teams`);

  // 1a. Decide whether there is anything to do. Re-run the sim whenever a match
  //     result changed; refresh odds from the API only when the cache is stale.
  //     If nothing changed and odds are fresh, exit early — no API calls, no
  //     no-op commits. This lets the sim update after every match cheaply.
  const prevMatches = readPrevMatches(CONFIG.outputDir);
  const matchChanged = !prevMatches || matchesChanged(prevMatches, matches);

  const cache = readOddsCache(CONFIG.oddsCachePath);
  const cacheAgeMs = cache ? Date.now() - new Date(cache.fetchedAt).getTime() : Infinity;
  const oddsStale = !!CONFIG.oddsApiKey && cacheAgeMs > CONFIG.oddsTtlHours * 3_600_000;

  if (!matchChanged && !oddsStale) {
    console.log(`No match changes; odds fresh (${(cacheAgeMs / 3.6e6).toFixed(1)}h old). Skipping.`);
    return;
  }
  console.log(`Proceeding — matchChanged=${matchChanged}, oddsStale=${oddsStale}`);

  // 1a.i Resolve odds: refresh from the API when stale, else reuse the cache.
  let oddsMap: Map<string, MatchOdds> | undefined;
  let outrightOdds: Map<string, number> | undefined;
  if (oddsStale) {
    try {
      if (CONFIG.model.blendOddsWeight > 0) {
        oddsMap = await fetchOdds(CONFIG.oddsApiKey, CONFIG.oddsApiBase);
        console.log(`Match odds: ${oddsMap.size} matches (fresh)`);
      }
      if (CONFIG.outrightOddsWeight > 0) {
        outrightOdds = await fetchOutrightOdds(CONFIG.oddsApiKey, CONFIG.oddsApiBase);
      }
      writeOddsCache(CONFIG.oddsCachePath, {
        fetchedAt: new Date().toISOString(),
        matchOdds: mapToObj(oddsMap),
        outrights: mapToObj(outrightOdds),
      });
    } catch (err) {
      console.warn('Odds fetch failed, falling back to cache:', (err as Error).message);
    }
  }
  // Fall back to (or use) cached odds whenever we didn't fetch fresh ones.
  if (!oddsMap && cache) {
    oddsMap = objToMap<MatchOdds>(cache.matchOdds);
    console.log(`Match odds: ${oddsMap.size} matches (cached, ${(cacheAgeMs / 3.6e6).toFixed(1)}h old)`);
  }
  if (!outrightOdds && cache) outrightOdds = objToMap<number>(cache.outrights);

  // 1b. Regress Elo toward the field mean (reduce overconfidence in extreme ratings)
  //     Applied before both baseline and main sim for consistency.
  {
    const regMap = new Map(rawTeams.map(t => [t.id, t]));
    regressEloToMean(regMap, CONFIG.model.eloRegressionFactor);
    console.log(`Elo regression: factor=${CONFIG.model.eloRegressionFactor}`);
  }

  // 2a. Baseline simulation — initial (regressed) Elo, all matches treated as unplayed.
  //     Used only to compute pChampionInitial for the trend arrow in the UI.
  const allScheduled = matches.map(m => ({ ...m, status: 'scheduled' as const, homeGoals: null, awayGoals: null }));
  const baselineResult = runSimulation(rawTeams, allScheduled, {
    simCount: Math.min(CONFIG.simCount, 5000),
    seed: CONFIG.seed,
    model: CONFIG.model,
    oddsMap: undefined,
  });
  // Mutable so we can apply the same outright blend later (apples-to-apples comparison)
  const baselineMap = new Map(baselineResult.teams.map(t => [t.teamId, t.pChampion]));

  // 2b. Apply in-tournament Elo updates from ALL finished matches (group + knockout)
  //     Sorted chronologically so Elo updates accumulate in match order.
  const teamMap = new Map(rawTeams.map(t => [t.id, { ...t }]));
  const finishedMatches = matches
    .filter(m => m.status === 'finished')
    .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());
  applyInTournamentUpdates(teamMap, finishedMatches);
  console.log(`Elo updates: ${finishedMatches.length} finished matches`);
  const teams = [...teamMap.values()];

  // 3. Current group standings
  const allStandings = computeStandingsFromMatches(matches, teams);
  const groupIds = [...new Set(teams.map(t => t.groupId).filter(Boolean))].sort() as string[];
  const groupedStandings: Record<string, typeof allStandings> = {};
  for (const gid of groupIds) {
    groupedStandings[gid] = allStandings.filter(s => s.groupId === gid);
  }

  // 6. Monte Carlo simulation
  console.log(`Simulating ${CONFIG.simCount.toLocaleString()} tournaments…`);
  const simResult = runSimulation(teams, matches, {
    simCount: CONFIG.simCount,
    seed: CONFIG.seed,
    model: CONFIG.model,
    oddsMap,
  });

  // 7a. Floor: any team still with group matches left is never shown as literally 0%
  {
    const pendingGroupMatches = new Set(
      matches
        .filter(m => m.stage === 'group' && m.status !== 'finished')
        .flatMap(m => [m.homeId, m.awayId]),
    );
    const floor = 1 / CONFIG.simCount;
    for (const team of simResult.teams) {
      if (pendingGroupMatches.has(team.code) && team.pAdvanceGroup < floor) {
        team.pAdvanceGroup = floor;
        team.pReachR16     = floor;
      }
    }
  }

  // 7b. Blend pChampion with outright market odds (current sim + baseline equally)
  //     Applying the same blend to both ensures the trend arrow reflects only the
  //     impact of match results, not a model vs. market comparison.
  //     Capture model-only (pre-blend) and market-only values for the UI toggle.
  for (const team of simResult.teams) team.pChampionModel = team.pChampion;
  if (outrightOdds && CONFIG.outrightOddsWeight > 0) {
    const w = CONFIG.outrightOddsWeight;
    for (const team of simResult.teams) {
      const mktP = outrightOdds.get(team.code);
      if (mktP != null) team.pChampionMarket = mktP;
      if (mktP != null && team.pAdvanceGroup >= 0.005) {
        team.pChampion = (1 - w) * team.pChampion + w * mktP;
      }
    }
    // Apply the same blend to baseline so trend arrow = match-result impact only
    for (const [teamId, baseP] of baselineMap) {
      const mktP = outrightOdds.get(teamId);
      if (mktP != null) {
        baselineMap.set(teamId, (1 - w) * baseP + w * mktP);
      }
    }
    console.log(`Champion: ${(w * 100).toFixed(0)}% market + ${((1-w)*100).toFixed(0)}% model`);
  }

  // 8. Attach baseline to each team for trend arrows in the UI
  for (const team of simResult.teams) {
    team.pChampionInitial = baselineMap.get(team.teamId) ?? 0;
  }

  // 9. Deterministic "best guess" prediction (one representative tournament path)
  //    Blends bookmaker match odds into scorelines when available (like the forecast).
  const prediction = predictTournament(teams, matches, CONFIG.model, oddsMap);
  console.log(`Predicted champion: ${prediction.champion}`);

  // 9b. Next 5 upcoming-match predictions (model 1X2 blended with market odds)
  const upcomingMatches = predictUpcoming(teams, matches, oddsMap, CONFIG.model, 5);
  console.log(`Upcoming predictions: ${upcomingMatches.length} (market blended: ${upcomingMatches.filter(u => u.marketBlended).length})`);

  // 10. Write artifacts
  const forecast: Forecast = { ...simResult, dataSnapshotTimestamp: snapshotAt };

  await writeArtifacts({
    fixtures: { teams, matches, groups: groupIds },
    standings: { timestamp: snapshotAt, groups: groupedStandings },
    scores: {
      timestamp: snapshotAt,
      matches: matches.filter(m => {
        const dayMs = 7 * 24 * 60 * 60 * 1000;
        return m.status !== 'scheduled' || Math.abs(Date.now() - new Date(m.kickoffUtc).getTime()) < dayMs;
      }),
    },
    forecast,
    prediction,
    upcoming: { timestamp: snapshotAt, blendWeight: oddsMap ? CONFIG.model.blendOddsWeight : 0, matches: upcomingMatches },
    meta: {
      dataSource: 'espn',
      lastUpdated: snapshotAt,
      seed: CONFIG.seed,
      simCount: CONFIG.simCount,
      version: CONFIG.version,
    } satisfies Meta,
  }, CONFIG.outputDir);

  const top5 = [...forecast.teams].sort((a, b) => b.pChampion - a.pChampion).slice(0, 5);
  console.log('\nTop 5:');
  for (const t of top5) console.log(`  ${t.code.padEnd(4)} ${(t.pChampion * 100).toFixed(1)}%`);
  console.log(`\nDone [${new Date().toISOString()}]`);
}

main().catch(err => { console.error(err); process.exit(1); });
