// Shared domain types used by both the API and the web client.

export type Round = 'R32' | 'R16' | 'QF' | 'SF' | 'THIRD' | 'FINAL';
export type Manner = 'FT' | 'ET' | 'PEN';
export type Slot = 'A' | 'B';
export type GroupKey =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';

// A team is referenced by a stable string id (we use the team name; could be a code).
export type TeamId = string;

// ---- Tournament truth (admin-confirmed / official) ----

export interface R32SlotTruth {
  team: TeamId | null;     // who actually occupies this R32 slot
  confirmedAt: string | null; // ISO timestamp when it became official (for early-bird bonus)
}

export interface MatchResultTruth {
  match: number;           // 73..104
  winner: TeamId | null;   // actual winner (admin-confirmed)
  manner: Manner | null;   // how they advanced
  scoreA: number | null;
  scoreB: number | null;
  confirmedAt: string | null;
}

export interface TournamentTruth {
  // R32 slot occupants (match -> {A,B})
  r32: Record<number, { A: R32SlotTruth; B: R32SlotTruth }>;
  // knockout results 73..104
  results: Record<number, MatchResultTruth>;
  // the actual final score (for exact-score tiebreaker) lives in results[104]
}

// ---- A user's predicted entry ----

export interface GroupResultPrediction {
  // predicted scores for the remaining fixtures of a group, in fixture order
  // each entry: home/away abbreviations + predicted goals
  scores: Array<{ a: TeamId; b: TeamId; sa: number; sb: number }>;
}

export interface BracketPrediction {
  // raw group predictions (authoritative input; server re-resolves R32 from these)
  groups: Partial<Record<GroupKey, GroupResultPrediction>>;
  // predicted winner team for each knockout match 73..104
  winners: Record<number, TeamId>;
  // predicted manner per knockout match (bonus/tiebreaker only)
  manner?: Record<number, Manner>;
  // predicted EXACT score per knockout match. Drives the cash side-game,
  // and match 104 also feeds the exact-final points tiebreaker.
  scorePredictions?: Record<number, { a: number; b: number }>;
}

// ---- Scoring output ----

export interface ScoreBreakdownRow {
  match: number;
  round: Round;
  predictedWinner: TeamId | null;
  actualWinner: TeamId | null;
  correct: boolean;
  points: number; // main points awarded for this match
}

export interface EntryScore {
  main: number;                 // primary ranking number
  tieExactFinal: 0 | 1;         // 1 if exact final score correct
  tieManner: number;            // sum of manner bonuses
  tieEarlyBird: number;         // sum of early-bird R32 bonuses
  breakdown: ScoreBreakdownRow[];
  // a single sortable key array for leaderboard ranking (desc)
  rankKey: number[];
}
