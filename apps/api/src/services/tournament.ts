import { scoreEntry, compareScores, computeCashAwards, cashForUser, type EntryScore, type ScoreContext, type BracketPrediction, type CashResult } from '@banglabracket/shared';
import { Tournament, Entry, User } from '../models/index.js';
import { env } from '../config/env.js';

let cache: { at: number; data: any } | null = null;
const LB_TTL = 30 * 1000;

let cashCache: { at: number; data: CashResult } | null = null;
const CASH_TTL = 30 * 1000;

export async function getTournament() {
  const t = await Tournament.findOne({ key: env.tournamentKey }).lean();
  if (!t) throw Object.assign(new Error('tournament_not_seeded'), { status: 503, publicMessage: 'tournament_not_seeded' });
  return t;
}

export function buildContext(t: any): ScoreContext {
  return {
    base: t.base || {},
    remaining: t.remaining || {},
    truth: { r32: t.r32 || {}, results: t.results || {} },
  };
}

export function isLocked(t: any): boolean {
  return Date.now() >= new Date(t.lockAt).getTime();
}

export function scoreOne(prediction: BracketPrediction, t: any, bonusEligibleAt?: string): EntryScore {
  return scoreEntry(prediction, buildContext(t), bonusEligibleAt);
}

// Full leaderboard (cached). Returns ranked rows with user display info.
export async function getLeaderboard(opts: { eligibleOnly?: boolean } = {}) {
  if (cache && Date.now() - cache.at < LB_TTL) return filterLB(cache.data, opts);

  const t = await getTournament();
  const ctx = buildContext(t);
  const entries = await Entry.find({ tournamentKey: env.tournamentKey }).lean();
  const userIds = entries.map((e) => e.userId);
  const users = await User.find({ _id: { $in: userIds } }, { name: 1, prizeEligible: 1, verified: 1, avatar: 1 }).lean();
  const uMap = new Map(users.map((u) => [String(u._id), u]));

  const scored = entries.map((e) => {
    const s = scoreEntry(e.prediction as any, ctx, e.bonusEligibleAt ? new Date(e.bonusEligibleAt).toISOString() : undefined);
    const u = uMap.get(String(e.userId));
    return {
      userId: String(e.userId),
      name: u?.name || 'Player', avatar: (u as any)?.avatar || null,
      prizeEligible: !!u?.prizeEligible,
      verified: !!u?.verified,
      main: s.main, tieExactFinal: s.tieExactFinal, tieManner: s.tieManner, tieEarlyBird: s.tieEarlyBird,
      score: s,
    };
  });

  scored.sort((a, b) => compareScores(a.score, b.score));
  const ranked = scored.map((r, i) => ({ rank: i + 1, ...r, score: undefined }));
  cache = { at: Date.now(), data: ranked };
  return filterLB(ranked, opts);
}

function filterLB(rows: any[], opts: { eligibleOnly?: boolean }) {
  if (!opts.eligibleOnly) return rows;
  // re-rank within eligible subset
  return rows.filter((r) => r.prizeEligible).map((r, i) => ({ ...r, rank: i + 1 }));
}

export function invalidateLeaderboard() { cache = null; cashCache = null; }

// ---- Exact-score cash side-game ----
export async function getCashAwards(): Promise<CashResult> {
  if (cashCache && Date.now() - cashCache.at < CASH_TTL) return cashCache.data;
  const t = await getTournament();
  const entries = await Entry.find({ tournamentKey: env.tournamentKey }, { userId: 1, prediction: 1, scorePredAt: 1 }).lean();
  const inputs = entries.map((e) => ({
    userId: String(e.userId),
    scorePredictions: (e.prediction as any)?.scorePredictions || {},
    scorePredAt: (e as any)?.scorePredAt || {},
  }));
  const result = computeCashAwards(inputs, { r32: (t.r32 as any) || {}, results: (t.results as any) || {} });
  cashCache = { at: Date.now(), data: result };
  return result;
}

export async function getUserCash(userId: string) {
  const all = await getCashAwards();
  return cashForUser(all, userId);
}

// Public cash leaderboard + winners wall data: ranked by total Taka then win count.
export async function getCashLeaderboard() {
  const cash = await getCashAwards();
  const ids = Object.keys(cash.perUser);
  if (!ids.length) return [];
  const users = await User.find({ _id: { $in: ids } }, { name: 1, avatar: 1, prizeEligible: 1, verified: 1 }).lean();
  const uMap = new Map(users.map((u) => [String(u._id), u]));
  const counts: Record<string, number> = {};
  cash.awards.forEach((a) => { counts[a.userId] = (counts[a.userId] || 0) + 1; });
  return ids.map((id) => ({
    userId: id, total: cash.perUser[id], wins: counts[id] || 0,
    name: uMap.get(id)?.name || 'Player', avatar: uMap.get(id)?.avatar || null,
    prizeEligible: !!uMap.get(id)?.prizeEligible, verified: !!uMap.get(id)?.verified,
  })).sort((a, b) => b.total - a.total || b.wins - a.wins);
}
