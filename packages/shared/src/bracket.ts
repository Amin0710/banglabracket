import type { GroupKey, Round, Slot, TeamId } from './types.js';

// ============================================================
//  Official 2026 FIFA World Cup knockout wiring (matches 73–104)
// ============================================================

export interface FeederRef { from: number; type: 'W' | 'L'; }
export interface MatchDef {
  round: Round;
  // R32 matches carry source labels; later rounds carry feeder refs
  a?: string; b?: string;
  srcA?: FeederRef; srcB?: FeederRef;
}

export const MATCH_DEF: Record<number, MatchDef> = {
  73: { round: 'R32', a: 'Runner-up Group A', b: 'Runner-up Group B' },
  74: { round: 'R32', a: 'Winner Group E', b: '3rd Group A/B/C/D/F' },
  75: { round: 'R32', a: 'Winner Group F', b: 'Runner-up Group C' },
  76: { round: 'R32', a: 'Winner Group C', b: 'Runner-up Group F' },
  77: { round: 'R32', a: 'Winner Group I', b: '3rd Group C/D/F/G/H' },
  78: { round: 'R32', a: 'Runner-up Group E', b: 'Runner-up Group I' },
  79: { round: 'R32', a: 'Winner Group A', b: '3rd Group C/E/F/H/I' },
  80: { round: 'R32', a: 'Winner Group L', b: '3rd Group E/H/I/J/K' },
  81: { round: 'R32', a: 'Winner Group D', b: '3rd Group B/E/F/I/J' },
  82: { round: 'R32', a: 'Winner Group G', b: '3rd Group A/E/H/I/J' },
  83: { round: 'R32', a: 'Runner-up Group K', b: 'Runner-up Group L' },
  84: { round: 'R32', a: 'Winner Group H', b: 'Runner-up Group J' },
  85: { round: 'R32', a: 'Winner Group B', b: '3rd Group E/F/G/I/J' },
  86: { round: 'R32', a: 'Winner Group J', b: 'Runner-up Group H' },
  87: { round: 'R32', a: 'Winner Group K', b: '3rd Group D/E/I/J/L' },
  88: { round: 'R32', a: 'Runner-up Group D', b: 'Runner-up Group G' },

  89: { round: 'R16', srcA: { from: 74, type: 'W' }, srcB: { from: 77, type: 'W' } },
  90: { round: 'R16', srcA: { from: 73, type: 'W' }, srcB: { from: 75, type: 'W' } },
  91: { round: 'R16', srcA: { from: 76, type: 'W' }, srcB: { from: 78, type: 'W' } },
  92: { round: 'R16', srcA: { from: 79, type: 'W' }, srcB: { from: 80, type: 'W' } },
  93: { round: 'R16', srcA: { from: 83, type: 'W' }, srcB: { from: 84, type: 'W' } },
  94: { round: 'R16', srcA: { from: 81, type: 'W' }, srcB: { from: 82, type: 'W' } },
  95: { round: 'R16', srcA: { from: 86, type: 'W' }, srcB: { from: 88, type: 'W' } },
  96: { round: 'R16', srcA: { from: 85, type: 'W' }, srcB: { from: 87, type: 'W' } },

  97: { round: 'QF', srcA: { from: 89, type: 'W' }, srcB: { from: 90, type: 'W' } },
  98: { round: 'QF', srcA: { from: 93, type: 'W' }, srcB: { from: 94, type: 'W' } },
  99: { round: 'QF', srcA: { from: 91, type: 'W' }, srcB: { from: 92, type: 'W' } },
  100: { round: 'QF', srcA: { from: 95, type: 'W' }, srcB: { from: 96, type: 'W' } },

  101: { round: 'SF', srcA: { from: 97, type: 'W' }, srcB: { from: 98, type: 'W' } },
  102: { round: 'SF', srcA: { from: 99, type: 'W' }, srcB: { from: 100, type: 'W' } },

  103: { round: 'THIRD', srcA: { from: 101, type: 'L' }, srcB: { from: 102, type: 'L' } },
  104: { round: 'FINAL', srcA: { from: 101, type: 'W' }, srcB: { from: 102, type: 'W' } },
};

export const ALL_MATCHES = Object.keys(MATCH_DEF).map(Number).sort((a, b) => a - b);
export const R32_MATCHES = ALL_MATCHES.filter((m) => MATCH_DEF[m].round === 'R32');
export const KO_MATCHES = ALL_MATCHES.filter((m) => MATCH_DEF[m].round !== 'R32');

export const ROUND_OF = (m: number): Round => MATCH_DEF[m].round;

