// ============================================================
//  poller.ts — event-driven background score sync
// ============================================================
// Cadence (per the rate-limit budget — free tier is 100 req/day):
//   • any World Cup fixture LIVE  → poll every 60s   (fixtures only)
//   • otherwise                   → sleep until ~2 min before the next kickoff,
//                                   then start polling; recompute at full-time
//   • once / 24h                  → a safety sync (standings + scorers/assists +
//                                   reschedules) regardless of match state
// All users read the synced data from Mongo; API usage is independent of traffic.
//
// Guarded by env: starts only when SCORES_POLLER=true AND a key is set. Run this
// on exactly ONE instance. If you scale the API horizontally, leave it false on
// the extras and drive sync from a single cron job (`npm run sync`) instead.

import { env } from '../../config/env.js';
import { runSync } from './sync.js';

const LIVE_MS = 60 * 1000;                       // poll cadence while a match is live
const PREKICK_LEAD_MS = 2 * 60 * 1000;           // wake ~2 min before the next kickoff
const MIN_SLEEP_MS = 60 * 1000;                  // never schedule tighter than this when idle
const MAX_SLEEP_MS = 6 * 60 * 60 * 1000;         // re-check at least every 6h (catches reschedules)
const DAILY_MS = 24 * 60 * 60 * 1000;            // safety-sync interval
const LOW_RATE_FLOOR_MS = 60 * 60 * 1000;        // back off to ≥1h when the daily budget runs low

let timer: NodeJS.Timeout | null = null;
let lastDailyAt = 0;
let stopped = false;

export function startScoresPoller(): void {
  if (timer) return;
  if (!env.scoresPoller) return;
  if (!env.apiFootball.enabled) {
    console.log('  ℹ Scores poller enabled but API_FOOTBALL_KEY is missing — not starting.');
    return;
  }
  stopped = false;
  console.log('  ▶ Scores poller started (live=60s / sleep until ~2m before kickoff, daily safety sync).');
  void tick();
}

export function stopScoresPoller(): void {
  stopped = true;
  if (timer) { clearTimeout(timer); timer = null; }
}

async function tick(): Promise<void> {
  if (stopped) return;
  let nextDelay = MAX_SLEEP_MS;
  try {
    // Daily safety sync also refreshes standings + scorers/assists; otherwise
    // fixtures-only (cheap) to detect live matches / the next kickoff.
    const doDaily = Date.now() - lastDailyAt >= DAILY_MS;
    const report = await runSync({ includeStandings: doDaily, includePlayers: doDaily });
    if (doDaily) lastDailyAt = Date.now();

    nextDelay = computeDelay(report.anyLive, report.nextKickoffAt, report.rateRemaining);
  } catch (e) {
    console.error('  ✗ scores poll failed:', (e as Error).message);
    nextDelay = LOW_RATE_FLOOR_MS; // back off on error
  }
  if (!stopped) timer = setTimeout(tick, nextDelay);
}

// Decide how long to sleep before the next poll.
export function computeDelay(anyLive: boolean, nextKickoffAt: string | null, rateRemaining: number | null): number {
  const now = Date.now();
  let delay: number;

  if (anyLive) {
    delay = LIVE_MS;                               // a match is on — poll tightly
  } else if (nextKickoffAt) {
    const untilKick = +new Date(nextKickoffAt) - now - PREKICK_LEAD_MS;
    delay = clamp(untilKick, MIN_SLEEP_MS, MAX_SLEEP_MS); // wake ~2 min before kickoff
  } else {
    delay = MAX_SLEEP_MS;                          // nothing scheduled — just heartbeat
  }

  // Never sleep past the next due daily safety sync.
  const untilDaily = lastDailyAt + DAILY_MS - now;
  delay = Math.min(delay, Math.max(untilDaily, MIN_SLEEP_MS));

  // Rate-header backoff: when the daily budget runs low, slow right down.
  if (rateRemaining != null && rateRemaining <= 10) delay = Math.max(delay, LOW_RATE_FLOOR_MS);

  return delay;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
