import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { Entry, User } from '../models/index.js';
import { getTournament, isLocked, scoreOne, invalidateLeaderboard, getUserCash } from '../services/tournament.js';
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
    nextMatch: schedule.nextMatch, nextRound: schedule.nextRound,
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
});

// Load the signed-in user's entry (+ live score and cash side-game view).
bracketRouter.get('/entry', requireAuth, async (req: AuthedRequest, res) => {
  const t = await getTournament();
  const entry = await Entry.findOne({ userId: req.userId, tournamentKey: env.tournamentKey }).lean();
  let score = null;
  if (entry) score = scoreOne(entry.prediction as any, t, entry.bonusEligibleAt ? new Date(entry.bonusEligibleAt).toISOString() : undefined);
  const cash = await getUserCash(String(req.userId));
  res.json({
    entry: entry ? { prediction: entry.prediction, rePicked: entry.rePicked, updatedAt: entry.updatedAt } : null,
    locked: isLocked(t), score, cash,
  });
});

// Save / autosave the bracket. Rejected once locked (server-side time check).
bracketRouter.put('/entry', requireAuth, validate(predictionSchema), async (req: AuthedRequest, res) => {
  const t = await getTournament();
  if (isLocked(t)) return res.status(423).json({ error: 'locked' });

  const prediction = req.body;

  // Server-authoritative FCFS timestamps for the cash side-game:
  // only (re)stamp a match when its exact-score pick actually changes. The client
  // cannot forge an earlier time — we never trust a client-supplied timestamp.
  const existing = await Entry.findOne({ userId: req.userId, tournamentKey: env.tournamentKey }).lean();
  const prevSp = (existing?.prediction as any)?.scorePredictions || {};
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

  const entry = await Entry.findOneAndUpdate(
    { userId: req.userId, tournamentKey: env.tournamentKey },
    { $set: { prediction, bonusEligibleAt: new Date(), scorePredAt }, $setOnInsert: { tournamentKey: env.tournamentKey, userId: req.userId } },
    { upsert: true, new: true },
  );
  invalidateLeaderboard();
  res.json({ ok: true, updatedAt: entry.updatedAt });
});

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
