/** Official FIFA country names (as used on fifa.com). */
export const FIFA_NAMES: Record<string, string> = {
  MEX: 'Mexico',           RSA: 'South Africa',      KOR: 'Korea Republic',    CZE: 'Czechia',
  CAN: 'Canada',           BIH: 'Bosnia & Herz.',     QAT: 'Qatar',             SUI: 'Switzerland',
  BRA: 'Brazil',           MAR: 'Morocco',            HAI: 'Haiti',             SCO: 'Scotland',
  USA: 'USA',              PAR: 'Paraguay',           AUS: 'Australia',         TUR: 'Türkiye',
  GER: 'Germany',          CUW: 'Curaçao',            CIV: 'Côte d\'Ivoire',    ECU: 'Ecuador',
  NED: 'Netherlands',      JPN: 'Japan',              SWE: 'Sweden',            TUN: 'Tunisia',
  BEL: 'Belgium',          EGY: 'Egypt',              IRN: 'IR Iran',           NZL: 'New Zealand',
  ESP: 'Spain',            CPV: 'Cape Verde',         KSA: 'Saudi Arabia',      URU: 'Uruguay',
  FRA: 'France',           SEN: 'Senegal',            IRQ: 'Iraq',              NOR: 'Norway',
  ARG: 'Argentina',        ALG: 'Algeria',            AUT: 'Austria',           JOR: 'Jordan',
  POR: 'Portugal',         COD: 'DR Congo',           UZB: 'Uzbekistan',        COL: 'Colombia',
  ENG: 'England',          CRO: 'Croatia',            GHA: 'Ghana',             PAN: 'Panama',
};

/** Full FIFA name for a code, falls back to the code itself. */
export function teamName(code: string): string {
  return FIFA_NAMES[code] ?? code;
}

/** flagcdn.com alpha-2 codes (lowercase, supports gb-sct / gb-eng subdivisions). */
const FIFA_TO_FLAGCDN: Record<string, string> = {
  MEX: 'mx', RSA: 'za', KOR: 'kr', CZE: 'cz',
  CAN: 'ca', BIH: 'ba', QAT: 'qa', SUI: 'ch',
  BRA: 'br', MAR: 'ma', HAI: 'ht', SCO: 'gb-sct',
  USA: 'us', PAR: 'py', AUS: 'au', TUR: 'tr',
  GER: 'de', CUW: 'cw', CIV: 'ci', ECU: 'ec',
  NED: 'nl', JPN: 'jp', SWE: 'se', TUN: 'tn',
  BEL: 'be', EGY: 'eg', IRN: 'ir', NZL: 'nz',
  ESP: 'es', CPV: 'cv', KSA: 'sa', URU: 'uy',
  FRA: 'fr', SEN: 'sn', IRQ: 'iq', NOR: 'no',
  ARG: 'ar', ALG: 'dz', AUT: 'at', JOR: 'jo',
  POR: 'pt', COD: 'cd', UZB: 'uz', COL: 'co',
  ENG: 'gb-eng', CRO: 'hr', GHA: 'gh', PAN: 'pa',
};

/** Returns a flagcdn.com image URL for the given FIFA code. */
export function flagUrl(code: string, width = 40): string {
  const fc = FIFA_TO_FLAGCDN[code];
  if (!fc) return '';
  return `https://flagcdn.com/w${width}/${fc}.png`;
}

/** @deprecated use flagUrl() + <img> instead — emoji don't render on Windows */
export function flagEmoji(code: string): string {
  const fc = FIFA_TO_FLAGCDN[code];
  if (!fc || fc.includes('-')) return '🏳';
  const codePoints = [...fc.toUpperCase()].map(c => 0x1f1a5 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function pct(p: number, decimals = 1): string {
  return (p * 100).toFixed(decimals) + '%';
}

export function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (Math.abs(diffMin) < 1) return 'just now';
  if (diffMin > 0) return `${diffMin}m ago`;
  return `in ${-diffMin}m`;
}
