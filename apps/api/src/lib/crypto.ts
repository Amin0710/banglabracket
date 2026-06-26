import crypto from 'node:crypto';
import { env } from '../config/env.js';

// Field-level encryption for sensitive PII (NID/passport number, DOB).
// Stored format: iv:authTag:ciphertext (all base64). A DB dump leaks nothing usable.

function key(): Buffer | null {
  if (!/^[0-9a-fA-F]{64}$/.test(env.encKey)) return null;
  return Buffer.from(env.encKey, 'hex');
}

export function encryptField(plain: string): string {
  const k = key();
  if (!k) throw new Error('ENCRYPTION_KEY not configured');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

export function decryptField(stored: string): string {
  const k = key();
  if (!k) throw new Error('ENCRYPTION_KEY not configured');
  const [ivB, tagB, ctB] = stored.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(ivB, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64')), decipher.final()]).toString('utf8');
}

// Deterministic HMAC for building a UNIQUE index on a sensitive value
// (e.g. one NID number = one account) without storing the raw value in the index.
export function hmac(value: string): string {
  const secret = env.encKey || env.jwtSecret || 'fallback';
  return crypto.createHmac('sha256', secret).update(value.trim().toLowerCase()).digest('hex');
}

export function randomCode(digits = 6): string {
  const n = crypto.randomInt(0, 10 ** digits);
  return n.toString().padStart(digits, '0');
}

// Short human verification code like VERIFY-7F3K9 (no ambiguous chars).
export function verificationCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += alphabet[crypto.randomInt(0, alphabet.length)];
  return 'VERIFY-' + s;
}
