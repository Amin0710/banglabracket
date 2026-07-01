// ============================================================
//  format.ts — display formatting for completed matches
// ============================================================
// Pure presentation helper. The later design pass consumes the structured
// parts returned here; nothing about layout/styling lives in this file.
//
// Conventions:
//   • FT          — decided in 90' (normal time)
//   • AET         — decided in extra time
//   • AET (P)     — drawn after ET, decided on penalties
//   • Extra-time score is rendered split as "90'+ET", e.g. a 2–2 after 90'
//     that became 3–2 in extra time shows the home side as "2+1".
//   • Penalty shoot-out result is returned separately as e.g. "4–3".

import type { Manner } from './types.js';

export interface CompletedMatchScore {
  manner?: Manner | null;
  scoreA: number | null; // final on-pitch total (includes extra time, excludes pens)
  scoreB: number | null;
  ftA?: number | null;   // score after 90' (regulation), if known
  ftB?: number | null;
  penA?: number | null;  // penalty shoot-out tally, if any
  penB?: number | null;
}

export interface FormattedMatch {
  statusLabel: string;     // 'FT' | 'AET' | 'AET (P)'
  scoreA: string;          // '2' or, in ET, '2+1'
  scoreB: string;
  pens: string | null;     // '4–3' when decided on penalties, else null
  aet: boolean;            // went to extra time
  pen: boolean;            // decided on penalties
}

/**
 * Format a finished match into display-ready parts. Robust to a missing 90'
 * split: extra-time goals are derived as (final total − 90' score), so the
 * "2+1" form appears only when we actually know the regulation score.
 */
export function formatCompletedMatch(r: CompletedMatchScore): FormattedMatch {
  const manner: Manner = r.manner || 'FT';
  const aet = manner === 'ET' || manner === 'PEN';
  const pen = manner === 'PEN';
  const sa = r.scoreA ?? 0;
  const sb = r.scoreB ?? 0;

  let scoreA = String(sa);
  let scoreB = String(sb);
  // Split into 90'+ET only when the regulation score is known and ET goals are non-negative.
  if (aet && r.ftA != null && r.ftB != null) {
    const etA = sa - r.ftA;
    const etB = sb - r.ftB;
    if (etA >= 0 && etB >= 0) {
      scoreA = `${r.ftA}+${etA}`;
      scoreB = `${r.ftB}+${etB}`;
    }
  }

  let statusLabel = aet ? 'AET' : 'FT';
  let pens: string | null = null;
  if (pen) {
    statusLabel = 'AET (P)';
    if (r.penA != null && r.penB != null) pens = `${r.penA}–${r.penB}`;
  }

  return { statusLabel, scoreA, scoreB, pens, aet, pen };
}
