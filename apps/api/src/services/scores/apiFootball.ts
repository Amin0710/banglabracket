// ============================================================
//  API-Football implementation of ScoreProvider
// ============================================================
// All HTTP + API-key handling lives in this file. Base URL and auth header per
// https://www.api-football.com/documentation-v3. The key is read from env and
// never leaves the server.

import { env } from '../../config/env.js';
import type {
  ScoreProvider, FixturesResult, StandingsResult, PlayerStatsResult, ProviderMeta,
  NormFixture, NormStanding, NormPlayerStat, FixtureStatus, FixtureManner,
} from './provider.js';

const BASE = 'https://v3.football.api-sports.io';

const FINISHED = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
const LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE']);
const SCHEDULED = new Set(['TBD', 'NS']);

function classify(short: string): FixtureStatus {
  if (FINISHED.has(short)) return 'finished';
  if (LIVE.has(short)) return 'live';
  if (SCHEDULED.has(short)) return 'scheduled';
  return 'other'; // PST, CANC, ABD, …
}

interface ApiEnvelope<T> { errors: unknown; results: number; response: T; }

export class ApiFootballProvider implements ScoreProvider {
  readonly name = 'api-football';
  private leagueId = 0;
  private rateRemaining: number | null = null;

  constructor(
    private key = env.apiFootball.key,
    private season = env.apiFootball.season,
    private configuredLeagueId = env.apiFootball.leagueId,
  ) {
    if (!this.key) throw new Error('API_FOOTBALL_KEY is not set');
  }

  /** Latest known daily-requests-remaining, captured from response headers. */
  get remaining(): number | null { return this.rateRemaining; }

  private async get<T>(path: string): Promise<ApiEnvelope<T>> {
    const res = await fetch(BASE + path, { headers: { 'x-apisports-key': this.key } });
    const remain = res.headers.get('x-ratelimit-requests-remaining');
    if (remain != null) {
      this.rateRemaining = Number(remain);
      if (this.rateRemaining <= 5) {
        console.warn(`  ⚠ [api-football] only ${this.rateRemaining} daily requests left — backing off`);
      }
    }
    if (!res.ok) throw new Error(`api-football ${path} -> HTTP ${res.status}`);
    const json = (await res.json()) as ApiEnvelope<T>;
    const errs = json.errors;
    const hasErr = Array.isArray(errs) ? errs.length > 0 : errs && Object.keys(errs as object).length > 0;
    if (hasErr) throw new Error(`api-football ${path} -> ${JSON.stringify(errs)}`);
    return json;
  }

  private meta(): ProviderMeta {
    return {
      source: this.name,
      leagueId: this.leagueId,
      season: this.season,
      rateRemaining: this.rateRemaining,
      fetchedAt: new Date().toISOString(),
    };
  }

  async discoverLeagueId(): Promise<number> {
    if (this.leagueId) return this.leagueId;
    if (this.configuredLeagueId) { this.leagueId = this.configuredLeagueId; return this.leagueId; }

    const json = await this.get<Array<any>>('/leagues?search=World%20Cup');
    // Prefer the men's "World Cup" cup that actually has our season.
    const exact = json.response.find((x) =>
      x.league?.name === 'World Cup' && x.league?.type === 'Cup' &&
      (x.seasons || []).some((s: any) => s.year === this.season));
    const id = exact?.league?.id ?? 1; // documented fallback
    this.leagueId = Number(id);
    console.log(`  ℹ [api-football] resolved World Cup league id = ${this.leagueId} (season ${this.season})`);
    return this.leagueId;
  }

  async fetchFixtures(): Promise<FixturesResult> {
    const league = await this.discoverLeagueId();
    const json = await this.get<Array<any>>(`/fixtures?league=${league}&season=${this.season}`);
    const fixtures = json.response.map((x) => toNormFixture(x));
    return { meta: this.meta(), fixtures };
  }

