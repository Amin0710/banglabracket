// CLI entry for the live score sync.
//
//   npm run sync                 # one-shot sync (fixtures + standings) -> Mongo
//   npm run sync -- --dry-run    # compute + log the diff, write NOTHING
//   npm run sync -- --no-standings   # fixtures only (cheaper; reuses stored base)
//   npm run sync -- --watch      # stay running on the adaptive poller cadence
//
// Seed remains the cold-start fallback; this never deletes the doc, only updates it.
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../db.js';
import { env } from '../config/env.js';
import { runSync } from '../services/scores/sync.js';
import { startScoresPoller } from '../services/scores/poller.js';

async function main() {
  const args = process.argv.slice(2);
  // `--dry-run` or DRY_RUN=1 (env is a safe fallback when a runner swallows flags).
  const dryRun = args.includes('--dry-run') || ['1', 'true', 'yes'].includes((process.env.DRY_RUN || '').toLowerCase());
  const includeStandings = !args.includes('--no-standings');
  const watch = args.includes('--watch');

  console.log(`  sync mode: ${watch ? 'watch' : dryRun ? 'DRY-RUN (no writes)' : 'WRITE'}${includeStandings ? '' : ' (fixtures only)'}`);

  if (!env.apiFootball.enabled) {
    console.error('  ✗ API_FOOTBALL_KEY is not set. Add it to apps/api/.env (see .env.example).');
    process.exit(1);
  }

  await connectDB();

  if (watch) {
    // Force the poller on for this process regardless of SCORES_POLLER, and keep alive.
    (env as any).scoresPoller = true;
    startScoresPoller();
    console.log('  (watching — Ctrl+C to stop)');
    return; // do not disconnect; poller keeps running
  }

  await runSync({ dryRun, includeStandings });
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
