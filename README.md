# BanglaBracket — Brings World Cup 2026

A free bracket-prediction prize game for a mostly-Bangladeshi audience. Players predict the
remaining group results, which fills their Round of 32, then pick every knockout winner through
to the champion. Closest brackets win the prize (100,000 BDT).

This is **Phase 1** (the bracket game). The Phase-2 fantasy engine rules are captured in config
but not built yet.

## Stack

A TypeScript MERN monorepo (npm workspaces), one repo, push-to-deploy.

| Part | Tech | Deploys to |
| --- | --- | --- |
| `packages/shared` | TypeScript | (imported by both apps) |
| `apps/api` | Express + Mongoose + Passport + Zod | Railway (always-on) |
| `apps/web` | React + Vite + Tailwind + React Router | Vercel |
| Database | MongoDB Atlas (Compass-compatible) | Atlas |
| Email codes | Resend | — |
| Edge / WAF | Cloudflare (optional, recommended) | — |

`packages/shared` holds the single source of truth: the official 2026 bracket wiring
(matches 73–104), the group→Round-of-32 resolver (including third-place allocation), and the
scoring engine. Both the API and the web app import it, so predictions and scoring never drift.

## Scoring (config-driven, in `packages/shared/src/scoring.ts`)

- **Main points** = correct knockout winner × round multiplier × 100:
  R16 = 100, QF = 200, SF = 300, 3rd place = 400, Final = 500. Round of 32 scores 0 (bonus only).
- A predicted winner only counts if that team is a participant of *your own* predicted path
  (anti-nonsense guard).
- **Tiebreakers**, applied in order: main points → exact final scoreline → manner of advance
  (Penalties +5 / Extra-time +4 / Full-time +3, credited when your predicted manner matches the
  actual one) → Round-of-32 early-bird (+10 per slot predicted correctly *before* it was
  officially confirmed).
- One free full **re-pick** is allowed; using it zeroes your bonus points.

## Local development

Prereqs: Node 20+, a MongoDB connection string (Atlas free tier is fine).

```bash
npm install                 # installs all workspaces
npm run build:shared        # compile the shared package once

cp apps/api/.env.example apps/api/.env
# edit apps/api/.env — at minimum set MONGODB_URI, JWT_SECRET, ENCRYPTION_KEY, ADMIN_EMAILS
#   openssl rand -hex 32   (run twice, for JWT_SECRET and ENCRYPTION_KEY)

npm run seed                # loads the tournament (groups, fixtures, lock time)

# two terminals:
npm run dev:api             # http://localhost:4000
npm run dev:web             # http://localhost:5173  (proxies /api and /auth to the API)
```

Sign in with the email-code option — if Resend isn't configured the 6-digit code prints to the
**API console**. To get the admin panel, sign in with an email listed in `ADMIN_EMAILS`.

> If you rebuild the shared package, run `npm run build:shared` again (the API imports its
> compiled output; the web app bundles it directly via Vite).

## Deployment

**1. MongoDB Atlas** — create a free M0 cluster, add a database user, allow network access
(`0.0.0.0/0` or Railway's egress), copy the SRV connection string into `MONGODB_URI`. The same
string opens the data in MongoDB Compass.

**2. API → Railway** — New Project → Deploy from GitHub repo. Set root to the repo, build command
`npm install && npm run build:shared && npm run build -w @banglabracket/api`, start command
`npm run start -w @banglabracket/api`. Add all variables from `apps/api/.env.example`. Add a
custom domain `api.banglabracket.com`. Run the seed once (Railway shell): `npm run seed`.

**3. Web → Vercel** — Import the repo. Root directory `apps/web`, framework **Vite**, build
`npm install && npm run build:shared --prefix ../.. && npm run build`, output `dist`. Set
`VITE_API_URL=https://api.banglabracket.com`. Add domain `banglabracket.com`.

**4. Cross-origin cookies (important)** — Host web and API on the **same registrable domain**:
`banglabracket.com` (web) and `api.banglabracket.com` (API). Then on the API set
`COOKIE_DOMAIN=.banglabracket.com` and `COOKIE_SECURE=true`. The session stays a first-party
cookie (`SameSite=Lax`), which sidesteps browsers that block third-party cookies. `WEB_URL` and
`API_URL` must be the real https origins so CORS and OAuth callbacks line up.

**5. Resend** — verify your sending domain (DNS records; can take a while, do it early), create an
API key, set `RESEND_API_KEY` and `MAIL_FROM`.

**6. Cloudflare (recommended)** — put both domains behind Cloudflare for free TLS, WAF, and DDoS
protection. Leave proxying on.

**7. Google / Facebook OAuth** — set redirect URIs to `{API_URL}/auth/google/callback` and
`{API_URL}/auth/facebook/callback`. Facebook stays disabled (`FACEBOOK_ENABLED=false`) and hidden
on the frontend until your app is approved — flip both flags then; nothing else blocks launch.

## Admin & verification

The admin panel (`/admin`, gated by `ADMIN_EMAILS`) shows signup/verified/eligible KPIs, confirms
each knockout result (winner / manner / score — which recomputes the leaderboard), confirms R32
slot occupants, and verifies users by their `VERIFY-XXXXX` code.

Verification is deliberately **manual and out-of-band**: there is no photo upload and no image
storage in the app. A player sends their code + ID + selfie to you privately (Discord/Messenger);
you mark them eligible. Optionally a player can pre-register an ID number — it's stored
AES-256-GCM encrypted, with an HMAC unique index so one ID maps to one account. Eligibility is by
**nationality**, not residence.

## Security notes

- Sessions are signed JWTs in `httpOnly` + `Secure` cookies (`SameSite=Lax`).
- Sensitive PII (ID number, DOB) is encrypted at rest with AES-256-GCM; uniqueness is enforced via
  an HMAC index so raw values aren't indexed.
- The bracket **lock is enforced server-side** against `lockAt` (first R32 kickoff,
  2026-06-28T19:00:00Z) — never trust the client clock.
- All input is validated with Zod; admin actions are written to an audit log; Helmet sets security
  headers; auth endpoints are rate-limited.

## Project layout

```
banglabracket/
├─ packages/shared/      bracket wiring + resolver + scoring (the brain)
├─ apps/api/             Express API, Mongoose models, auth, admin
│  └─ src/scripts/seed.ts  loads the tournament snapshot + lock time
└─ apps/web/             React client (light/dark themes, mobile-first)
```
