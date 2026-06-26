import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { env } from '../config/env.js';

const TTL = env.sessionTtlDays * 24 * 60 * 60;

export interface SessionPayload { sub: string; role: 'user' | 'admin'; }

export function signSession(userId: string, role: 'user' | 'admin'): string {
  return jwt.sign({ sub: userId, role }, env.jwtSecret, { expiresIn: TTL });
}

export function verifySession(token: string): SessionPayload | null {
  try { return jwt.verify(token, env.jwtSecret) as SessionPayload; }
  catch { return null; }
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    maxAge: TTL * 1000,
    domain: env.cookieDomain,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(env.cookieName, { path: '/', domain: env.cookieDomain });
}
