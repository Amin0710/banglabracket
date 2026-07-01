// ============================================================
//  sync.ts — normalized provider data -> Tournament document
// ============================================================
// Consumes the shared bracket wiring (packages/shared/src/bracket.ts) as the
// source of truth for structure and maps a provider snapshot onto
// Tournament.{base,remaining,r32,results,fixtures}. Idempotent and safe to
// re-run: a confirmedAt that is already set is never overwritten.
//
// DRY-RUN: pass { dryRun:true } to compute and log the diff WITHOUT writing.

import {
  GROUP_KEYS, WIN_SLOT, RUN_SLOT, THIRD_SLOTS, allocateThirds,
  rankGroup, resolveBracketParticipants, R32_MATCHES, KO_MATCHES, MATCH_DEF,
  type TeamRow,
} from '@banglabracket/shared';
import { Tournament } from '../../models/index.js';
import { env } from '../../config/env.js';
import { normalizeTeamName, abbrFor } from './teamMap.js';
import { ApiFootballProvider } from './apiFootball.js';
import { deriveSchedule } from './schedule.js';
import type { ScoreProvider, NormFixture, NormStanding, NormPlayerStat } from './provider.js';

// Approx gap between a fixture's kickoff and its result becoming official.
// Used for confirmedAt when back-filling matches that finished before this
// process started (so early-bird timing is derived from reality, not "now").
const FINAL_OFFSET_MS = 2 * 60 * 60 * 1000;          // 90' + breaks ≈ 2h
const FINAL_OFFSET_EXTRA_MS = 2.5 * 60 * 60 * 1000;  // ET / penalties ≈ 2.5h

export type RoundTag = 'GROUP' | 'R32' | 'R16' | 'QF' | 'SF' | 'THIRD' | 'FINAL' | 'OTHER';

export function roundTag(label: string): RoundTag {
  const s = (label || '').toLowerCase();
  if (s.startsWith('group')) return 'GROUP';
  if (s.includes('round of 32')) return 'R32';
  if (s.includes('round of 16')) return 'R16';
  if (s.includes('quarter')) return 'QF';
  if (s.includes('semi')) return 'SF';            // before 'final' (substring)
  if (s.includes('3rd') || s.includes('third')) return 'THIRD';
  if (s.includes('final')) return 'FINAL';
  return 'OTHER';
}

const ptsOf = (o: TeamRow) => o.W * 3 + o.D;
const gdOf = (o: TeamRow) => o.GF - o.GA;
const pairKey = (a: string, b: string) => [a, b].sort().join(' | ');

export interface SyncOptions {
  dryRun?: boolean;
  /** Refetch standings to rebuild base/remaining. Default true. */
  includeStandings?: boolean;
  /** Refetch top scorers/assists. Defaults to the value of includeStandings (daily). */
  includePlayers?: boolean;
  provider?: ScoreProvider;
}

export interface SyncReport {
  dryRun: boolean;
  source: string;
  rateRemaining: number | null;
  anyLive: boolean;
  /** ISO kickoff of the earliest not-yet-started fixture (drives the event-driven poller). */
  nextKickoffAt: string | null;
  groupsDecided: number;
  r32SlotsFilled: number;
  resultsCount: number;
  assignments: Array<{ matchNumber: number; round: RoundTag; pair: string; status: string }>;
  unmappedFixtures: number;
}

// A normalized fixture with team names already mapped to our canonical spellings.
interface CanonFixture extends NormFixture { round_tag: RoundTag; homeCanon: string; awayCanon: string; winnerCanon: string | null; matchNumber: number | null; }