// A bracket is "complete" once a winner is picked for EVERY knockout match from
// the Round of 32 through the Final (matches 73–104): R32 + R16 + QF + SF +
// 3rd-place + Final. R32 still earns no main bracket points (tiebreaker credit
// only — unchanged in the scoring engine); it is simply required for the bracket
// to count as fully filled. Used to decide the post-login landing page
// (complete → My Entry, incomplete → Bracket).
export function isBracketComplete(winners?: Record<number, TeamId> | null): boolean {
  if (!winners) return false;
  return ALL_MATCHES.every((m) => !!winners[m]);
}

// Round multipliers (main points = BASE_POINTS * multiplier). R32 = 0 (bonus only).
export const ROUND_MULTIPLIER: Record<Round, number> = {
  R32: 0, R16: 1, QF: 2, SF: 3, THIRD: 4, FINAL: 5,
};

export const GROUP_KEYS: GroupKey[] = ['A','B','C','D','E','F','G','H','I','J','K','L'];

// Group winner / runner-up land in these R32 (match, slot) positions.
export const WIN_SLOT: Record<GroupKey, [number, Slot]> = {
  A: [79,'A'], B: [85,'A'], C: [76,'A'], D: [81,'A'], E: [74,'A'], F: [75,'A'],
  G: [82,'A'], H: [84,'A'], I: [77,'A'], J: [86,'A'], K: [87,'A'], L: [80,'A'],
};
export const RUN_SLOT: Record<GroupKey, [number, Slot]> = {
  A: [73,'A'], B: [73,'B'], C: [75,'B'], D: [88,'A'], E: [78,'A'], F: [76,'B'],
  G: [88,'B'], H: [86,'B'], I: [78,'B'], J: [84,'B'], K: [83,'A'], L: [83,'B'],
};
// The eight third-place slots (always slot B) with their official eligible group pools.
export const THIRD_SLOTS: Array<{ match: number; pool: string }> = [
  { match: 74, pool: 'ABCDF' }, { match: 77, pool: 'CDFGH' }, { match: 79, pool: 'CEFHI' },
  { match: 80, pool: 'EHIJK' }, { match: 81, pool: 'BEFIJ' }, { match: 82, pool: 'AEHIJ' },
  { match: 85, pool: 'EFGIJ' }, { match: 87, pool: 'DEIJL' },
];

// ============================================================
//  Resolvers — predicted standings -> R32 slots -> full bracket
// ============================================================

export interface TeamRow {
  name: TeamId; abbr: string;
  P: number; W: number; D: number; L: number; GF: number; GA: number;
}
export interface GroupBase { [g: string]: TeamRow[]; }            // base aggregates
export interface RemainingFixtures { [g: string]: Array<[string, string]>; } // [abbrA, abbrB]
export interface GroupScorePred { [g: string]: Array<{ sa: number | ''; sb: number | '' }>; }

const pts = (o: TeamRow) => o.W * 3 + o.D;
const gd = (o: TeamRow) => o.GF - o.GA;

function clone(r: TeamRow): TeamRow { return { ...r }; }

// Apply a user's predicted remaining results onto a group's base table.
export function effectiveTable(g: string, base: GroupBase, rem: RemainingFixtures, pred: GroupScorePred): TeamRow[] {
  const map: Record<string, TeamRow> = {};
  const arr = (base[g] || []).map((r) => { const o = clone(r); map[o.abbr] = o; return o; });
  (rem[g] || []).forEach((fx, i) => {
    const p = pred[g]?.[i];
    if (!p || p.sa === '' || p.sb === '') return;
    const a = map[fx[0]], b = map[fx[1]];
    if (!a || !b) return;
    const sa = Number(p.sa), sb = Number(p.sb);
    a.P++; b.P++; a.GF += sa; a.GA += sb; b.GF += sb; b.GA += sa;
    if (sa > sb) { a.W++; b.L++; } else if (sb > sa) { b.W++; a.L++; } else { a.D++; b.D++; }
  });
  return arr;
}

export function rankGroup(g: string, base: GroupBase, rem: RemainingFixtures, pred: GroupScorePred): TeamRow[] {
  return effectiveTable(g, base, rem, pred).slice().sort((a, b) =>
    pts(b) - pts(a) || gd(b) - gd(a) || b.GF - a.GF || a.name.localeCompare(b.name));
}

export function groupResolved(g: string, base: GroupBase, rem: RemainingFixtures, pred: GroupScorePred): boolean {
  const complete = (base[g] || []).every((r) => r.P >= 3);
  if (complete) return true;
  const fixtures = rem[g] || [];
  if (fixtures.length === 0) return true;
  return fixtures.every((_, i) => { const p = pred[g]?.[i]; return p && p.sa !== '' && p.sb !== ''; });
}

