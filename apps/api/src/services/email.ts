import crypto from 'node:crypto';
import { Resend } from 'resend';
import { env } from '../config/env.js';
import { LoginCode, User } from '../models/index.js';
import { randomCode, verificationCode } from '../lib/crypto.js';

let resend: Resend | null = null;
function client() {
  if (!env.resend.enabled) return null;
  if (!resend) resend = new Resend(env.resend.key);
  return resend;
}

function hashCode(code: string, email: string) {
  return crypto.createHash('sha256').update(`${code}:${email}:${env.jwtSecret}`).digest('hex');
}

export async function requestEmailCode(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw Object.assign(new Error('invalid_email'), { status: 400, publicMessage: 'invalid_email' });

  const code = randomCode(6);
  const expiresAt = new Date(Date.now() + env.emailCodeTtlMin * 60 * 1000);
  await LoginCode.deleteMany({ email });
  await LoginCode.create({ email, codeHash: hashCode(code, email), expiresAt });

  const c = client();
  if (!c) { console.log(`[email] (no Resend) login code for ${email}: ${code}`); return { delivered: false }; }
  await c.emails.send({
    from: env.resend.from,
    to: email,
    subject: 'Your BanglaBracket login code',
    html: `<p>Your BanglaBracket login code is <strong style="font-size:22px;letter-spacing:3px">${code}</strong>.</p><p>It expires in ${env.emailCodeTtlMin} minutes.</p>`,
  });
  return { delivered: true };
}

export async function verifyEmailCode(emailRaw: string, code: string) {
  const email = emailRaw.trim().toLowerCase();
  const rec = await LoginCode.findOne({ email }).sort({ createdAt: -1 });
  if (!rec) throw Object.assign(new Error('code_not_found'), { status: 400, publicMessage: 'code_not_found' });
  if (rec.expiresAt < new Date()) { await rec.deleteOne(); throw Object.assign(new Error('code_expired'), { status: 400, publicMessage: 'code_expired' }); }
  if ((rec.attempts ?? 0) >= 5) { await rec.deleteOne(); throw Object.assign(new Error('too_many_attempts'), { status: 429, publicMessage: 'too_many_attempts' }); }
  if (rec.codeHash !== hashCode(code.trim(), email)) {
    rec.attempts = (rec.attempts ?? 0) + 1; await rec.save();
    throw Object.assign(new Error('code_invalid'), { status: 400, publicMessage: 'code_invalid' });
  }
  await rec.deleteOne();
  return email;
}

// Find a user by email, or create one with a fresh verification code.
export async function findOrCreateByEmail(email: string) {
  let user = await User.findOne({ email });
  if (!user) user = await User.create({ email, verificationCode: verificationCode() });
  else if (!user.verificationCode) { user.verificationCode = verificationCode(); await user.save(); }
  return user;
}
