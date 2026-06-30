// ============================================================
//  Team-name normalization (provider name -> our canonical name)
// ============================================================
// Our canonical team names + abbreviations are the ones used by the seed and the
// shared bracket wiring (apps/api/src/scripts/seed.ts). A score provider almost
// never spells every nation the same way we do, so every provider name passes
// through normalizeTeamName() before it touches the Tournament doc.
//
// Add a new provider? Extend `aliases` below; nothing else changes.

export interface TeamMeta {
  name: string;   // canonical name (must match seed / bracket wiring exactly)
  abbr: string;   // canonical 3-letter abbreviation (used by remaining-fixtures)
  aliases?: string[]; // alternative spellings seen from providers
}

// 48 nations of the 2026 finals. `name`/`abbr` are copied verbatim from the seed
// snapshot so resolveR32 / rankGroup line up. `aliases` cover API-Football today
// and leave room for a second provider (SofaScore) later.
export const TEAMS: TeamMeta[] = [
  { name: 'Mexico', abbr: 'MEX' },
  { name: 'South Africa', abbr: 'RSA' },
  { name: 'Korea Republic', abbr: 'KOR', aliases: ['South Korea', 'Korea, South'] },
  { name: 'Czechia', abbr: 'CZE', aliases: ['Czech Republic'] },
  { name: 'Switzerland', abbr: 'SUI' },
  { name: 'Canada', abbr: 'CAN' },
  { name: 'Bosnia & Herz.', abbr: 'BIH', aliases: ['Bosnia & Herzegovina', 'Bosnia and Herzegovina', 'Bosnia'] },
  { name: 'Qatar', abbr: 'QAT' },
  { name: 'Brazil', abbr: 'BRA' },
  { name: 'Morocco', abbr: 'MAR' },
  { name: 'Scotland', abbr: 'SCO' },
  { name: 'Haiti', abbr: 'HAI' },
  { name: 'USA', abbr: 'USA', aliases: ['United States', 'United States of America', 'USA Men'] },
  { name: 'Australia', abbr: 'AUS' },
  { name: 'Paraguay', abbr: 'PAR' },
  { name: 'Türkiye', abbr: 'TUR', aliases: ['Turkey', 'Turkiye'] },
  { name: 'Germany', abbr: 'GER' },
  { name: 'Ivory Coast', abbr: 'CIV', aliases: ["Côte d'Ivoire", "Cote d'Ivoire"] },
  { name: 'Ecuador', abbr: 'ECU' },
  { name: 'Curaçao', abbr: 'CUW', aliases: ['Curacao'] },
  { name: 'Netherlands', abbr: 'NED', aliases: ['Holland'] },
  { name: 'Japan', abbr: 'JPN' },
  { name: 'Sweden', abbr: 'SWE' },
  { name: 'Tunisia', abbr: 'TUN' },
  { name: 'Egypt', abbr: 'EGY' },
  { name: 'IR Iran', abbr: 'IRN', aliases: ['Iran', 'Iran, Islamic Republic of'] },
  { name: 'Belgium', abbr: 'BEL' },
  { name: 'New Zealand', abbr: 'NZL' },
  { name: 'Spain', abbr: 'ESP' },
  { name: 'Uruguay', abbr: 'URU' },
  { name: 'Cape Verde', abbr: 'CPV', aliases: ['Cape Verde Islands', 'Cabo Verde'] },
  { name: 'Saudi Arabia', abbr: 'KSA' },
  { name: 'France', abbr: 'FRA' },
  { name: 'Norway', abbr: 'NOR' },
  { name: 'Senegal', abbr: 'SEN' },
  { name: 'Iraq', abbr: 'IRQ' },
  { name: 'Argentina', abbr: 'ARG' },
  { name: 'Austria', abbr: 'AUT' },
  { name: 'Algeria', abbr: 'DZA' },
  { name: 'Jordan', abbr: 'JOR' },
  { name: 'Colombia', abbr: 'COL' },
  { name: 'Portugal', abbr: 'POR' },
  { name: 'Congo DR', abbr: 'COD', aliases: ['DR Congo', 'Congo-Kinshasa', 'DR Congo (Congo DR)', 'Democratic Republic of the Congo'] },
  { name: 'Uzbekistan', abbr: 'UZB' },
  { name: 'England', abbr: 'ENG' },
  { name: 'Ghana', abbr: 'GHA' },
  { name: 'Croatia', abbr: 'CRO' },
  { name: 'Panama', abbr: 'PAN' },
];

// Build lookup: lowercased canonical name + every alias -> canonical TeamMeta.
const BY_KEY = new Map<string, TeamMeta>();
for (const t of TEAMS) {
  BY_KEY.set(norm(t.name), t);
  for (const a of t.aliases || []) BY_KEY.set(norm(a), t);
}

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics for matching only
    .toLowerCase()
    .replace(/[._'’-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Names we've already warned about, so the log isn't spammed every poll.
const warned = new Set<string>();

/**
 * Map a provider team name to our canonical name. Unknown names are logged once
 * and returned unchanged so a typo never silently drops a team from the bracket.
 */
export function normalizeTeamName(providerName: string): string {
  const hit = BY_KEY.get(norm(providerName));
  if (hit) return hit.name;
  if (!warned.has(providerName)) {
    warned.add(providerName);
    console.warn(`  ⚠ [teamMap] unmapped team name from provider: "${providerName}" — add it to teamMap.ts aliases`);
  }
  return providerName;
}

const ABBR = new Map(TEAMS.map((t) => [t.name, t.abbr] as const));

/** Canonical abbreviation for a canonical (already-normalized) team name. */
export function abbrFor(canonicalName: string): string {
  return ABBR.get(canonicalName) || canonicalName.slice(0, 3).toUpperCase();
}
