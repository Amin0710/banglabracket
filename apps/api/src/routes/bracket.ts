import { Router } from 'express';
import { z } from 'zod';
import { isBracketComplete } from '@banglabracket/shared';
import { env } from '../config/env.js';
import { Entry, User } from '../models/index.js';
import {
  getTournament, isLocked, scoreOne, invalidateLeaderboard, getUserCash,
  bracketFrozenForPrize, r16KickoffAt, matchKickoffMap,
} from '../services/tournament.js';
import { requireAuth, validate, type AuthedRequest } from '../middleware/index.js';
import { publicUser } from './auth.js';
import { deriveSchedule } from '../services/scores/schedule.js';

export const bracketRouter = Router();

// Public tournament view: base tables, remaining fixtures, confirmed R32, lock
// time, plus the two live countdown targets (nextMatch / nextRound).
bracketRouter.get('/tournament', async (_req, res) => {
  const t = await getTournament();
  const schedule = deriveSchedule((t.fixtures as any) || []);
  res.json({
    key: t.key, name: t.name, tagline: t.tagline, lockAt: t.lockAt, locked: isLocked(t),
    base: t.base, remaining: t.remaining, r32: t.r32, results: t.results,
    // fixtures + player tables power the read-only Results tab and per-match live status
    fixtures: t.fixtures || [], topScorers: (t as any).topScorers || [], topAssists: (t as any).topAssists || [],
    nextMatch: schedule.nextMatch, nextRound: schedule.nextRound,
    // soft-freeze (Model Y): R16 kickoff is the grand-prize freeze trigger
    bracketFrozenForPrize: bracketFrozenForPrize(t), r16KickoffAt: r16KickoffAt(t),
    syncedAt: (t.sync as any)?.lastSyncAt || null,
  });
});

// Lightweight schedule-only endpoint for the marketing landing page / widgets.
bracketRouter.get('/schedule', async (_req, res) => {
  const t = await getTournament();
  const schedule = deriveSchedule((t.fixtures as any) || []);
  res.json({ ...schedule, lockAt: t.lockAt, locked: isLocked(t), syncedAt: (t.sync as any)?.lastSyncAt || null });
});

const predictionSchema = z.object({
  groups: z.record(z.object({
    scores: z.array(z.object({ a: z.string(), b: z.string(), sa: z.number().int().min(0).max(99), sb: z.number().int().min(0).max(99) })),
  })).default({}),
  winners: z.record(z.string()).default({}),
  manner: z.record(z.enum(['FT', 'ET', 'PEN'])).optional(),
  // exact-score picks per knockout match (drive the cash side-game)
  scorePredictions: z.record(z.object({ a: z.number().int().min(0).max(99), b: z.number().int().min(0).max(99) })).optional(),
  // when true, this PUT marks the bracket as SUBMITTED (stamps submittedAt + snapshot)
  submit: z.boolean().optional(),
});

// Load the signed-in user's entry (+ live score and cash side-game view).
bracketRouter.get('/entry', requireAuth, async (req: AuthedRequest, res) => {
  const t = await getTournament();
  const entry = await Entry.findOne({ userId: req.userId, tournamentKey: env.tournamentKey }).lean();
  let score = null;
  if (entry) score = scoreOne(entry.prediction as any, t, entry.bonusEligibleAt ? new Date(entry.bonusEligibleAt).toISOString() : undefined);
  const cash = await getUserCash(String(req.userId));
  const winners = (entry?.prediction as any)?.winners || null;
  res.json({
    entry: entry ? {
      prediction: entry.prediction, rePicked: entry.rePicked, updatedAt: entry.updatedAt,
      grandPrizeEligible: entry.grandPrizeEligible !== false, // default true
      // submission state (survives refresh): timestamp + canonical snapshot at submit
      submittedAt: entry.submittedAt || null,
      submittedBracket: (entry as any).submittedBracket || null,
    } : null,
    locked: isLocked(t), score, cash,
    // soft-freeze + completeness state the client needs (warning UI is a later pass)
    bracketFrozenForPrize: bracketFrozenForPrize(t),
    grandPrizeEligible: entry ? entry.grandPrizeEligible !== false : true,
    bracketComplete: isBracketComplete(winners),
  });
});