  async fetchTopScorers(): Promise<PlayerStatsResult> {
    const league = await this.discoverLeagueId();
    const json = await this.get<Array<any>>(`/players/topscorers?league=${league}&season=${this.season}`);
    return { meta: this.meta(), players: json.response.map((x, i) => toPlayerStat(x, i, 'goals')) };
  }

  async fetchTopAssists(): Promise<PlayerStatsResult> {
    const league = await this.discoverLeagueId();
    const json = await this.get<Array<any>>(`/players/topassists?league=${league}&season=${this.season}`);
    return { meta: this.meta(), players: json.response.map((x, i) => toPlayerStat(x, i, 'assists')) };
  }

  async fetchStandings(): Promise<StandingsResult> {
    const league = await this.discoverLeagueId();
    const json = await this.get<Array<any>>(`/standings?league=${league}&season=${this.season}`);
    const standings: NormStanding[] = [];
    const groups = json.response?.[0]?.league?.standings || [];
    for (const table of groups) {
      for (const row of table) {
        const g = groupLetter(row.group);
        if (!g) continue; // skip the third-place pseudo "Group Stage" table
        standings.push({
          group: g,
          teamName: row.team?.name,
          rank: row.rank,
          played: row.all?.played ?? 0,
          win: row.all?.win ?? 0,
          draw: row.all?.draw ?? 0,
          lose: row.all?.lose ?? 0,
          goalsFor: row.all?.goals?.for ?? 0,
          goalsAgainst: row.all?.goals?.against ?? 0,
          points: row.points ?? 0,
        });
      }
    }
    return { meta: this.meta(), standings };
  }
}

// "Group A" -> "A"; "Group Stage" (third-place table) / anything else -> null.
function groupLetter(group?: string): string | null {
  const m = /^Group ([A-L])$/.exec((group || '').trim());
  return m ? m[1] : null;
}

function deriveManner(score: any): FixtureManner {
  const pen = score?.penalty;
  const et = score?.extratime;
  if (pen && (pen.home != null || pen.away != null)) return 'PEN';
  if (et && (et.home != null || et.away != null)) return 'ET';
  return 'FT';
}

function toNormFixture(x: any): NormFixture {
  const short = x.fixture?.status?.short || 'NS';
  const status = classify(short);
  const finished = status === 'finished';
  const home = x.teams?.home, away = x.teams?.away;
  let winnerName: string | null = null;
  if (finished) {
    if (home?.winner === true) winnerName = home?.name;
    else if (away?.winner === true) winnerName = away?.name;
  }
  const ft = x.score?.fulltime || {};
  const pen = x.score?.penalty || {};
  return {
    providerId: x.fixture?.id,
    round: x.league?.round || '',
    kickoff: x.fixture?.date,
    status,
    statusRaw: short,
    homeName: home?.name,
    awayName: away?.name,
    scoreA: x.goals?.home ?? null,
    scoreB: x.goals?.away ?? null,
    ftA: ft.home ?? null,
    ftB: ft.away ?? null,
    penA: pen.home ?? null,
    penB: pen.away ?? null,
    winnerName,
    manner: finished ? deriveManner(x.score) : null,
  };
}

// One row of /players/topscorers or /players/topassists.
function toPlayerStat(x: any, i: number, kind: 'goals' | 'assists'): NormPlayerStat {
  const st = x.statistics?.[0] || {};
  // API-Football exposes BOTH goals and assists under `statistics[].goals`:
  //   goals.total  = goals scored,  goals.assists = assists.
  // (There is no top-level `statistics[].assists` object — reading it always gave 0.)
  const value = kind === 'goals'
    ? (st.goals?.total ?? 0)
    : (st.goals?.assists ?? st.assists?.total ?? 0);
  return {
    rank: i + 1,
    name: x.player?.name || 'Unknown',
    team: st.team?.name || '',
    country: x.player?.nationality || '',
    photo: x.player?.photo ?? null,
    value: value ?? 0,
  };
}
