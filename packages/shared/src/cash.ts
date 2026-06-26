import type { TournamentTruth, TeamId } from './types.js';
import { KO_MATCHES, ROUND_OF } from './bracket.js';

// ---- Exact-score cash side-game (parallel to points, pays real Taka) ----
// Rules (config-driven):
//  • Knockout matches only (R16 → Final, incl. 3rd-place).
//  • A pick is correct iff predicted (a,b) exactly equals the actual (a,b).
//  • Each match has its own pool; pool / perCorrect = number of winner slots.
//  • Slots go to the EARLIEST submitters of that match's score prediction (FCFS).
//  • Each player is capped at perPlayerCap total across the whole tournament.
//  • Computed deterministically across ALL entries; safe to recompute any time.
export const CASH = {
  perCorrect: 100,        // Taka per correct exact score
  perMatchPool: 1000,     // Taka available per match  → 10 winner slots
  perPlayerCap: 500,      // max Taka one player can earn all tournament
  get slotsPerMatch() { return Math.floor(this.perMatchPool / this.perCorrect); },
};

export interface CashEntryInput {
  userId: string;
  scorePredictions?: Record<number, { a: number; b: number }>;
  scorePredAt?: Record<number, string>; // server-set ISO timestamp per match (FCFS ordering)
}

export interface CashAwardRow { userId: string; match: number; amount: number; at: string | null; }
export interface CashResult {
  awards: CashAwardRow[];                       // every individual payout
  perUser: Record<string, number>;              // userId -> total Taka
  perMatch: Record<number, CashAwardRow[]>;     // match -> payouts
  total: number;                                // grand total Taka committed
}

export function cashEligibleMatches(): number[] {
  // R16, QF, SF, THIRD, FINAL — i.e. every knockout match
  return KO_MATCHES.filter((m) => ['R16', 'QF', 'SF', 'THIRD', 'FINAL'].includes(ROUND_OF(m)));
}

export function computeCashAwards(entries: CashEntryInput[], truth: TournamentTruth): CashResult {
  const perUser: Record<string, number> = {};
  const perMatch: Record<number, CashAwardRow[]> = {};
  const awards: CashAwardRow[] = [];

  // process matches in chronological (numeric) order so the per-player cap is applied fairly
  for (const m of cashEligibleMatches().sort((a, b) => a - b)) {
    const res = truth.results[m];
    if (!res || res.scoreA == null || res.scoreB == null) continue; // not confirmed yet
    perMatch[m] = [];

    // candidates: exact-score match, with a recorded submission timestamp
    const candidates = entries
      .map((e) => {
        const sp = e.scorePredictions?.[m];
        const at = e.scorePredAt?.[m] ?? null;
        if (!sp) return null;
        if (sp.a !== res.scoreA || sp.b !== res.scoreB) return null;
        return { userId: e.userId, at };
      })
      .filter((x): x is { userId: string; at: string | null } => !!x)
      // earliest submission first; entries with no timestamp sort last; stable by userId
      .sort((a, b) => {
        const ta = a.at ? Date.parse(a.at) : Number.POSITIVE_INFINITY;
        const tb = b.at ? Date.parse(b.at) : Number.POSITIVE_INFINITY;
        return ta - tb || a.userId.localeCompare(b.userId);
      });

    let filled = 0;
    for (const c of candidates) {
      if (filled >= CASH.slotsPerMatch) break;
      if ((perUser[c.userId] || 0) >= CASH.perPlayerCap) continue; // player already capped
      const row: CashAwardRow = { userId: c.userId, match: m, amount: CASH.perCorrect, at: c.at };
      perMatch[m].push(row);
      awards.push(row);
      perUser[c.userId] = (perUser[c.userId] || 0) + CASH.perCorrect;
      filled++;
    }
  }

  const total = Object.values(perUser).reduce((a, b) => a + b, 0);
  return { awards, perUser, perMatch, total };
}

// Convenience: one player's cash view (their total + which matches paid them).
export function cashForUser(result: CashResult, userId: string) {
  const rows = result.awards.filter((a) => a.userId === userId);
  return { total: rows.reduce((s, r) => s + r.amount, 0), rows };
}
