import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { passport } from '../services/oauth.js';
import { requestEmailCode, verifyEmailCode, findOrCreateByEmail } from '../services/email.js';
import { signSession, setSessionCookie, clearSessionCookie } from '../lib/jwt.js';
import { verificationCode } from '../lib/crypto.js';
import { validate, type AuthedRequest } from '../middleware/index.js';

export const authRouter = Router();
const limiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 12, standardHeaders: true, legacyHeaders: false });

function roleFor(email?: string | null): 'user' | 'admin' {
  return email && env.adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user';
}
function login(res: any, user: any) {
  setSessionCookie(res, signSession(String(user._id), roleFor(user.email)));
}

// ---- Phone-first signup (no SMS; the session cookie is the credential) ----
const phoneNorm = (s: string) => s.replace(/[^\d+]/g, '');
const signupSchema = z.object({
  phone: z.string().min(6).max(20),
  name: z.string().max(80).optional(),
  email: z.string().email().optional(),
  bkash: z.string().max(20).optional(),
  overseas: z.boolean().optional(),
  location: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

authRouter.post('/signup', limiter, validate(signupSchema), async (req: AuthedRequest, res) => {
  const { name, email, overseas, location } = req.body as z.infer<typeof signupSchema>;
  const phone = phoneNorm(req.body.phone);
  const bkash = req.body.bkash ? phoneNorm(req.body.bkash) : undefined;

  // Uniqueness: a phone value can be used by only one account, across phone+bkash.
  const candidates = [phone, ...(bkash ? [bkash] : [])];
  const clash = await User.findOne({ $or: [{ phone: { $in: candidates } }, { bkash: { $in: candidates } }] }).lean();
  if (clash) return res.status(409).json({ error: 'number_in_use' });

  if (email) {
    const emailClash = await User.findOne({ email: email.toLowerCase() }).lean();
    if (emailClash) return res.status(409).json({ error: 'email_in_use' });
  }

  // Overseas users with no Bkash must have provided a location signal (advisory only).
  if (!bkash && !overseas) return res.status(400).json({ error: 'bkash_or_overseas_required' });

  const user = await User.create({
    phone, bkash, name, email: email?.toLowerCase(),
    overseas: !!overseas,
    location: location ? { ...location, capturedAt: new Date() } : undefined,
    ipCountry: (req.headers['cf-ipcountry'] as string) || undefined,
    verificationCode: verificationCode(),
    role: roleFor(email),
  });
  login(res, user);
  res.json({ ok: true, user: publicUser(user) });
});

// ---- Email code (also works as cross-device login / linking) ----
authRouter.post('/email/request', limiter, validate(z.object({ email: z.string().email() })), async (req, res) => {
  const r = await requestEmailCode(req.body.email);
  res.json({ ok: true, delivered: r.delivered });
});
authRouter.post('/email/verify', limiter, validate(z.object({ email: z.string().email(), code: z.string().min(4).max(8) })), async (req: AuthedRequest, res) => {
  const email = await verifyEmailCode(req.body.email, req.body.code);
  // if already signed in (phone-first), link email to that account
  if (req.userId) {
    const existing = await User.findById(req.userId);
    if (existing && !existing.email) {
      const taken = await User.findOne({ email });
      if (!taken) { existing.email = email; existing.role = roleFor(email); await existing.save(); login(res, existing); return res.json({ ok: true, user: publicUser(existing), linked: true }); }
    }
  }
  const user = await findOrCreateByEmail(email);
  login(res, user);
  res.json({ ok: true, user: publicUser(user) });
});

// ---- Google ----
if (env.google.enabled) {
  authRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
  authRouter.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: `${env.webUrl}${env.webAppPath}/?login=failed` }),
    (req: any, res) => { login(res, req.user); res.redirect(`${env.webUrl}${env.webAppPath}/onboard`); });
}

// ---- Facebook (gated by FACEBOOK_ENABLED) ----
if (env.facebook.enabled) {
  authRouter.get('/facebook', passport.authenticate('facebook', { scope: ['email'], session: false }));
  authRouter.get('/facebook/callback',
    passport.authenticate('facebook', { session: false, failureRedirect: `${env.webUrl}${env.webAppPath}/?login=failed` }),
    (req: any, res) => { login(res, req.user); res.redirect(`${env.webUrl}${env.webAppPath}/onboard`); });
}

authRouter.post('/logout', (_req, res) => { clearSessionCookie(res); res.json({ ok: true }); });

export function publicUser(u: any) {
  return {
    id: String(u._id), name: u.name || null, email: u.email || null, phone: u.phone || null,
    bkash: u.bkash || null, overseas: !!u.overseas, verified: !!u.verified, prizeEligible: !!u.prizeEligible,
    verificationCode: u.verificationCode || null, role: u.role || 'user',
  };
}