// Save / autosave the bracket.
//
// Model Y soft-freeze: there is NO global hard-lock anymore. The bracket is
// freely editable; once the Round-of-16 has kicked off (bracketFrozenForPrize),
// a save that actually changes the bracket forfeits grand-prize eligibility.
//
// Per-match games are independent of the bracket freeze: each match's pick locks
// at THAT match's own kickoff (server-authoritative); future matches stay open.
bracketRouter.put('/entry', requireAuth, validate(predictionSchema), async (req: AuthedRequest, res) => {
  const t = await getTournament();
  const { submit, ...prediction } = req.body;

  const existing = await Entry.findOne({ userId: req.userId, tournamentKey: env.tournamentKey }).lean();
  const prevPred = (existing?.prediction as any) || {};

  // ---- per-match kickoff lock: keep the stored pick for any match already started ----
  const kickoff = matchKickoffMap(t);
  const now = Date.now();
  const matchLocked = (m: number) => kickoff[m] != null && now >= kickoff[m];
  const mergeByMatch = (prev: Record<string, any> = {}, incoming: Record<string, any> = {}) => {
    const out: Record<string, any> = {};
    for (const m of Object.keys(prev)) if (matchLocked(+m)) out[m] = prev[m];        // frozen → keep stored
    for (const m of Object.keys(incoming)) if (!matchLocked(+m)) out[m] = incoming[m]; // open → accept client
    return out;
  };
  prediction.winners = mergeByMatch(prevPred.winners, prediction.winners);
  prediction.manner = mergeByMatch(prevPred.manner, prediction.manner);
  prediction.scorePredictions = mergeByMatch(prevPred.scorePredictions, prediction.scorePredictions);

  // ---- server-authoritative FCFS timestamps for the cash side-game ----
  // Only (re)stamp a match when its exact-score pick actually changes. The client
  // cannot forge an earlier time — we never trust a client-supplied timestamp.
  const prevSp = prevPred.scorePredictions || {};
  const prevAt: Record<string, string> = (existing as any)?.scorePredAt || {};
  const nextSp = prediction.scorePredictions || {};
  const nowIso = new Date().toISOString();
  const scorePredAt: Record<string, string> = { ...prevAt };
  for (const m of Object.keys(nextSp)) {
    const a = nextSp[m], b = prevSp[m];
    const changed = !b || b.a !== a.a || b.b !== a.b;
    if (changed) scorePredAt[m] = nowIso;       // new or edited → reset its FCFS time
  }
  for (const m of Object.keys(scorePredAt)) {     // drop timestamps for removed picks
    if (!nextSp[m]) delete scorePredAt[m];
  }

  // ---- soft-freeze: forfeit grand-prize ONLY on a post-freeze BRACKET edit ----
  // The exact-score cash game (scorePredictions) is per-match and independent of the
  // bracket freeze, so a save that only touches cash scores keeps eligibility intact.
  const frozen = bracketFrozenForPrize(t);
  const bracketChanged = bracketCanon(prevPred) !== bracketCanon(prediction);
  const set: any = { prediction, bonusEligibleAt: new Date(), scorePredAt };
  if (frozen && bracketChanged) {
    set.grandPrizeEligible = false;
    if (!existing || existing.grandPrizeEligible !== false) set.grandPrizeForfeitedAt = new Date();
  }

  // ---- explicit submission: stamp submittedAt + the canonical bracket snapshot ----
  // The snapshot is the MERGED bracket, so the client can compare its current bracket
  // to it and re-show "Submit" only on a real change. A normal (non-submit) save never
  // touches these, so a no-op autosave never flips the state back to "Submit".
  if (submit) {
    set.submittedAt = new Date();
    set.submittedBracket = bracketCanon(prediction);
  }

  const entry = await Entry.findOneAndUpdate(
    { userId: req.userId, tournamentKey: env.tournamentKey },
    { $set: set, $setOnInsert: { tournamentKey: env.tournamentKey, userId: req.userId } },
    { upsert: true, new: true },
  );
  invalidateLeaderboard();
  res.json({
    ok: true, updatedAt: entry.updatedAt,
    grandPrizeEligible: entry.grandPrizeEligible !== false,
    bracketFrozenForPrize: frozen,
    bracketComplete: isBracketComplete(prediction.winners),
    submittedAt: entry.submittedAt || null,
    submittedBracket: (entry as any).submittedBracket || null,
  });
});

// Stable JSON of the BRACKET portion of a prediction — knockout winners + manner
// (+ group predictions that feed the R32 slots). Deliberately EXCLUDES
// scorePredictions (the exact-score cash game), so a cash-only save never counts
// as a bracket edit and never forfeits grand-prize eligibility.
function bracketCanon(p: any): string {
  const stable = (v: any): any => {
    if (Array.isArray(v)) return v.map(stable);
    if (v && typeof v === 'object') {
      const o: any = {};
      for (const k of Object.keys(v).sort()) o[k] = stable(v[k]);
      return o;
    }
    return v;
  };
  return JSON.stringify(stable({
    groups: p?.groups || {},
    winners: p?.winners || {},
    manner: p?.manner || {},
  }));
}

// Free full re-pick (only after a team busts). Clears predictions AND zeroes bonus.
bracketRouter.post('/entry/repick', requireAuth, async (req: AuthedRequest, res) => {
  const t = await getTournament();
  // allowed any time before lock; after lock only the one free reset is permitted
  const entry = await Entry.findOne({ userId: req.userId, tournamentKey: env.tournamentKey });
  if (!entry) return res.status(404).json({ error: 'no_entry' });
  if (entry.rePicked) return res.status(409).json({ error: 'already_repicked' });
  entry.prediction = { groups: {}, winners: {}, manner: {}, scorePredictions: {} } as any;
  entry.rePicked = true;
  entry.bonusEligibleAt = undefined as any; // bonus zeroed
  (entry as any).scorePredAt = {};          // FCFS timestamps reset
  await entry.save();
  invalidateLeaderboard();
  res.json({ ok: true });
});

// Current user profile (for the web app).
bracketRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const u = await User.findById(req.userId).lean();
  if (!u) return res.status(404).json({ error: 'not_found' });
  res.json({ user: publicUser(u) });
});
