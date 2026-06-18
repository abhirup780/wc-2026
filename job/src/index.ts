import { CONFIG } from './config.js';
import { fetchFromESPN } from './adapters/espn.js';
import { fetchOdds } from './adapters/odds-api.js';
import { fetchOutrightOdds } from './adapters/outrights-api.js';
import { computeStandingsFromMatches } from './normalize.js';
import { applyInTournamentUpdates, regressEloToMean } from './ratings.js';
import { runSimulation } from './sim/engine.js';
import { predictTournament } from './sim/predict.js';
import { predictUpcoming } from './sim/upcoming.js';
import { writeArtifacts } from './write-artifacts.js';
import type { Fixtures, Standings, Scores, Forecast, Meta } from '@wc2026/shared';
import type { MatchOdds } from './sim/poisson.js';

async function main(): Promise<void> {
  console.log(`WC 2026 job [${new Date().toISOString()}]  n=${CONFIG.simCount}`);

  // 1. Fetch live data from ESPN
  console.log('Fetching from ESPN…');
  const { teams: rawTeams, matches, snapshotAt } = await fetchFromESPN();
  console.log(`ESPN: ${matches.length} matches, ${rawTeams.length} teams`);

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

  // 4. Match-level odds (blend into group-stage simulation)
  let oddsMap: Map<string, MatchOdds> | undefined;
  if (CONFIG.oddsApiKey && CONFIG.model.blendOddsWeight > 0) {
    try {
      oddsMap = await fetchOdds(CONFIG.oddsApiKey, CONFIG.oddsApiBase);
      console.log(`Match odds: ${oddsMap.size} matches`);
    } catch (err) {
      console.warn('Match odds unavailable:', (err as Error).message);
    }
  }

  // 5. Tournament winner outright odds
  let outrightOdds: Map<string, number> | undefined;
  if (CONFIG.oddsApiKey && CONFIG.outrightOddsWeight > 0) {
    try {
      outrightOdds = await fetchOutrightOdds(CONFIG.oddsApiKey, CONFIG.oddsApiBase);
    } catch (err) {
      console.warn('Outright odds unavailable:', (err as Error).message);
    }
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
  if (outrightOdds && CONFIG.outrightOddsWeight > 0) {
    const w = CONFIG.outrightOddsWeight;
    for (const team of simResult.teams) {
      const mktP = outrightOdds.get(team.code);
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
  const prediction = predictTournament(teams, matches, CONFIG.model);
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
