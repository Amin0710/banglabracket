// ============================================================
//  poller.ts — background score sync on an adaptive cadence
// ============================================================
// Cadence (per the rate-limit budget — free tier is 100 req/day):
//   • any World Cup fixture LIVE  → every 60s   (fixtures only)
//   • otherwise                   → every 60min (fixtures only)
//   • standings                   → at most once / 24h
// All users read the synced data from Mongo; API usage is independent of traffic.
//
// Guarded by env: starts only when SCORES_POLLER=true AND a key is set. Run this
// on exactly ONE instance. If you scale the API horizontally, leave it false on
// the extras and drive sync from a single cron job (`npm run sync`) instead.

import { env } from '../../config/env.js';
import { runSync } from './sync.js';

const LIVE_MS = 60 * 1000;
const IDLE_MS = 60 * 60 * 1000;
const STANDINGS_MS = 24 * 60 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let lastStandingsAt = 0;
let stopped = false;

export function startScoresPoller(): void {
  if (timer) return;
  if (!env.scoresPoller) return;
  if (!env.apiFootball.enabled) {
    console.log('  ℹ Scores poller enabled but API_FOOTBALL_KEY is missing — not starting.');
    return;
  }
  stopped = false;
  console.log('  ▶ Scores poller started (live=60s / idle=60m, standings/24h).');
  void tick();
}

export function stopScoresPoller(): void {
  stopped = true;
  if (timer) { clearTimeout(timer); timer = null; }
}

async function tick(): Promise<void> {
  if (stopped) return;
  let nextDelay = IDLE_MS;
  try {
    const includeStandings = Date.now() - lastStandingsAt >= STANDINGS_MS;
    const report = await runSync({ includeStandings });
    if (includeStandings) lastStandingsAt = Date.now();
    nextDelay = report.anyLive ? LIVE_MS : IDLE_MS;
    // If we're nearly out of daily budget, slow right down regardless of state.
    if (report.rateRemaining != null && report.rateRemaining <= 10) nextDelay = Math.max(nextDelay, IDLE_MS);
  } catch (e) {
    console.error('  ✗ scores poll failed:', (e as Error).message);
    nextDelay = IDLE_MS; // back off on error
  }
  if (!stopped) timer = setTimeout(tick, nextDelay);
}
