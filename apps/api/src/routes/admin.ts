import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { User, Tournament, AuditLog, Entry } from '../models/index.js';
import { getLeaderboard, invalidateLeaderboard, getCashAwards, getCashLeaderboard } from '../services/tournament.js';
import { CASH } from '@banglabracket/shared';
import { requireAuth, requireAdmin, validate, type AuthedRequest } from '../middleware/index.js';
import { encryptField, hmac } from '../lib/crypto.js';
import { publicUser } from './auth.js';

export const apiRouter = Router();

// ---------------- Leaderboard ----------------
apiRouter.get('/leaderboard', async (req, res) => {
  const eligibleOnly = req.query.eligible === '1';
  const rows = await getLeaderboard({ eligibleOnly });
  res.json({ rows, count: rows.length });
});

// Public cash side-game leaderboard + winners wall
apiRouter.get('/cash-leaderboard', async (_req, res) => {
  const rows = await getCashLeaderboard();
  res.json({ rows, count: rows.length });
});

// Public signup counters (for landing page / admin KPIs).
apiRouter.get('/stats', async (_req, res) => {
  const [total, verified, eligible, entries] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ verified: true }),
    User.countDocuments({ prizeEligible: true }),
    Entry.countDocuments({ tournamentKey: env.tournamentKey }),
  ]);
  res.json({ totalUsers: total, verified, prizeEligible: eligible, entries });
});

// ---------------- User self-service: complete profile / submit ID for verification ----------------
apiRouter.put('/me/profile', requireAuth, validate(z.object({
  name: z.string().max(80).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(6).max(20).optional(),
  bkash: z.string().max(20).optional(),
  overseas: z.boolean().optional(),
  location: z.object({ lat: z.number(), lng: z.number() }).optional(),
  district: z.string().max(40).optional(),
})), async (req: AuthedRequest, res) => {
  const u = await User.findById(req.userId);
  if (!u) return res.status(404).json({ error: 'not_found' });
  const norm = (s: string) => s.replace(/[^\d+]/g, '');

  if (req.body.phone !== undefined) {
    const phone = norm(req.body.phone);
    const bkash = req.body.bkash ? norm(req.body.bkash) : undefined;
    const candidates = [phone, ...(bkash ? [bkash] : [])];
    const clash = await User.findOne({ _id: { $ne: u._id }, $or: [{ phone: { $in: candidates } }, { bkash: { $in: candidates } }] }).lean();
    if (clash) return res.status(409).json({ error: 'number_in_use' });
    if (!bkash && !req.body.overseas) return res.status(400).json({ error: 'bkash_or_overseas_required' });
    u.phone = phone;
    if (bkash) u.bkash = bkash;
  } else if (req.body.bkash !== undefined) {
    u.bkash = norm(req.body.bkash);
  }
  if (req.body.name !== undefined) u.name = req.body.name;
  if (req.body.overseas !== undefined) u.overseas = req.body.overseas;
  if (req.body.location) u.location = { ...req.body.location, capturedAt: new Date() } as any;
  if (req.body.district !== undefined) (u as any).district = req.body.district;
  await u.save();
  res.json({ ok: true, user: publicUser(u) });
});

// Submit ID details for later manual verification (encrypted at rest; one ID = one account).
apiRouter.put('/me/id', requireAuth, validate(z.object({
  idType: z.enum(['nid', 'passport', 'birth_certificate']),
  idNumber: z.string().min(3).max(40),
  dob: z.string().max(20).optional(),
})), async (req: AuthedRequest, res) => {
  const u = await User.findById(req.userId);
  if (!u) return res.status(404).json({ error: 'not_found' });
  const idHmac = hmac(req.body.idType + ':' + req.body.idNumber);
  const taken = await User.findOne({ nidHmac: idHmac, _id: { $ne: u._id } }).lean();
  if (taken) return res.status(409).json({ error: 'id_already_used' });
  u.nidEnc = encryptField(JSON.stringify({ type: req.body.idType, number: req.body.idNumber }));
  u.nidHmac = idHmac;
  if (req.body.dob) u.dobEnc = encryptField(req.body.dob);
  await u.save();
  res.json({ ok: true, submitted: true });
});

// ---------------- Admin ----------------
apiRouter.get('/admin/kpis', requireAdmin, async (_req, res) => {
  const [total, verified, eligible, entries, withId] = await Promise.all([
    User.countDocuments({}), User.countDocuments({ verified: true }),
    User.countDocuments({ prizeEligible: true }), Entry.countDocuments({}),
    User.countDocuments({ nidHmac: { $exists: true } }),
  ]);
  const cash = await getCashAwards();
  res.json({
    totalUsers: total, verified, prizeEligible: eligible, entries, idSubmitted: withId,
    cashTotal: cash.total, cashWinners: Object.keys(cash.perUser).length,
    cashConfig: { perCorrect: CASH.perCorrect, perMatchPool: CASH.perMatchPool, perPlayerCap: CASH.perPlayerCap, slotsPerMatch: CASH.slotsPerMatch },
  });
});