export async function runSync(opts: SyncOptions = {}): Promise<SyncReport> {
  const dryRun = !!opts.dryRun;
  const includeStandings = opts.includeStandings !== false;
  // Player stats are a daily refresh: default to the standings cadence.
  const includePlayers = opts.includePlayers ?? includeStandings;
  const provider = opts.provider || new ApiFootballProvider();

  const doc = await Tournament.findOne({ key: env.tournamentKey }).lean();
  if (!doc) throw new Error(`tournament '${env.tournamentKey}' not seeded — run npm run seed first`);

  // ---- fetch ----
  const fx = await provider.fetchFixtures();
  const std = includeStandings ? (await provider.fetchStandings()).standings : null;
  // Top scorers / assists — one call each, only on the daily refresh.
  const topScorers = includePlayers ? normalizePlayers((await provider.fetchTopScorers()).players) : null;
  const topAssists = includePlayers ? normalizePlayers((await provider.fetchTopAssists()).players) : null;

  // ---- normalize fixtures to canonical names + round tags ----
  const fixtures: CanonFixture[] = fx.fixtures.map((f) => ({
    ...f,
    round_tag: roundTag(f.round),
    homeCanon: normalizeTeamName(f.homeName),
    awayCanon: normalizeTeamName(f.awayName),
    winnerCanon: f.winnerName ? normalizeTeamName(f.winnerName) : null,
    matchNumber: null,
  }));

  // ---- base + team→group (from standings, or keep existing base) ----
  let base: Record<string, TeamRow[]>;
  const teamGroup = new Map<string, string>();
  if (std) {
    base = buildBase(std);
  } else {
    base = (doc.base as any) || {};
  }
  for (const g of GROUP_KEYS) for (const r of base[g] || []) teamGroup.set(r.name, g);

  // ---- remaining (unplayed group fixtures) ----
  const remaining = buildRemaining(fixtures, teamGroup);

  // ---- when did each group finish? (max kickoff among its group fixtures) ----
  const groupFinalAt = computeGroupFinalAt(fixtures, teamGroup);

  // ---- R32 truth slots ----
  const existingR32 = (doc.r32 as any) || {};
  const { r32, slotsFilled, groupsDecided } = buildR32(base, groupFinalAt, existingR32, fixtures);

  // ---- assign fixtures to match numbers 73..104, then build results ----
  const r32Names = r32NamesFrom(r32);
  const existingResults = (doc.results as any) || {};
  const { results, assignments } = assignAndBuildResults(fixtures, r32Names, existingResults);

  // ---- store-ready normalized fixtures (for schedule + finished-match display) ----
  const storedFixtures = fixtures.map((f) => ({
    providerId: f.providerId,
    matchNumber: f.matchNumber,
    round: f.round_tag,
    roundLabel: f.round,
    kickoff: f.kickoff,
    status: f.status,
    statusRaw: f.statusRaw,
    teamA: f.homeCanon,
    teamB: f.awayCanon,
    scoreA: f.scoreA,
    scoreB: f.scoreB,
    ftA: f.ftA,
    ftB: f.ftB,
    penA: f.penA,
    penB: f.penB,
    winner: f.winnerCanon,
    manner: f.manner,
  }));

  const unmappedFixtures = fixtures.filter((f) => f.round_tag === 'GROUP'
    && (!teamGroup.has(f.homeCanon) || !teamGroup.has(f.awayCanon))).length;

  const sync = {
    lastSyncAt: new Date().toISOString(),
    lastLiveAt: fixtures.some((f) => f.status === 'live') ? new Date().toISOString() : (doc.sync as any)?.lastLiveAt || null,
    source: provider.name,
    rateRemaining: fx.meta.rateRemaining,
  };

  const report: SyncReport = {
    dryRun,
    source: provider.name,
    rateRemaining: fx.meta.rateRemaining,
    anyLive: fixtures.some((f) => f.status === 'live'),
    nextKickoffAt: deriveSchedule(storedFixtures as any).nextMatch?.kickoff || null,
    groupsDecided,
    r32SlotsFilled: slotsFilled,
    resultsCount: Object.keys(results).length,
    assignments,
    unmappedFixtures,
  };

  logReport(report);

  if (dryRun) {
    console.log('  ⏸  DRY-RUN — nothing written to Mongo.');
    return report;
  }

  const set: any = { r32, results, fixtures: storedFixtures, sync };
  if (std) { set.base = base; set.remaining = remaining; }
  if (topScorers) set.topScorers = topScorers;
  if (topAssists) set.topAssists = topAssists;
  await Tournament.updateOne({ key: env.tournamentKey }, { $set: set });
  console.log(`  ✓ Sync written to '${env.tournamentKey}'.`);
  return report;
}

// ---------------- helpers ----------------

// Normalize a top-scorers/assists table for storage: canonical country (so the
// flag resolves) + the fields the UI needs (name, photo, value). Photo optional.
function normalizePlayers(players: NormPlayerStat[]) {
  return players.map((p) => ({
    rank: p.rank,
    name: p.name,
    team: normalizeTeamName(p.team || p.country),
    country: normalizeTeamName(p.country),
    flag: normalizeTeamName(p.country), // canonical nation name; client derives the flag image
    photo: p.photo,
    value: p.value,
  }));
}

function buildBase(std: NormStanding[]): Record<string, TeamRow[]> {
  const base: Record<string, TeamRow[]> = {};
  for (const g of GROUP_KEYS) base[g] = [];
  for (const s of std) {
    const name = normalizeTeamName(s.teamName);
    base[s.group].push({
      name, abbr: abbrFor(name),
      P: s.played, W: s.win, D: s.draw, L: s.lose, GF: s.goalsFor, GA: s.goalsAgainst,
    });
  }
  for (const g of GROUP_KEYS) base[g].sort((a, b) => ptsOf(b) - ptsOf(a) || gdOf(b) - gdOf(a) || b.GF - a.GF);
  return base;
}

