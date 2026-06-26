import type { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { env } from '../config/env.js';
import { verifySession } from '../lib/jwt.js';
import { User } from '../models/index.js';

export interface AuthedRequest extends Request {
  userId?: string;
  role?: 'user' | 'admin';
}

// Attaches userId/role if a valid session cookie is present.
export function sessionMiddleware(req: AuthedRequest, _res: Response, next: NextFunction) {
  const token = req.cookies?.[env.cookieName];
  const s = token ? verifySession(token) : null;
  if (s) { req.userId = s.sub; req.role = s.role; }
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.userId) return res.status(401).json({ error: 'auth_required' });
  next();
}

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.userId) return res.status(401).json({ error: 'auth_required' });
  // admin if session role is admin OR the user's email is in ADMIN_EMAILS
  if (req.role === 'admin') return next();
  const user = await User.findById(req.userId).lean();
  if (user?.email && env.adminEmails.includes(user.email.toLowerCase())) return next();
  return res.status(403).json({ error: 'forbidden' });
}

// Body validation via zod. On success, replaces req.body with the parsed value.
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    }
    req.body = parsed.data;
    next();
  };
}

// Central error handler.
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: err.publicMessage || 'server_error' });
}