// Cash side-game detail: per-match winners + per-user totals (for payout after verification).
apiRouter.get('/admin/cash', requireAdmin, async (_req, res) => {
  const cash = await getCashAwards();
  // attach names/phones for payout
  const ids = Object.keys(cash.perUser);
  const users = await User.find({ _id: { $in: ids } }, { name: 1, phone: 1, bkash: 1, prizeEligible: 1 }).lean();
  const uMap = new Map(users.map((u) => [String(u._id), u]));
  const payouts = Object.entries(cash.perUser).map(([userId, amount]) => ({
    userId, amount,
    name: uMap.get(userId)?.name || null,
    phone: uMap.get(userId)?.phone || null,
    bkash: uMap.get(userId)?.bkash || null,
    prizeEligible: !!uMap.get(userId)?.prizeEligible,
  })).sort((a, b) => b.amount - a.amount);
  res.json({ total: cash.total, perMatch: cash.perMatch, payouts });
});

// Confirm an R32 slot occupant (drives early-bird bonus + bracket truth).
apiRouter.post('/admin/r32', requireAdmin, validate(z.object({
  match: z.number().int(), slot: z.enum(['A', 'B']), team: z.string(),
})), async (req: AuthedRequest, res) => {
  const t = await Tournament.findOne({ key: env.tournamentKey });
  if (!t) return res.status(404).json({ error: 'no_tournament' });
  const r32: any = t.r32 || {};
  r32[req.body.match] = r32[req.body.match] || { A: { team: null, confirmedAt: null }, B: { team: null, confirmedAt: null } };
  r32[req.body.match][req.body.slot] = { team: req.body.team, confirmedAt: new Date().toISOString() };
  t.r32 = r32; t.markModified('r32'); await t.save();
  await AuditLog.create({ actor: req.userId, action: 'confirm_r32', target: `${req.body.match}.${req.body.slot}`, meta: { team: req.body.team } });
  invalidateLeaderboard();
  res.json({ ok: true });
});

// Confirm a knockout match result (winner / manner / score).
apiRouter.post('/admin/result', requireAdmin, validate(z.object({
  match: z.number().int().min(73).max(104),
  winner: z.string(),
  manner: z.enum(['FT', 'ET', 'PEN']),
  scoreA: z.number().int().min(0).max(99),
  scoreB: z.number().int().min(0).max(99),
})), async (req: AuthedRequest, res) => {
  const t = await Tournament.findOne({ key: env.tournamentKey });
  if (!t) return res.status(404).json({ error: 'no_tournament' });
  const results: any = t.results || {};
  results[req.body.match] = { match: req.body.match, winner: req.body.winner, manner: req.body.manner, scoreA: req.body.scoreA, scoreB: req.body.scoreB, confirmedAt: new Date().toISOString() };
  t.results = results; t.markModified('results'); await t.save();
  await AuditLog.create({ actor: req.userId, action: 'confirm_result', target: String(req.body.match), meta: req.body });
  invalidateLeaderboard();
  res.json({ ok: true });
});

// Manually verify a user (set eligibility). Reviewed via private DM, not in-app.
apiRouter.post('/admin/verify-user', requireAdmin, validate(z.object({
  userId: z.string(), verified: z.boolean(), prizeEligible: z.boolean().optional(),
})), async (req: AuthedRequest, res) => {
  const u = await User.findById(req.body.userId);
  if (!u) return res.status(404).json({ error: 'not_found' });
  u.verified = req.body.verified;
  u.verifiedAt = req.body.verified ? new Date() : undefined as any;
  u.verifiedBy = req.userId;
  if (req.body.prizeEligible !== undefined) u.prizeEligible = req.body.prizeEligible;
  await u.save();
  await AuditLog.create({ actor: req.userId, action: 'verify_user', target: req.body.userId, meta: { verified: u.verified, prizeEligible: u.prizeEligible } });
  invalidateLeaderboard();
  res.json({ ok: true });
});

// Look up a user by verification code (admin verification workflow).
apiRouter.get('/admin/user-by-code/:code', requireAdmin, async (req, res) => {
  const u = await User.findOne({ verificationCode: req.params.code }).lean();
  if (!u) return res.status(404).json({ error: 'not_found' });
  res.json({ user: { id: String(u._id), name: u.name, email: u.email, phone: u.phone, verified: u.verified, prizeEligible: u.prizeEligible, hasId: !!u.nidHmac } });
});