// Backtracking allocation of the 8 best third-placed groups to the 8 third slots.
export function allocateThirds(groupsTop8: string[]): Record<number, string> | null {
  const used: Record<string, boolean> = {};
  const res: Record<number, string> = {};
  function bt(i: number): boolean {
    if (i === THIRD_SLOTS.length) return true;
    const pool = THIRD_SLOTS[i].pool;
    for (const g of groupsTop8) {
      if (!used[g] && pool.indexOf(g) >= 0) {
        used[g] = true; res[THIRD_SLOTS[i].match] = g;
        if (bt(i + 1)) return true;
        used[g] = false; delete res[THIRD_SLOTS[i].match];
      }
    }
    return false;
  }
  return bt(0) ? res : null;
}

// Resolve predicted R32 slot occupants from group predictions.
// Returns { match: { A: team|null, B: team|null } } for all R32 matches.
export function resolveR32(base: GroupBase, rem: RemainingFixtures, pred: GroupScorePred): Record<number, { A: TeamId | null; B: TeamId | null }> {
  const slots: Record<number, { A: TeamId | null; B: TeamId | null }> = {};
  R32_MATCHES.forEach((m) => { slots[m] = { A: null, B: null }; });

  let allResolved = true;
  for (const g of GROUP_KEYS) {
    if (!base[g]) { allResolved = false; continue; }
    const resolved = groupResolved(g, base, rem, pred);
    if (!resolved) { allResolved = false; continue; }
    const t = rankGroup(g, base, rem, pred);
    const [wm, ws] = WIN_SLOT[g]; const [rm, rs] = RUN_SLOT[g];
    if (t[0]) slots[wm][ws] = t[0].name;
    if (t[1]) slots[rm][rs] = t[1].name;
  }

  if (allResolved) {
    const thirdsRank = GROUP_KEYS
      .map((g) => ({ g, o: rankGroup(g, base, rem, pred)[2] }))
      .filter((x) => x.o)
      .sort((a, b) => pts(b.o) - pts(a.o) || gd(b.o) - gd(a.o) || b.o.GF - a.o.GF || a.o.name.localeCompare(b.o.name));
    const top8 = thirdsRank.slice(0, 8).map((x) => x.g).sort();
    const alloc = allocateThirds(top8);
    if (alloc) {
      for (const m of Object.keys(alloc)) {
        const g = alloc[Number(m)];
        slots[Number(m)].B = rankGroup(g, base, rem, pred)[2].name;
      }
    }
  }
  return slots;
}

// Given R32 occupants and the user's predicted winners per match, resolve the
// participants of every knockout match (who the user thinks reaches each match).
export function resolveBracketParticipants(
  r32: Record<number, { A: TeamId | null; B: TeamId | null }>,
  winners: Record<number, TeamId>,
): Record<number, { A: TeamId | null; B: TeamId | null }> {
  const part: Record<number, { A: TeamId | null; B: TeamId | null }> = {};
  R32_MATCHES.forEach((m) => { part[m] = { A: r32[m]?.A ?? null, B: r32[m]?.B ?? null }; });

  const winnerOf = (m: number): TeamId | null => {
    const w = winners[m];
    const p = part[m];
    if (!p) return null;
    // winner must be one of the two participants to count
    if (w && (w === p.A || w === p.B)) return w;
    return null;
  };
  const loserOf = (m: number): TeamId | null => {
    const w = winnerOf(m); const p = part[m];
    if (!w || !p) return null;
    return w === p.A ? p.B : p.A;
  };

  for (const m of KO_MATCHES) {
    const d = MATCH_DEF[m];
    const a = d.srcA!; const b = d.srcB!;
    part[m] = {
      A: a.type === 'W' ? winnerOf(a.from) : loserOf(a.from),
      B: b.type === 'W' ? winnerOf(b.from) : loserOf(b.from),
    };
  }
  return part;
}

// Resolve actual bracket participants from official R32 + results (same shape).
export function resolveActualParticipants(
  r32: Record<number, { A: TeamId | null; B: TeamId | null }>,
  results: Record<number, { winner: TeamId | null }>,
): Record<number, { A: TeamId | null; B: TeamId | null }> {
  const winners: Record<number, TeamId> = {};
  for (const m of ALL_MATCHES) if (results[m]?.winner) winners[m] = results[m].winner!;
  return resolveBracketParticipants(r32, winners);
}
