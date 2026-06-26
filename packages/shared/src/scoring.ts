import type {
  BracketPrediction, EntryScore, ScoreBreakdownRow, TournamentTruth, Manner, TeamId,
} from './types.js';
import {
  KO_MATCHES, R32_MATCHES, MATCH_DEF, ROUND_MULTIPLIER, ROUND_OF,
  GroupBase, RemainingFixtures, GroupScorePred, resolveR32, resolveBracketParticipants,
} from './bracket.js';

// ---- Scoring configuration (tweak without touching logic) ----
export const SCORING = {
  basePoints: 100,                 // main = basePoints * roundMultiplier
  manner: { PEN: 5, ET: 4, FT: 3 } as Record<Manner, number>,
  earlyBirdPerSlot: 10,            // per correct R32 slot predicted before it was confirmed
};

export interface ScoreContext {
  base: GroupBase;
  remaining: RemainingFixtures;
  truth: TournamentTruth;
}

// Convert a prediction's raw group scores into the GroupScorePred shape.
function toGroupPred(p: BracketPrediction): GroupScorePred {
  const out: GroupScorePred = {};
  for (const g of Object.keys(p.groups)) {
    const gp = (p.groups as any)[g];
    out[g] = (gp?.scores || []).map((s: any) => ({ sa: s.sa, sb: s.sb }));
  }
  return out;
}

// Authoritatively recompute the predicted R32 from raw group predictions (anti-tamper).
export function predictedR32(p: BracketPrediction, ctx: ScoreContext) {
  return resolveR32(ctx.base, ctx.remaining, toGroupPred(p));
}

export function scoreEntry(
  p: BracketPrediction,
  ctx: ScoreContext,
  entryBonusEligibleAt?: string, // when the entry was submitted/last-saved (for early-bird)
): EntryScore {
  const r32 = predictedR32(p, ctx);
  const predParts = resolveBracketParticipants(r32, p.winners || {});

  const breakdown: ScoreBreakdownRow[] = [];
  let main = 0;

  // ---- Main points: correct winner of each knockout match * round multiplier ----
  for (const m of KO_MATCHES) {
    const round = ROUND_OF(m);
    const mult = ROUND_MULTIPLIER[round];
    const actualWinner = ctx.truth.results[m]?.winner ?? null;

    // predicted winner must be one of the predicted participants of m
    const parts = predParts[m];
    let predWinner: TeamId | null = p.winners?.[m] ?? null;
    if (predWinner && parts && predWinner !== parts.A && predWinner !== parts.B) predWinner = null;

    const correct = !!predWinner && !!actualWinner && predWinner === actualWinner;
    const pointsAwarded = correct ? SCORING.basePoints * mult : 0;
    main += pointsAwarded;
    breakdown.push({ match: m, round, predictedWinner: predWinner, actualWinner, correct, points: pointsAwarded });
  }

  // ---- Tiebreaker 1: exact final score ----
  let tieExactFinal: 0 | 1 = 0;
  const finalRes = ctx.truth.results[104];
  const finalPred = p.scorePredictions?.[104];
  if (finalPred && finalRes && finalRes.scoreA != null && finalRes.scoreB != null) {
    if (finalPred.a === finalRes.scoreA && finalPred.b === finalRes.scoreB) tieExactFinal = 1;
  }

  // ---- Tiebreaker 2: manner of advance (independent of winner correctness) ----
  let tieManner = 0;
  for (const m of KO_MATCHES) {
    const predM = p.manner?.[m];
    const actM = ctx.truth.results[m]?.manner;
    if (predM && actM && predM === actM) tieManner += SCORING.manner[actM];
  }

  // ---- Tiebreaker 3: early-bird R32 slot placement ----
  let tieEarlyBird = 0;
  const submittedAt = entryBonusEligibleAt ? Date.parse(entryBonusEligibleAt) : Number.POSITIVE_INFINITY;
  for (const m of R32_MATCHES) {
    (['A', 'B'] as const).forEach((slot) => {
      const truthSlot = ctx.truth.r32[m]?.[slot];
      if (!truthSlot || !truthSlot.team) return;
      const predTeam = r32[m]?.[slot] ?? null;
      if (predTeam && predTeam === truthSlot.team) {
        // award only if the user's pick predated the official confirmation
        const confAt = truthSlot.confirmedAt ? Date.parse(truthSlot.confirmedAt) : 0;
        if (confAt === 0 || submittedAt < confAt) tieEarlyBird += SCORING.earlyBirdPerSlot;
      }
    });
  }

  return {
    main,
    tieExactFinal,
    tieManner,
    tieEarlyBird,
    breakdown,
    rankKey: [main, tieExactFinal, tieManner, tieEarlyBird],
  };
}

// Compare two entries for leaderboard ordering (desc). Returns >0 if b ranks higher.
export function compareScores(a: EntryScore, b: EntryScore): number {
  for (let i = 0; i < a.rankKey.length; i++) {
    if (b.rankKey[i] !== a.rankKey[i]) return b.rankKey[i] - a.rankKey[i];
  }
  return 0;
}
