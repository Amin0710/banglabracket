import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { verificationCode } from '../lib/crypto.js';

async function upsertOAuth(provider: 'google' | 'facebook', providerId: string, email?: string, name?: string) {
  const idField = provider === 'google' ? 'googleId' : 'facebookId';
  let user = await User.findOne({ [idField]: providerId });
  if (user) return user;
  if (email) {
    user = await User.findOne({ email: email.toLowerCase() });
    if (user) { (user as any)[idField] = providerId; if (!user.name && name) user.name = name; await user.save(); return user; }
  }
  return User.create({ [idField]: providerId, email: email?.toLowerCase(), name, verificationCode: verificationCode() });
}

export function configurePassport() {
  if (env.google.enabled) {
    passport.use(new GoogleStrategy(
      { clientID: env.google.id, clientSecret: env.google.secret, callbackURL: `${env.apiUrl}/auth/google/callback` },
      async (_a, _r, profile, done) => {
        try { done(null, await upsertOAuth('google', profile.id, profile.emails?.[0]?.value, profile.displayName)); }
        catch (e) { done(e as any); }
      },
    ));
  }
  if (env.facebook.enabled) {
    passport.use(new FacebookStrategy(
      { clientID: env.facebook.id, clientSecret: env.facebook.secret, callbackURL: `${env.apiUrl}/auth/facebook/callback`, profileFields: ['id', 'displayName', 'emails'] },
      async (_a, _r, profile, done) => {
        try { done(null, await upsertOAuth('facebook', profile.id, profile.emails?.[0]?.value, profile.displayName)); }
        catch (e) { done(e as any); }
      },
    ));
  }
}

export { passport };
