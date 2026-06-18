/**
 * Next-N upcoming-match predictions.
 *
 * For each soonest-kicking unplayed match with both teams known, compute the
 * model's 1X2 probabilities (Dixon-Coles Poisson) and blend them with the
 * bookmaker market when odds are available. Group matches use the base goal
 * rate; knockout matches use the reduced knockout rate.
 */

import type { Team, Match, ModelConfig, UpcomingMatch } from '@wc2026/shared';
import { matchOutcomeProbs, type MatchOdds } from './poisson.js';

export function predictUpcoming(
  teams: Team[],
  matches: Match[],
  oddsMap: Map<string, MatchOdds> | undefined,
  config: ModelConfig,
  count = 5,
): UpcomingMatch[] {
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const w = oddsMap ? config.blendOddsWeight : 0;

  const soonest = matches
    .filter(m => m.status === 'scheduled')
    .filter(m => teamMap.has(m.homeId) && teamMap.has(m.awayId))
    .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime())
    .slice(0, count);

  return soonest.map(m => {
    const home = teamMap.get(m.homeId)!;
    const away = teamMap.get(m.awayId)!;
    const rate = m.stage === 'group'
      ? config.baseGoalsRate
      : config.baseGoalsRate * config.knockoutGoalsMultiplier;

    const { pHome, pDraw, pAway, lH, lA } = matchOutcomeProbs(home, away, rate);

    let bHome = pHome, bDraw = pDraw, bAway = pAway;
    let marketBlended = false;
    const mkt = oddsMap?.get(`${m.homeId}|${m.awayId}`);
    if (mkt && w > 0) {
      bHome = (1 - w) * pHome + w * mkt.homeWinP;
      bDraw = (1 - w) * pDraw + w * mkt.drawP;
      bAway = (1 - w) * pAway + w * mkt.awayWinP;
      const s = bHome + bDraw + bAway;
      bHome /= s; bDraw /= s; bAway /= s;
      marketBlended = true;
    }

    return {
      id: m.id,
      stage: m.stage,
      groupId: m.groupId,
      homeId: m.homeId,
      awayId: m.awayId,
      kickoffUtc: m.kickoffUtc,
      homeXg: lH,
      awayXg: lA,
      pHome: bHome,
      pDraw: bDraw,
      pAway: bAway,
      marketBlended,
    };
  });
}
