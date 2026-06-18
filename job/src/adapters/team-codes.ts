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
 * Validated Elo ratings from www.eloratings.net as of June 10, 2026
 * (day before WC 2026 kick-off). These are updated in-tournament by
 * applyInTournamentUpdates() using the eloratings.net K=60 formula.
 */
export const TEAM_ELO: Record<string, number> = {
  // Group A
  MEX: 1875, RSA: 1517, KOR: 1758, CZE: 1740,
  // Group B
  CAN: 1788, BIH: 1595, QAT: 1421, SUI: 1891,
  // Group C
  BRA: 1991, MAR: 1827, HAI: 1548, SCO: 1782,
  // Group D
  USA: 1726, PAR: 1834, AUS: 1777, TUR: 1911,
  // Group E
  GER: 1932, CUW: 1434, CIV: 1695, ECU: 1938,
  // Group F
  NED: 1948, JPN: 1906, SWE: 1712, TUN: 1628,
  // Group G
  BEL: 1894, EGY: 1696, IRN: 1772, NZL: 1562,
  // Group H
  ESP: 2157, CPV: 1578, KSA: 1576, URU: 1892,
  // Group I
  FRA: 2063, SEN: 1860, IRQ: 1607, NOR: 1914,
  // Group J
  ARG: 2115, ALG: 1772, AUT: 1830, JOR: 1680,
  // Group K
  POR: 1989, COD: 1652, UZB: 1714, COL: 1982,
  // Group L
  ENG: 2024, CRO: 1912, GHA: 1510, PAN: 1730,
};

export function nameToCode(name: string): string {
  return NAME_TO_CODE[name] ?? name.substring(0, 3).toUpperCase();
}
