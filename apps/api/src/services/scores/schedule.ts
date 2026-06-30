// ============================================================
//  schedule.ts — derive the two countdown targets from fixtures
// ============================================================
// Pure: takes the normalized fixtures stored on the Tournament doc and returns
// the data the front-end countdowns read. Computed per-request so the targets
// are always fresh relative to "now" even between syncs.

import type { RoundTag } from './sync.js';

const ORDER: RoundTag[] = ['GROUP', 'R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL'];
const LABEL: Record<RoundTag, string> = {
  GROUP: 'Group Stage', R32: 'Round of 32', R16: 'Round of 16',
  QF: 'Quarter-finals', SF: 'Semi-finals', THIRD: 'Third-place play-off',
  FINAL: 'Final', OTHER: 'Match',
};

export interface StoredFixture {
  matchNumber: number | null;
  round: RoundTag;
  kickoff: string;
  status: 'scheduled' | 'live' | 'finished' | 'other';
  teamA: string; teamB: string;
}

export interface NextMatch { kickoff: string; label: string; matchNumber: number | null; }
export interface NextRound { round: string; startsAt: string | null; }
export interface Schedule { nextMatch: NextMatch | null; nextRound: NextRound | null; }

export function deriveSchedule(fixtures: StoredFixture[] = []): Schedule {
  const list = Array.isArray(fixtures) ? fixtures : [];

  // nextMatch = earliest not-yet-started fixture.
  const upcoming = list
    .filter((f) => f.status === 'scheduled')
    .sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));
  const nm = upcoming[0];
  const nextMatch: NextMatch | null = nm
    ? { kickoff: nm.kickoff, label: `${nm.teamA} vs ${nm.teamB}`, matchNumber: nm.matchNumber }
    : null;

  // nextRound = the round after the furthest one that has already started.
  let startedIdx = -1;
  for (const f of list) {
    if (f.status === 'scheduled') continue;
    const i = ORDER.indexOf(f.round);
    if (i > startedIdx) startedIdx = i;
  }
  const nextIdx = startedIdx + 1;
  let nextRound: NextRound | null = null;
  if (nextIdx < ORDER.length) {
    const tag = ORDER[nextIdx];
    const kicks = list.filter((f) => f.round === tag).map((f) => +new Date(f.kickoff)).sort((a, b) => a - b);
    nextRound = { round: LABEL[tag], startsAt: kicks.length ? new Date(kicks[0]).toISOString() : null };
  }

  return { nextMatch, nextRound };
}
