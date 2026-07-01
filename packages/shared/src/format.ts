// ============================================================
//  format.ts — display formatting for completed matches
// ============================================================
// Pure presentation helper. The later design pass consumes the structured
// parts returned here; nothing about layout/styling lives in this file.
//
// Conventions (final score only — NO 90'+ET split):
//   • FT          — decided in 90' (normal time)          → "France 3–0 Sweden"  FT
//   • AET         — decided in extra time (show final)     → "Spain 2–1 Italy"    AET
//   • AET (P)     — drawn after ET, decided on penalties   → "Germany 1–1 …"      AET (P)  (pens 3–4)
//   • Penalty shoot-out tally is returned separately as e.g. "3–4".

import type { Manner } from './types.js';

export interface CompletedMatchScore {
  manner?: Manner | null;
  scoreA: number | null; // final on-pitch total (includes extra time, excludes pens)
  scoreB: number | null;
  ftA?: number | null;   // (accepted for back-compat; no longer displayed)
  ftB?: number | null;
  penA?: number | null;  // penalty shoot-out tally, if any
  penB?: number | null;
}

export interface FormattedMatch {
  statusLabel: string;     // 'FT' | 'AET' | 'AET (P)'
  scoreA: string;          // final score only, e.g. '3'
  scoreB: string;
  pens: string | null;     // '3–4' when decided on penalties, else null
  aet: boolean;            // went to extra time
  pen: boolean;            // decided on penalties
}

/**
 * Format a finished match into display-ready parts. Always shows the FINAL
 * on-pitch score (no "90'+ET" split); extra time is conveyed by the AET tag and
 * penalties by the separate `pens` shoot-out tally.
 */
export function formatCompletedMatch(r: CompletedMatchScore): FormattedMatch {
  const manner: Manner = r.manner || 'FT';
  const aet = manner === 'ET' || manner === 'PEN';
  const pen = manner === 'PEN';

  const scoreA = String(r.scoreA ?? 0);
  const scoreB = String(r.scoreB ?? 0);

  let statusLabel = aet ? 'AET' : 'FT';
  let pens: string | null = null;
  if (pen) {
    statusLabel = 'AET (P)';
    if (r.penA != null && r.penB != null) pens = `${r.penA}–${r.penB}`;
  }

  return { statusLabel, scoreA, scoreB, pens, aet, pen };
}
