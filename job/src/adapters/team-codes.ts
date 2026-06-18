/** Map from openfootball full-name to FIFA 3-letter code */
export const NAME_TO_CODE: Record<string, string> = {
  // Group A
  'Mexico': 'MEX',
  'South Africa': 'RSA',
  'South Korea': 'KOR',
  'Czech Republic': 'CZE',
  // Group B
  'Canada': 'CAN',
  'Bosnia & Herzegovina': 'BIH',
  'Qatar': 'QAT',
  'Switzerland': 'SUI',
  // Group C
  'Brazil': 'BRA',
  'Morocco': 'MAR',
  'Haiti': 'HAI',
  'Scotland': 'SCO',
  // Group D
  'USA': 'USA',
  'Paraguay': 'PAR',
  'Australia': 'AUS',
  'Turkey': 'TUR',
  // Group E
  'Germany': 'GER',
  'Curaçao': 'CUW',
  'Ivory Coast': 'CIV',
  'Ecuador': 'ECU',
  // Group F
  'Netherlands': 'NED',
  'Japan': 'JPN',
  'Sweden': 'SWE',
  'Tunisia': 'TUN',
  // Group G
  'Belgium': 'BEL',
  'Egypt': 'EGY',
  'Iran': 'IRN',
  'New Zealand': 'NZL',
  // Group H
  'Spain': 'ESP',
  'Cape Verde': 'CPV',
  'Saudi Arabia': 'KSA',
  'Uruguay': 'URU',
  // Group I
  'France': 'FRA',
  'Senegal': 'SEN',
  'Iraq': 'IRQ',
  'Norway': 'NOR',
  // Group J
  'Argentina': 'ARG',
  'Algeria': 'ALG',
  'Austria': 'AUT',
  'Jordan': 'JOR',
  // Group K
  'Portugal': 'POR',
  'DR Congo': 'COD',
  'Uzbekistan': 'UZB',
  'Colombia': 'COL',
  // Group L
  'England': 'ENG',
  'Croatia': 'CRO',
  'Ghana': 'GHA',
  'Panama': 'PAN',
};

export const GROUP_TEAMS: Record<string, string[]> = {
  A: ['MEX', 'RSA', 'KOR', 'CZE'],
  B: ['CAN', 'BIH', 'QAT', 'SUI'],
  C: ['BRA', 'MAR', 'HAI', 'SCO'],
  D: ['USA', 'PAR', 'AUS', 'TUR'],
  E: ['GER', 'CUW', 'CIV', 'ECU'],
  F: ['NED', 'JPN', 'SWE', 'TUN'],
  G: ['BEL', 'EGY', 'IRN', 'NZL'],
  H: ['ESP', 'CPV', 'KSA', 'URU'],
  I: ['FRA', 'SEN', 'IRQ', 'NOR'],
  J: ['ARG', 'ALG', 'AUT', 'JOR'],
  K: ['POR', 'COD', 'UZB', 'COL'],
  L: ['ENG', 'CRO', 'GHA', 'PAN'],
};

/**
 * Official pre-WC FIFA/Coca-Cola World Ranking points (men's) as of the day
 * before WC 2026 kick-off. These seed the FIFA SUM model and are updated
 * in-tournament by applyInTournamentUpdates() using FIFA's SUM formula.
 * Read with the /600 win-prob curve in ratings.ts — do NOT mix with the
 * older eloratings.net /400 scale.
 */
export const TEAM_ELO: Record<string, number> = {
  // Group A
  MEX: 1687.48, RSA: 1428.38, KOR: 1591.63, CZE: 1505.74,
  // Group B
  CAN: 1559.48, BIH: 1387.22, QAT: 1450.31, SUI: 1650.06,
  // Group C
  BRA: 1765.86, MAR: 1755.10, HAI: 1293.10, SCO: 1503.34,
  // Group D
  USA: 1671.23, PAR: 1505.35, AUS: 1579.34, TUR: 1605.73,
  // Group E
  GER: 1735.77, CUW: 1294.77, CIV: 1540.87, ECU: 1598.52,
  // Group F
  NED: 1753.57, JPN: 1661.58, SWE: 1509.79, TUN: 1476.41,
  // Group G
  BEL: 1742.24, EGY: 1562.37, IRN: 1619.58, NZL: 1275.58,
  // Group H
  ESP: 1874.71, CPV: 1371.11, KSA: 1423.88, URU: 1673.07,
  // Group I
  FRA: 1870.70, SEN: 1684.07, IRQ: 1446.28, NOR: 1557.44,
  // Group J
  ARG: 1877.27, ALG: 1571.03, AUT: 1597.40, JOR: 1387.74,
  // Group K
  POR: 1767.85, COD: 1474.43, UZB: 1458.73, COL: 1698.35,
  // Group L
  ENG: 1828.02, CRO: 1714.87, GHA: 1346.88, PAN: 1539.16,
};

export function nameToCode(name: string): string {
  return NAME_TO_CODE[name] ?? name.substring(0, 3).toUpperCase();
}
