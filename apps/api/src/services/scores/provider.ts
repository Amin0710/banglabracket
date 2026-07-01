// ============================================================
//  ScoreProvider — source-agnostic live-data contract
// ============================================================
// A provider returns a NORMALIZED shape only; nothing downstream (sync.ts) knows
// which API the data came from. Add a second source (e.g. SofaScore) by writing
// another file that implements ScoreProvider — sync.ts does not change.
//
// Team names here are still the PROVIDER's spellings. sync.ts runs them through
// teamMap.normalizeTeamName() before writing anything to Mongo.

export type FixtureStatus = 'scheduled' | 'live' | 'finished' | 'other';
export type FixtureManner = 'FT' | 'ET' | 'PEN';

export interface NormFixture {
  providerId: number | string;
  round: string;            // raw provider round label, e.g. "Round of 32"
  kickoff: string;          // ISO 8601
  status: FixtureStatus;
  statusRaw: string;        // provider status code (FT, NS, ET, PEN, …) for logs
  homeName: string;         // PROVIDER spelling — normalize before use
  awayName: string;
  scoreA: number | null;    // home goals on the pitch (FT incl. extra time)
  scoreB: number | null;    // away goals
  ftA: number | null;       // home goals after 90' (regulation), if reported
  ftB: number | null;       // away goals after 90'
  penA: number | null;      // home penalty shoot-out tally, if any
  penB: number | null;      // away penalty shoot-out tally
  winnerName: string | null;// provider spelling of the winner, or null if not final/drawn
  manner: FixtureManner | null; // FT | ET | PEN, derived from which score is populated
}

// A single row of a top-scorers / top-assists table.
export interface NormPlayerStat {
  rank: number;             // 1-based position in the table
  name: string;             // player full name
  team: string;             // PROVIDER spelling of club/nation — normalize before display
  country: string;          // nationality (drives the flag)
  photo: string | null;     // headshot URL (optional)
  value: number;            // goals (scorers) or assists (assists)
}

export interface NormStanding {
  group: string;            // single letter "A".."L"
  teamName: string;         // PROVIDER spelling
  rank: number;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface ProviderMeta {
  source: string;           // provider name, e.g. "api-football"
  leagueId: number;
  season: number;
  rateRemaining: number | null; // requests left in the current window, if known
  fetchedAt: string;        // ISO
}

export interface FixturesResult { meta: ProviderMeta; fixtures: NormFixture[]; }
export interface StandingsResult { meta: ProviderMeta; standings: NormStanding[]; }
export interface PlayerStatsResult { meta: ProviderMeta; players: NormPlayerStat[]; }

export interface ScoreProvider {
  readonly name: string;
  /** Resolve and cache the competition's league id (e.g. World Cup => 1). */
  discoverLeagueId(): Promise<number>;
  /** All fixtures (group + knockout) for the configured league/season. */
  fetchFixtures(): Promise<FixturesResult>;
  /** Group standings for the configured league/season. */
  fetchStandings(): Promise<StandingsResult>;
  /** Tournament top scorers (one call). */
  fetchTopScorers(): Promise<PlayerStatsResult>;
  /** Tournament top assists (one call). */
  fetchTopAssists(): Promise<PlayerStatsResult>;
}