function buildRemaining(fixtures: CanonFixture[], teamGroup: Map<string, string>): Record<string, Array<[string, string]>> {
  const rem: Record<string, Array<[string, string]>> = {};
  const groupFx = fixtures
    .filter((f) => f.round_tag === 'GROUP' && f.status === 'scheduled')
    .sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));
  for (const f of groupFx) {
    const g = teamGroup.get(f.homeCanon) || teamGroup.get(f.awayCanon);
    if (!g) continue;
    (rem[g] ||= []).push([abbrFor(f.homeCanon), abbrFor(f.awayCanon)]);
  }
  return rem;
}

function computeGroupFinalAt(fixtures: CanonFixture[], teamGroup: Map<string, string>): Record<string, string> {
  const at: Record<string, number> = {};
  for (const f of fixtures) {
    if (f.round_tag !== 'GROUP') continue;
    const g = teamGroup.get(f.homeCanon) || teamGroup.get(f.awayCanon);
    if (!g) continue;
    const t = +new Date(f.kickoff) + FINAL_OFFSET_MS;
    at[g] = Math.max(at[g] || 0, t);
  }
  const out: Record<string, string> = {};
  for (const g of Object.keys(at)) out[g] = new Date(at[g]).toISOString();
  return out;
}

function groupDecided(base: Record<string, TeamRow[]>, g: string): boolean {
  const rows = base[g] || [];
  return rows.length >= 4 && rows.every((r) => r.P >= 3);
}

function buildR32(
  base: Record<string, TeamRow[]>,
  groupFinalAt: Record<string, string>,
  existing: any,
  fixtures: CanonFixture[],
): { r32: any; slotsFilled: number; groupsDecided: number } {
  const r32: any = {};
  const ensure = (m: number) => (r32[m] ||= {
    A: { team: null, confirmedAt: null }, B: { team: null, confirmedAt: null },
  });

  // Carry forward everything already confirmed (preserve confirmedAt).
  for (const m of R32_MATCHES) {
    const e = existing[m];
    if (e) r32[m] = { A: { ...e.A }, B: { ...e.B } };
  }

  const place = (m: number, slot: 'A' | 'B', team: string, confirmedAt: string) => {
    ensure(m);
    const cur = r32[m][slot];
    if (cur?.confirmedAt && cur.team === team) return;       // already confirmed — keep its time
    r32[m][slot] = { team, confirmedAt: cur?.team === team ? (cur.confirmedAt || confirmedAt) : confirmedAt };
  };

  let decided = 0;
  for (const g of GROUP_KEYS) {
    if (!groupDecided(base, g)) continue;
    decided++;
    const t = rankGroup(g, base, {} as any, {} as any);
    const at = groupFinalAt[g] || new Date().toISOString();
    const [wm, ws] = WIN_SLOT[g]; const [rm, rs] = RUN_SLOT[g];
    if (t[0]) place(wm, ws, t[0].name, at);
    if (t[1]) place(rm, rs, t[1].name, at);
  }

  // Third-place slots: only once all 12 groups are decided.
  if (decided === GROUP_KEYS.length) {
    const thirds = GROUP_KEYS
      .map((g) => ({ g, o: rankGroup(g, base, {} as any, {} as any)[2] }))
      .filter((x) => x.o)
      .sort((a, b) => ptsOf(b.o!) - ptsOf(a.o!) || gdOf(b.o!) - gdOf(a.o!) || b.o!.GF - a.o!.GF || a.o!.name.localeCompare(b.o!.name));
    const top8 = thirds.slice(0, 8).map((x) => x.g).sort();
    const alloc = allocateThirds(top8);
    const allAt = Object.values(groupFinalAt).sort().pop() || new Date().toISOString();
    if (alloc) {
      for (const m of Object.keys(alloc)) {
        const g = alloc[Number(m)];
        const third = rankGroup(g, base, {} as any, {} as any)[2];
        if (third) place(Number(m), 'B', third.name, allAt);
      }
    } else {
      console.warn('  ⚠ [sync] could not allocate third-place slots (allocateThirds returned null)');
    }

    // allocateThirds yields *a* valid permutation, but FIFA's official table may
    // pick a different valid one for the same 8 qualifying groups. When the real
    // R32 fixtures exist, trust them: the slot-A group winner is unambiguous, so
    // the winner's actual opponent IS the true third-place occupant. (We never
    // edit the shared helper — we just correct the truth slots from reality.)
    reconcileThirdsFromFixtures(r32, fixtures, allAt);
  }

  let slotsFilled = 0;
  for (const m of R32_MATCHES) { if (r32[m]?.A?.team) slotsFilled++; if (r32[m]?.B?.team) slotsFilled++; }
  return { r32, slotsFilled, groupsDecided: decided };
}

// Correct each third-place slot (always slot B) from the actual R32 fixtures.
function reconcileThirdsFromFixtures(r32: any, fixtures: CanonFixture[], allAt: string) {
  const r32Fx = fixtures.filter((f) => f.round_tag === 'R32' && f.homeCanon && f.awayCanon);
  for (const { match: m } of THIRD_SLOTS) {
    const aTeam = r32[m]?.A?.team;
    if (!aTeam) continue;
    const fx = r32Fx.find((f) => f.homeCanon === aTeam || f.awayCanon === aTeam);
    if (!fx) continue; // fixture not scheduled yet — keep the allocateThirds guess
    const opponent = fx.homeCanon === aTeam ? fx.awayCanon : fx.homeCanon;
    const cur = r32[m].B;
    if (cur?.team === opponent) continue; // already correct
    r32[m].B = { team: opponent, confirmedAt: cur?.confirmedAt && cur.team === opponent ? cur.confirmedAt : allAt };
    console.log(`  • [sync] reconciled 3rd-place slot #${m}.B → ${opponent} (was ${cur?.team ?? 'none'}; from real R32 fixture)`);
  }
}

function r32NamesFrom(r32: any): Record<number, { A: string | null; B: string | null }> {
  const out: Record<number, { A: string | null; B: string | null }> = {};
  for (const m of R32_MATCHES) out[m] = { A: r32[m]?.A?.team ?? null, B: r32[m]?.B?.team ?? null };
  return out;
}

function assignAndBuildResults(
  fixtures: CanonFixture[],
  r32Names: Record<number, { A: string | null; B: string | null }>,
  existingResults: any,
): { results: any; assignments: SyncReport['assignments'] } {
  const knockoutFx = fixtures.filter((f) => f.round_tag !== 'GROUP' && f.round_tag !== 'OTHER' && f.homeCanon && f.awayCanon);
  const assignedFixture = new Set<CanonFixture>();
  const matchOfFixture = new Map<CanonFixture, number>();
  const winners: Record<number, string> = {};
  // Seed winners already known from prior confirmed results (idempotent re-run).
  for (const m of Object.keys(existingResults)) {
    const w = existingResults[m]?.winner; if (w) winners[Number(m)] = w;
  }
  const assignments: SyncReport['assignments'] = [];

  for (let pass = 0; pass < 8; pass++) {
    const part = resolveBracketParticipants(r32Names as any, winners as any);
    const expected = new Map<string, number>();
    for (const m of [...R32_MATCHES, ...KO_MATCHES]) {
      const p = part[m]; if (p?.A && p?.B) expected.set(pairKey(p.A, p.B), m);
    }
    let progressed = false;
    for (const f of knockoutFx) {
      if (assignedFixture.has(f)) continue;
      const m = expected.get(pairKey(f.homeCanon, f.awayCanon));
      if (m == null) continue;
      assignedFixture.add(f); matchOfFixture.set(f, m); f.matchNumber = m;
      assignments.push({ matchNumber: m, round: f.round_tag, pair: `${f.homeCanon} vs ${f.awayCanon}`, status: f.statusRaw });
      console.log(`  • [sync] fixture ${f.providerId} (${f.homeCanon} vs ${f.awayCanon}, ${f.statusRaw}) → match #${m} [${MATCH_DEF[m].round}]`);
      if (f.status === 'finished' && f.winnerCanon) winners[m] = f.winnerCanon;
      progressed = true;
    }
    if (!progressed) break;
  }

  // Build results from finished, assigned fixtures (merge, preserving confirmedAt).
  const results: any = { ...existingResults };
  for (const f of knockoutFx) {
    const m = matchOfFixture.get(f);
    if (m == null || f.status !== 'finished') continue;
    if (!f.winnerCanon) { console.warn(`  ⚠ [sync] match #${m} finished but no winner from provider (${f.statusRaw})`); continue; }
    const prev = existingResults[m] || {};
    const offset = f.manner === 'FT' ? FINAL_OFFSET_MS : FINAL_OFFSET_EXTRA_MS;
    const confirmedAt = prev.confirmedAt || new Date(+new Date(f.kickoff) + offset).toISOString();
    results[m] = {
      match: m,
      winner: f.winnerCanon,
      manner: f.manner,
      scoreA: f.scoreA,
      scoreB: f.scoreB,
      ftA: f.ftA,
      ftB: f.ftB,
      penA: f.penA,
      penB: f.penB,
      confirmedAt,
    };
  }
  return { results, assignments };
}

function logReport(r: SyncReport) {
  console.log(`  ── sync (${r.source}) ─ groupsDecided=${r.groupsDecided}/12  r32Slots=${r.r32SlotsFilled}/32  results=${r.resultsCount}  rateLeft=${r.rateRemaining ?? '?'}`);
  if (r.unmappedFixtures) console.log(`     ⚠ ${r.unmappedFixtures} group fixture(s) had an unmapped team`);
}
