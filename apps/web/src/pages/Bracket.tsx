import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GROUP_KEYS, R32_MATCHES, KO_MATCHES, ALL_MATCHES, ROUND_OF, MATCH_DEF,
  resolveR32, resolveBracketParticipants, resolveActualParticipants, rankGroup, formatCompletedMatch,
} from '@banglabracket/shared';
import { api } from '../lib/api';
import { useAuth, useTheme } from '../context/Providers';
import { confirmFreezeEdit } from '../lib/feedback';
import { PageHeader, Flag, NextMatchBanner, NextRoundStrip, StatusChip, SubTabs, useIsMobile } from '../components/ui';

type Scores = Record<string, { sa: number | ''; sb: number | '' }[]>;
type Manner = 'FT' | 'ET' | 'PEN';
const RL: Record<string, string> = { R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', THIRD: 'Third place', FINAL: 'Final' };
const MANNER_LABEL: Record<Manner, string> = { FT: 'Full time', ET: 'Extra time', PEN: 'Penalties' };
const MANNER_SHORT: Record<Manner, string> = { FT: 'FT', ET: 'AET', PEN: 'PENS' };

type MatchState = 'upcoming' | 'live' | 'decided';

// ── stages (Rounds mode). 3rd-place folds into the Final stage. ──
const STAGES: { key: string; label: string; short: string; matches: number[]; sub: string }[] = [
  { key: 'R32', label: 'Round of 32', short: 'R32', matches: R32_MATCHES, sub: 'Tap a team to send it through — sets up your Round of 16' },
  { key: 'R16', label: 'Round of 16', short: 'R16', matches: KO_MATCHES.filter((m) => ROUND_OF(m) === 'R16'), sub: 'Tap a match to pick the winner & manner' },
  { key: 'QF', label: 'Quarter-finals', short: 'QF', matches: KO_MATCHES.filter((m) => ROUND_OF(m) === 'QF'), sub: 'Tap a match to pick the winner & manner' },
  { key: 'SF', label: 'Semi-finals', short: 'SF', matches: KO_MATCHES.filter((m) => ROUND_OF(m) === 'SF'), sub: 'Tap a match to pick the winner & manner' },
  { key: 'FINAL', label: 'Final', short: 'Final', matches: [104, 103], sub: 'Crown your champion' },
];
const ROUND_COL: Record<string, number> = { R32: 0, R16: 1, QF: 2, SF: 3, THIRD: 4, FINAL: 4 };

// True winner-feeders of a knockout match, from the shared MATCH_DEF wiring.
function koChildren(m: number): number[] {
  const d = MATCH_DEF[m]; const out: number[] = [];
  if (d?.srcA?.type === 'W') out.push(d.srcA.from);
  if (d?.srcB?.type === 'W') out.push(d.srcB.from);
  return out;
}
// DFS leaf order from the Final → R32 matches top-to-bottom so each child's two
// feeders are ADJACENT (feeder pairs stack next to each other in the base layout).
const R32_ORDER: number[] = (() => {
  const out: number[] = [];
  (function go(m: number) { const k = koChildren(m); if (!k.length) { out.push(m); return; } k.forEach(go); })(104);
  return out;
})();
// Per-round vertical order (bracket order). Each round is laid out on the SAME
// fixed pitch, top-anchored — a "re-based" digital bracket, NOT a widening tree.
const ROUND_LISTS: number[][] = [
  R32_ORDER,
  [89, 90, 93, 94, 91, 92, 95, 96],
  [97, 98, 99, 100],
  [101, 102],
  [104, 103],
];
// ONE-ROUND-PER-PAGE geometry, focus-aware so it reads as a real bracket.
//   • The FOCUSED round is top-anchored at fixed pitch (a clean column of feeders).
//   • Every LATER round is vertically CENTERED between its two feeders (from
//     MATCH_DEF), so two cards visibly merge into one — the classic bracket shape.
//   • `stride` puts the next round's left edge ~PEEK px inside the band's right
//     edge; the band clips everything past it, so only ONE round + a ~10% sliver show.
//   • Elbow connectors are emitted ONLY for the focused round → its next round.
function computeGeom(CARD_W: number, stride: number, PITCH: number, leftInset: number, focusCol: number) {
  const y: Record<number, number> = {}; const x: Record<number, number> = {};
  ROUND_LISTS.forEach((list, c) => list.forEach((m) => { x[m] = c * stride + leftInset; }));

  // focused round: top-anchored, fixed pitch
  ROUND_LISTS[focusCol].forEach((m, i) => { y[m] = i * PITCH + PITCH / 2; });
  // rounds before focus (off-screen left, clipped): top-anchored too
  for (let c = focusCol - 1; c >= 0; c--) ROUND_LISTS[c].forEach((m, i) => { y[m] = i * PITCH + PITCH / 2; });
  // rounds after focus: each child centered between its two (already-placed) feeders
  for (let c = focusCol + 1; c < ROUND_LISTS.length; c++) {
    ROUND_LISTS[c].forEach((m, i) => {
      const feeders = koChildren(m).filter((k) => y[k] != null);
      y[m] = feeders.length ? feeders.reduce((s, k) => s + y[k], 0) / feeders.length
        : (m === 103 && y[104] != null ? y[104] + PITCH * 1.4 : i * PITCH + PITCH / 2); // 3rd-place has no W-feeders
    });
  }

  const W = (ROUND_LISTS.length - 1) * stride + leftInset + CARD_W;
  // elbow connectors: for each child in the round AFTER focus, join both feeders
  //   feeder right edge → out to mid-x → vertical to the (centered) child y → into child left edge.
  const links: string[] = [];
  for (const m of ROUND_LISTS[focusCol + 1] || []) {
    for (const k of koChildren(m)) {
      if (y[k] == null || x[k] == null) continue;
      const x1 = x[k] + CARD_W, x2 = x[m], mx = (x1 + x2) / 2;
      links.push(`M ${x1} ${y[k]} H ${mx} V ${y[m]} H ${x2}`);
    }
  }
  return { x, y, W, links };
}

function currentStageIdx(t: any): number {
  const fx: any[] = t?.fixtures || [];
  const live = fx.find((f) => f?.status === 'live');
  const next = fx.filter((f) => f?.status === 'scheduled').sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff))[0];
  const tag = (live || next)?.round;
  return tag && ROUND_COL[tag] != null ? ROUND_COL[tag] : 0;
}

// ============================================================
//  Pick choices (winner + manner) — shared by the mobile sheet + desktop inline expander
// ============================================================
function PickBody({ A, B, initialWinner, initialManner, onConfirm, compact }: {
  A: string | null; B: string | null; initialWinner: string | null; initialManner: Manner;
  onConfirm: (winner: string, manner: Manner) => void; compact?: boolean;
}) {
  const { dark } = useTheme();
  const [w, setW] = useState<string | null>(initialWinner);
  const [mn, setMn] = useState<Manner>(initialManner);
  const teamBtn = (team: string | null) => {
    if (!team) return null;
    const sel = w === team;
    return (
      <button onClick={() => setW(team)} style={{
        display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: compact ? '9px 10px' : '13px 14px', borderRadius: 12, fontSize: compact ? 13 : 15, fontWeight: sel ? 800 : 600, fontFamily: 'inherit',
        border: `2px solid ${sel ? 'var(--green)' : 'var(--line)'}`, background: sel ? 'var(--greenSoft)' : 'var(--surface)', color: 'var(--ink)',
      }}>
        <Flag name={team} size={compact ? 20 : 26} /><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team}</span>
        {sel && <svg width={compact ? 15 : 18} height={compact ? 15 : 18} viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}
      </button>
    );
  };
  return (
    <div>
      <div className="faint" style={{ fontSize: 12, marginBottom: 7 }}>Who goes through?</div>
      <div style={{ display: 'grid', gap: 7 }}>{teamBtn(A)}{teamBtn(B)}</div>
      <div className="faint" style={{ fontSize: 12, margin: '13px 0 7px' }}>How do they win? <span style={{ fontWeight: 600 }}>(tiebreaker)</span></div>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['FT', 'ET', 'PEN'] as Manner[]).map((k) => (
          <button key={k} onClick={() => setMn(k)} style={{
            flex: 1, padding: compact ? '8px 4px' : '10px 6px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: compact ? 11.5 : 13,
            border: `2px solid ${mn === k ? 'var(--gold)' : 'var(--line)'}`, background: mn === k ? 'var(--goldSoft)' : 'var(--surface)', color: 'var(--ink)',
          }}>{compact ? MANNER_SHORT[k] : MANNER_LABEL[k]}</button>
        ))}
      </div>
      <button onClick={() => w && onConfirm(w, mn)} disabled={!w} style={{
        width: '100%', marginTop: 14, minHeight: compact ? 40 : 50, borderRadius: 12, border: 'none', cursor: w ? 'pointer' : 'default',
        fontFamily: 'inherit', fontWeight: 800, fontSize: compact ? 14 : 15, opacity: w ? 1 : .5,
        background: dark ? 'var(--gold)' : 'var(--green)', color: dark ? '#1a1405' : '#fff',
      }}>Confirm pick</button>
    </div>
  );
}

// Mobile bottom sheet: X (top-left), no cancel button, single confirm inside PickBody.
function PickSheet({ m, A, B, round, initialWinner, initialManner, onConfirm, onClose }: {
  m: number; A: string | null; B: string | null; round: string;
  initialWinner: string | null; initialManner: Manner;
  onConfirm: (winner: string, manner: Manner) => void; onClose: () => void;
}) {
  return (
    <div className="bb-sheet-overlay" onClick={onClose}>
      <div className="bb-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--surface2)', color: 'var(--ink)', cursor: 'pointer', fontSize: 18, lineHeight: 1, flex: '0 0 auto' }}>×</button>
          <strong style={{ fontSize: 16 }}>{RL[round]} · Match {m}</strong>
        </div>
        <PickBody A={A} B={B} initialWinner={initialWinner} initialManner={initialManner} onConfirm={onConfirm} />
      </div>
    </div>
  );
}

// ============================================================
//  Results tab helpers
// ============================================================
function PlayerStatRow({ p }: { p: any }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: '1px solid var(--line)' }}>
      <span className="tabular faint" style={{ width: 20, textAlign: 'right', flex: '0 0 auto' }}>{p.rank}</span>
      {p.photo
        ? <img src={p.photo} alt="" width={30} height={30} style={{ borderRadius: '50%', objectFit: 'cover', flex: '0 0 auto', background: 'var(--surface2)' }} referrerPolicy="no-referrer" />
        : <Flag name={p.flag || p.country} size={26} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
        <div className="faint" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><Flag name={p.flag || p.country} size={14} />{p.team || p.country}</div>
      </div>
      <span className="tabular" style={{ fontWeight: 800, fontSize: 18 }}>{p.value ?? 0}</span>
    </div>
  );
}

// Clean sportsbook line: "France 3–0 Sweden" · FT / AET / AET (P) + (pens x–y). Same baseline.
function CompletedMatchRow({ fx }: { fx: any }) {
  const f = formatCompletedMatch({ manner: fx.manner, scoreA: fx.scoreA, scoreB: fx.scoreB, penA: fx.penA, penB: fx.penB });
  const roundLabel = RL[fx.round] || (fx.round === 'GROUP' ? 'Group stage' : '');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto 1fr 78px', alignItems: 'center', gap: 8, padding: '11px 0', borderTop: '1px solid var(--line)', fontSize: 13.5 }}>
      <span className="bb-decided" style={{ fontSize: 11, letterSpacing: '.03em', lineHeight: 1.15 }}>
        {f.statusLabel}{roundLabel && <span className="faint" style={{ display: 'block', fontSize: 9, fontWeight: 600 }}>{roundLabel}</span>}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', fontWeight: fx.winner === fx.teamA ? 800 : 600, minWidth: 0 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fx.teamA}</span><Flag name={fx.teamA} size={20} />
      </span>
      <span className="tabular bb-decided" style={{ minWidth: 52, textAlign: 'center', fontSize: 16 }}>{f.scoreA}–{f.scoreB}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: fx.winner === fx.teamB ? 800 : 600, minWidth: 0 }}>
        <Flag name={fx.teamB} size={20} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fx.teamB}</span>
      </span>
      <span className="bb-decided" style={{ fontSize: 11, textAlign: 'right' }}>{f.pens ? `pens ${f.pens}` : ''}</span>
    </div>
  );
}

type ResultsSub = 'matches' | 'groups' | 'scorers' | 'assists';
function ResultsTab({ t }: { t: any }) {
  const [sub, setSub] = useState<ResultsSub>('matches');
  const completed = useMemo(() => (t?.fixtures || [])
    .filter((f: any) => f?.status === 'finished')
    .sort((a: any, b: any) => +new Date(b.kickoff) - +new Date(a.kickoff)), [t]);
  const scorers: any[] = t?.topScorers || [];
  const assists: any[] = t?.topAssists || [];

  return (
    <div>
      <SubTabs<ResultsSub> active={sub} onChange={setSub}
        tabs={[{ key: 'matches', label: 'Matches' }, { key: 'groups', label: 'Groups' }, { key: 'scorers', label: 'Top scorers' }, { key: 'assists', label: 'Top assists' }]} />

      {sub === 'matches' && (
        <div className="card" style={{ padding: 16 }}>
          <strong style={{ fontSize: 15 }}>Completed matches</strong>
          {completed.length
            ? completed.map((fx: any, i: number) => <CompletedMatchRow key={fx.providerId ?? i} fx={fx} />)
            : <div className="faint" style={{ marginTop: 8 }}>No completed matches yet.</div>}
        </div>
      )}

      {sub === 'groups' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 14 }}>
          {GROUP_KEYS.map((g) => {
            const table = rankGroup(g, t.base || {}, {}, {});
            return (
              <div key={g} className="card" style={{ padding: 14 }}>
                <strong>Group {g}</strong>
                <table style={{ width: '100%', fontSize: 13, marginTop: 8 }}><tbody>
                  {table.map((row, i) => (
                    <tr key={row.abbr} style={{ color: i < 2 ? 'var(--ink)' : i === 2 ? 'var(--bronze)' : 'var(--faint)' }}>
                      <td style={{ width: 16 }}>{i + 1}</td>
                      <td style={{ padding: '3px 0' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Flag name={row.name} size={20} />{row.name}</span></td>
                      <td className="tabular faint" style={{ textAlign: 'right' }}>{row.P}</td>
                      <td className="tabular" style={{ textAlign: 'right', fontWeight: 700, paddingLeft: 10 }}>{row.W * 3 + row.D}</td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            );
          })}
        </div>
      )}

      {(sub === 'scorers' || sub === 'assists') && (
        <div className="card" style={{ padding: 16 }}>
          <strong style={{ fontSize: 15 }}>{sub === 'scorers' ? '⚽ Top scorers' : '🅰️ Top assists'}</strong>
          {(sub === 'scorers' ? scorers : assists).length
            ? (sub === 'scorers' ? scorers : assists).slice(0, 20).map((p, i) => <PlayerStatRow key={i} p={p} />)
            : <div className="faint" style={{ marginTop: 8 }}>No data yet.</div>}
        </div>
      )}
    </div>
  );
}

// ============================================================
//  Bracket
// ============================================================
export default function Bracket() {
  const { user } = useAuth();
  const nav = useNavigate();
  const isMobile = useIsMobile();
  const [t, setT] = useState<any>(null);
  const [tab, setTab] = useState<'picks' | 'results' | 'cash'>('picks');
  const [view, setView] = useState<'rounds' | 'whole'>('rounds');
  const [stageIdx, setStageIdx] = useState(0);
  const [sheet, setSheet] = useState<number | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [scores, setScores] = useState<Scores>({});
  const [winners, setWinners] = useState<Record<number, string>>({});
  const [manner, setManner] = useState<Record<number, Manner>>({});
  const [scorePred, setScorePred] = useState<Record<number, { a: number | ''; b: number | '' }>>({});
  const [saved, setSaved] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [eligible, setEligible] = useState(true);
  const [freezeAck, setFreezeAck] = useState(false);
  const [showR32Hint, setShowR32Hint] = useState(true);
  const [wrapW, setWrapW] = useState(0);
  const timer = useRef<any>(null);
  const skipFirstSave = useRef(true);
  const didInitStage = useRef(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const outerRef = useRef<HTMLDivElement | null>(null);   // full available width (for the centered band)
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    (async () => {
      const tour = await api.get('/api/tournament'); setT(tour);
      const init: Scores = {};
      for (const g of GROUP_KEYS) init[g] = (tour.remaining?.[g] || []).map(() => ({ sa: '' as const, sb: '' as const }));
      if (user) {
        try {
          const r = await api.get('/api/entry');
          if (r.entry?.prediction) {
            const p = r.entry.prediction;
            for (const g of Object.keys(p.groups || {})) {
              const arr = p.groups[g]?.scores || [];
              init[g] = (tour.remaining?.[g] || []).map((_: any, i: number) => arr[i] ? { sa: arr[i].sa, sb: arr[i].sb } : { sa: '', sb: '' });
            }
            setWinners(p.winners || {}); setManner(p.manner || {});
            if (p.scorePredictions) setScorePred(p.scorePredictions);
          }
          if (r.grandPrizeEligible === false) setEligible(false);
        } catch {}
      }
      setScores(init); setLoaded(true);
    })();
  }, [user]);

  // #9: after login, land on the current live/next round and centre it.
  useEffect(() => {
    if (!t || didInitStage.current) return;
    didInitStage.current = true;
    setStageIdx(currentStageIdx(t));
  }, [t]);

  // #2: auto-advance to the next round once the front round is fully decided.
  // Marked per stage so a user who swipes BACK to a finished round isn't shoved forward again.
  const autoAdvanced = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!loaded || stageIdx >= STAGES.length - 1 || autoAdvanced.current.has(stageIdx)) return;
    const cur = STAGES[stageIdx].matches.filter((m) => ROUND_OF(m) !== 'THIRD');
    const res = t?.results || {};
    const allDone = cur.length > 0 && cur.every((m) => !!res[m]?.winner);
    if (allDone) { autoAdvanced.current.add(stageIdx); setStageIdx((i) => Math.min(STAGES.length - 1, i + 1)); }
  }, [stageIdx, t, loaded]);

  // measure the pan viewport (for clamped translate)
  useEffect(() => {
    const on = () => setWrapW(outerRef.current?.clientWidth || 0);
    on(); window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [t, tab, view]);

  const frozen = !!t?.bracketFrozenForPrize;
  const predForShared = useMemo(() => { const o: any = {}; for (const g of Object.keys(scores)) o[g] = scores[g].map((s) => ({ sa: s.sa, sb: s.sb })); return o; }, [scores]);
  const r32 = useMemo(() => t ? resolveR32(t.base || {}, t.remaining || {}, predForShared) : {}, [t, predForShared]);

  const fixturesByMatch = useMemo(() => {
    const map: Record<number, any> = {};
    for (const f of (t?.fixtures || [])) if (f?.matchNumber != null) map[f.matchNumber] = f;
    return map;
  }, [t]);

  // R32 slots used to resolve the tree. For a DECIDED R32 match we use the ACTUAL
  // two teams that played (from the fixture), NOT the player's predicted slots —
  // otherwise the real winner (esp. a real 3rd-placed team that differs from the
  // predicted one) fails resolveBracketParticipants' participant check and never
  // flows into R16. (Root cause of the "empty R16 slot" bug — see #3.)
  const r32ForResolve = useMemo(() => {
    const out: Record<number, { A: string | null; B: string | null }> = {};
    for (const m of R32_MATCHES) {
      const res = t?.results?.[m];
      if (res?.winner) {
        const fx = fixturesByMatch[m];
        out[m] = {
          A: fx?.teamA ?? t?.r32?.[m]?.A?.team ?? (r32 as any)[m]?.A ?? null,
          B: fx?.teamB ?? t?.r32?.[m]?.B?.team ?? (r32 as any)[m]?.B ?? null,
        };
      } else out[m] = (r32 as any)[m] || { A: null, B: null };
    }
    return out;
  }, [t, r32, fixturesByMatch]);

  // R32 AUTO-CORRECT: once an R32 match is FINAL, its REAL winner (not the player's
  // guess) flows into the Round of 16. Reality overwrites a wrong early guess.
  const effectiveWinners = useMemo(() => {
    const w: Record<number, string> = { ...winners };
    for (const m of R32_MATCHES) { const res = t?.results?.[m]; if (res?.winner) w[m] = res.winner; }
    return w;
  }, [winners, t]);
  const participants = useMemo(() => resolveBracketParticipants(r32ForResolve as any, effectiveWinners), [r32ForResolve, effectiveWinners]);

  const actualParticipants = useMemo(() => {
    const realR32: any = {};
    for (const m of R32_MATCHES) realR32[m] = { A: t?.r32?.[m]?.A?.team ?? null, B: t?.r32?.[m]?.B?.team ?? null };
    return resolveActualParticipants(realR32, t?.results || {});
  }, [t]);

  const matchStatus = useMemo(() => (m: number): { state: MatchState; res: any; fx: any } => {
    const res = t?.results?.[m];
    if (res && res.winner) return { state: 'decided', res, fx: fixturesByMatch[m] };
    const fx = fixturesByMatch[m];
    if (fx && fx.status === 'live') return { state: 'live', res: null, fx };
    return { state: 'upcoming', res: null, fx };
  }, [t, fixturesByMatch]);

  useEffect(() => {
    if (!loaded || !user) return;
    if (skipFirstSave.current) { skipFirstSave.current = false; return; }
    setSaved(false); clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const groups: any = {};
      for (const g of GROUP_KEYS) {
        const rem = t.remaining?.[g] || [];
        const arr = (scores[g] || []).map((s, i) => rem[i] && s.sa !== '' && s.sb !== '' ? { a: rem[i][0], b: rem[i][1], sa: +s.sa, sb: +s.sb } : null).filter(Boolean);
        if (arr.length) groups[g] = { scores: arr };
      }
      const sp: any = {};
      for (const m of Object.keys(scorePred)) { const v = scorePred[+m]; if (v && v.a !== '' && v.b !== '') sp[m] = { a: +v.a, b: +v.b }; }
      const payload: any = { groups, winners, manner }; if (Object.keys(sp).length) payload.scorePredictions = sp;
      try { const r = await api.put('/api/entry', payload); setSaved(true); if (r?.grandPrizeEligible === false) setEligible(false); } catch {}
    }, 800);
    return () => clearTimeout(timer.current);
  }, [scores, winners, manner, scorePred, loaded, user]);

  if (!t) return <div className="muted">Loading bracket…</div>;
  if (!user) { nav('/'); return null; }

  // ── freeze guard (editing always allowed; after R16 it forfeits grand prize) ──
  async function guardEdit(): Promise<boolean> {
    if (!frozen || !eligible || freezeAck) return true;
    const ok = await confirmFreezeEdit();
    if (ok) { setFreezeAck(true); setEligible(false); }
    return ok;
  }
  async function applyPick(m: number, w: string, mn: Manner) {
    setSheet(null); setExpandedMatch(null);
    if (!(await guardEdit())) return;
    setWinners((prev) => ({ ...prev, [m]: w }));
    if (ROUND_OF(m) !== 'R32') setManner((prev) => ({ ...prev, [m]: mn }));
  }
  function setCashCell(m: number, side: 'a' | 'b', raw: string) {
    const v = raw === '' ? '' : Math.max(0, +raw);
    setScorePred((s) => ({ ...s, [m]: { a: side === 'a' ? v : (s[m]?.a ?? ''), b: side === 'b' ? v : (s[m]?.b ?? '') } }));
  }

  // A knockout match has EXACTLY two participants. Once it's live/decided we show
  // the REAL fixture teams (never a stale predicted/empty slot); otherwise the two
  // predicted feeders; otherwise two nulls (rendered as placeholders). Always {A,B}.
  const partOf = (m: number): { A: string | null; B: string | null } => {
    const base = (ROUND_OF(m) === 'R32' ? r32ForResolve[m] : participants[m]) || { A: null, B: null };
    const s = matchStatus(m);
    if (s.state === 'decided' || s.state === 'live') {
      const fx = fixturesByMatch[m];
      return { A: fx?.teamA ?? base.A ?? null, B: fx?.teamB ?? base.B ?? null };
    }
    return { A: base.A ?? null, B: base.B ?? null };
  };

  // ── one bracket card — ONE global correct/wrong coloring rule ──
  // mode 'rounds': R32 = single-tap-to-pick; R16→Final = sheet (mobile) / inline (desktop).
  // mode 'tree'  : whole-bracket map — unchanged (tap opens the sheet).
  function renderCard(m: number, mode: 'rounds' | 'tree', focused = true) {
    // preview = a non-focused round (the peeking next round). It shows the real
    // matchup (teams or TBD) read-only; tapping it advances to that round.
    const preview = mode === 'rounds' && !focused;
    const p = partOf(m); const round = ROUND_OF(m); const isR32 = round === 'R32';
    const st = matchStatus(m); const decided = st.state === 'decided';
    const rawPick = winners[m] || null;
    const validPick = rawPick && (rawPick === p.A || rawPick === p.B) ? rawPick : null;
    const actualWinner = decided ? st.res?.winner : null;
    const correct = decided && rawPick ? rawPick === actualWinner : null;
    // #6: a LIVE match is still pickable — only a DECIDED match locks the bracket pick.
    // A preview (peek) card is never directly pickable — you advance to that round first.
    const canPick = !decided && !!p.A && !!p.B && !preview;
    const tint = correct === true ? ' bb-correct' : correct === false ? ' bb-wrong' : '';
    const r32cls = isR32 && !decided ? ' bb-r32tile' : '';
    const res = st.res; const fx = st.fx;
    const pick32 = mode === 'rounds' && isR32 && canPick;

    const scoreFor = (team: string | null): number | null => {
      if (!team || !fx) return null;
      if (decided) return team === fx.teamA ? (res?.scoreA ?? null) : team === fx.teamB ? (res?.scoreB ?? null) : null;
      if (st.state === 'live') return team === fx.teamA ? (fx.scoreA ?? null) : team === fx.teamB ? (fx.scoreB ?? null) : null;
      return null;
    };
    const f = decided ? formatCompletedMatch({ manner: res?.manner, scoreA: res?.scoreA, scoreB: res?.scoreB, penA: res?.penA, penB: res?.penB }) : null;
    // penalty tally per team (regulation score already comes from scoreFor) → "1 (3)"
    const penFor = (team: string | null): number | null => {
      if (!team || !fx || !f?.pen) return null;
      return team === fx.teamA ? (res?.penA ?? null) : team === fx.teamB ? (res?.penB ?? null) : null;
    };
    // slotKey is STABLE ('A'/'B') so React always reconciles exactly two rows in
    // place — a resolving feeder replaces its slot rather than leaving a ghost row.
    const slot = (team: string | null, slotKey: 'A' | 'B') => {
      const isPick = !!validPick && team === validPick;
      const isActual = decided && !!team && team === actualWinner;
      const dim = decided && !!team && team !== actualWinner;   // loser dimmed (no strikethrough)
      const score = scoreFor(team); const pen = penFor(team);
      const inner = (<>
        <Flag name={team} size={20} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: team ? undefined : 'var(--faint)' }}>{team || 'TBD'}</span>
        {score != null && <span className="tabular" style={{ fontWeight: 800 }}>{score}{pen != null ? ` (${pen})` : ''}</span>}
        {isPick && !decided && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}
      </>);
      const baseStyle: React.CSSProperties = {
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, fontSize: 13,
        background: isPick && !decided ? 'var(--greenSoft)' : 'transparent', opacity: dim ? .5 : 1, fontWeight: (isActual || isPick) ? 800 : 600,
      };
      if (pick32 && team) return (
        <button key={slotKey} onClick={(e) => { e.stopPropagation(); applyPick(m, team, 'FT'); }}
          style={{ ...baseStyle, width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}>{inner}</button>
      );
      return <div key={slotKey} style={baseStyle}>{inner}</div>;
    };

    // short top-of-card manner tag (team rows already show the "1 (3)" pen score):
    // PEN → "PEN", ET → "AET", normal → "FT". No score repeated in the tag.
    const cardTag = decided && f ? (f.pen ? 'PEN' : f.statusLabel) : '';
    const openInline = mode === 'rounds' && !isR32 && !isMobile && canPick;
    const cardOnClick = preview
      ? () => setStageIdx(ROUND_COL[round] ?? stageIdx)   // tap the peek → advance to that round
      : canPick
        ? (mode === 'tree' ? () => setSheet(m)
          : isR32 ? undefined
            : isMobile ? () => setSheet(m) : () => setExpandedMatch((e) => (e === m ? null : m)))
        : undefined;

    // ── WHOLE-BRACKET (tree) card — flag primary, name underneath; two independent
    //    colour systems: box goes RED only on a decided+wrong MAIN pick; the picked
    //    team row and the manner strip colour themselves and never tint the box. ──
    if (mode === 'tree') {
      const wrongBox = correct === false;   // decided && picked && picked !== actual winner
      const treeSlot = (team: string | null, slotKey: 'A' | 'B') => {
        const isPicked = !!validPick && team === validPick;
        let bg = 'transparent';
        if (isPicked) bg = !decided ? 'var(--goldSoft)' : (validPick === actualWinner ? 'var(--greenSoft)' : 'var(--line)');
        const score = scoreFor(team); const pen = penFor(team);
        return (
          <div key={slotKey} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '5px 3px', borderRadius: 8, background: bg }}>
            <Flag name={team} size={30} />
            <span style={{ fontSize: 10, fontWeight: 700, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: team ? undefined : 'var(--faint)' }}>{team || 'TBD'}</span>
            {score != null && <span className="tabular" style={{ fontSize: 10, fontWeight: 800 }}>{score}{pen != null ? ` (${pen})` : ''}</span>}
          </div>
        );
      };
      const sel = manner[m];                        // user's manner pick ('FT'|'ET'|'PEN')
      const actualManner = decided ? res?.manner : null;
      const MANNER_OPTS: [string, Manner][] = [['FT', 'FT'], ['AET', 'ET'], ['PEN', 'PEN']];
      const mannerStyle = (code: Manner) => {
        if (decided && code === actualManner) return { background: 'var(--greenSoft)', color: 'var(--green)' };            // correct option → green
        if (decided && code === sel && sel !== actualManner) return { background: 'var(--redSoft)', color: 'var(--bad)' };  // wrong selected → red
        if (!decided && code === sel) return { background: 'var(--goldSoft)', color: 'var(--goldText)' };                   // pending selected → amber
        return { background: 'transparent', color: 'var(--faint)' };
      };
      return (
        <div key={m} className="card" onClick={cardOnClick}
          style={{ padding: 7, cursor: cardOnClick ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 5,
            background: wrongBox ? 'var(--redSoft)' : 'var(--surface)', borderColor: wrongBox ? 'var(--bad)' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="faint" style={{ fontSize: 9, fontWeight: 700 }}>M{m}</span>
            {st.state === 'live' && <StatusChip kind="live" />}
            {decided && f && <span className="bb-decided" style={{ fontSize: 8.5 }}>{f.pen ? 'PEN' : f.statusLabel}</span>}
          </div>
          <div style={{ display: 'flex', gap: 5 }}>{treeSlot(p.A, 'A')}{treeSlot(p.B, 'B')}</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {MANNER_OPTS.map(([label, code]) => { const s = mannerStyle(code); return (
              <span key={code} style={{ flex: 1, textAlign: 'center', fontSize: 8.5, fontWeight: 800, padding: '2px 0', borderRadius: 5, ...s }}>{label}</span>
            ); })}
          </div>
        </div>
      );
    }

    // ONE consistent 2-line footer template for EVERY card.
    let l1: string, l2: string;
    if (decided) { l1 = rawPick ? `Your pick: ${rawPick}` : 'No pick made'; l2 = rawPick ? (correct ? 'Correct ✓' : 'Missed ✗') : 'Result final'; }
    else if (validPick) { l1 = `✓ ${validPick}`; l2 = isR32 ? 'Tap a team to change' : `${MANNER_LABEL[manner[m] || 'FT']} · tap to change`; }
    else if (canPick) { l1 = isR32 ? 'Pick a team' : 'Pick a winner'; l2 = isR32 ? 'Sets up your Round of 16' : 'Winner + manner'; }
    else { l1 = 'Teams not set'; l2 = 'Waiting on the previous round'; }

    return (
      <div key={m} className={`card${r32cls}${tint}`} onClick={cardOnClick}
        style={{ padding: 9, cursor: cardOnClick ? 'pointer' : 'default' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, gap: 6 }}>
          <span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>{`${RL[round]} · M${m}`}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {st.state === 'live' && <StatusChip kind="live" />}
            {cardTag && <span className="bb-decided" style={{ fontSize: 9.5, letterSpacing: '.04em' }}>{cardTag}</span>}
          </span>
        </div>
        {slot(p.A, 'A')}
        {slot(p.B, 'B')}
        {mode === 'rounds' && !preview && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: !decided && validPick ? 'var(--green)' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l1}</div>
            <div className="faint" style={{ fontSize: 9.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l2}</div>
          </div>
        )}
        {preview && <div className="faint" style={{ fontSize: 9.5, fontWeight: 700, marginTop: 4, overflow: 'hidden', whiteSpace: 'nowrap' }}>Next round →</div>}
        {openInline && expandedMatch === m && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }} onClick={(e) => e.stopPropagation()}>
            <PickBody compact A={p.A} B={p.B} initialWinner={validPick} initialManner={manner[m] || 'FT'} onConfirm={(w, mn) => applyPick(m, w, mn)} />
          </div>
        )}
      </div>
    );
  }

  // ── ROUNDS geometry: COMPACT one round + a tight peek of the next (see computeGeom) ──
  const CARD_W = isMobile ? 158 : 178;
  const PITCH = isMobile ? 138 : 146;    // > card height (2-line footer) so cards never overlap
  const NODE_H = 118;                     // ≈ card height, so connectors meet card mid-edge
  const inset = 8;
  const GAP = isMobile ? 44 : 60;         // SHORT horizontal elbow reach — cards sit close together
  const peekW = isMobile ? 60 : 78;       // visible sliver of the next round (enough to show flags + names)
  const vw = wrapW || 360;
  // one round = one page; stride is just the focused card + the short elbow gap, so the
  // next round sits RIGHT beside it (no large empty band). The band is the clip window.
  const stride = CARD_W + GAP;
  const bandW = Math.min(vw, inset + CARD_W + GAP + peekW);
  const geom = computeGeom(CARD_W, stride, PITCH, inset, stageIdx);
  // canvas height covers the focused round + its (centered) next round's extent.
  const visNodes = [...ROUND_LISTS[stageIdx], ...(ROUND_LISTS[stageIdx + 1] || [])];
  const canvasH = Math.max(...visNodes.map((m) => geom.y[m] ?? 0)) + NODE_H / 2 + 12;
  // page pan: bring the focused round to the band's left inset, one page per round.
  const translateX = -(stageIdx * stride);

  const go = (dir: -1 | 1) => setStageIdx((i) => Math.min(STAGES.length - 1, Math.max(0, i + dir)));
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    // one round per swipe, velocity-independent — a fast flick never skips two rounds.
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx < 0 ? 1 : -1);
    touch.current = null;
  };

  // WEB round nav: exactly one ‹ (left) + one › (right) flanking the stage tabs.
  // Clearly greyed out + non-interactive at the ends (no dead arrow on the Final).
  const arrowBtn = (dir: -1 | 1) => {
    const disabled = dir < 0 ? stageIdx === 0 : stageIdx === STAGES.length - 1;
    return (
      <button className="btn" aria-label={dir < 0 ? 'Previous round' : 'Next round'} onClick={() => go(dir)}
        disabled={disabled}
        style={{ flex: '0 0 auto', padding: '7px 13px', fontSize: 16, lineHeight: 1, opacity: disabled ? .28 : 1, cursor: disabled ? 'default' : 'pointer', pointerEvents: disabled ? 'none' : 'auto' }}>{dir < 0 ? '‹' : '›'}</button>
    );
  };
  const RoundsView = (
    <div>
      <div style={{ position: 'sticky', top: isMobile ? 56 : 0, zIndex: 20, background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4, paddingBottom: 4 }}>
        {!isMobile && arrowBtn(-1)}
        <div className="bb-stagetabs" style={{ position: 'static', flex: 1, margin: 0, padding: '4px 0' }}>
          {STAGES.map((s, i) => (
            <button key={s.key} data-active={i === stageIdx} onClick={() => setStageIdx(i)}>{isMobile ? s.short : s.label}</button>
          ))}
        </div>
        {!isMobile && arrowBtn(1)}
      </div>
      <div className="faint" style={{ fontSize: 12, fontWeight: 600, margin: '2px 2px 8px', textAlign: 'center' }}>
        {STAGES[stageIdx].sub}{isMobile ? ' · swipe ← → for rounds' : ''}
      </div>
      {stageIdx === 0 && showR32Hint && (
        <div className="card bb-r32tile" style={{ padding: '10px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
          <span style={{ flex: 1 }}>Complete your <strong>Round of 32</strong> picks first — they set up your Round of 16.</span>
          <button onClick={() => setShowR32Hint(false)} aria-label="Dismiss" style={{ border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}
      <div ref={outerRef} style={{ position: 'relative' }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* edge swipe cues are a MOBILE-only affordance — never render on web */}
        {isMobile && <><div className="bb-edge l"><span>‹</span></div><div className="bb-edge r"><span>›</span></div></>}
        {/* the band is the clip window: width = one round + a tight peek, centered */}
        <div className="bb-rounds-wrap" ref={wrapRef} style={{ width: bandW, margin: '0 auto' }}>
          <div className="bb-rounds-canvas" style={{ width: geom.W, height: canvasH, transform: `translateX(${translateX}px)` }}>
            <svg width={geom.W} height={canvasH} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
              {geom.links.map((d, i) => <path key={i} d={d} fill="none" stroke="var(--faint)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
            </svg>
            {visNodes.map((m) => (
              <div key={m} className="bb-node" style={{ left: geom.x[m], top: (geom.y[m] ?? 0) - NODE_H / 2, width: CARD_W, zIndex: expandedMatch === m ? 10 : 2 }}>
                {renderCard(m, 'rounds', ROUND_LISTS[stageIdx].includes(m))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const WholeView = <WholeBracket renderNode={(m: number) => renderCard(m, 'tree')} champion={winners[104] || null} isMobile={isMobile} />;

  // ── CASH: current-round matches with real teams that HAVEN'T kicked off yet ──
  const now = Date.now();
  const cashMatches = ALL_MATCHES.filter((m) => {
    const ap = actualParticipants[m]; if (!ap?.A || !ap?.B) return false;
    if (matchStatus(m).state !== 'upcoming') return false;      // exclude decided + live
    const k = fixturesByMatch[m]?.kickoff;                       // #7: kickoff must be in the future
    return !!k && new Date(k).getTime() > now;
  });

  const sheetMatch = sheet != null ? { m: sheet, p: partOf(sheet), round: ROUND_OF(sheet) } : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader title="Bracket" subtitle="Pick every winner — results update live"
        right={<div className="card" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg><span style={{ fontWeight: 600, fontSize: 14 }}>{saved ? 'Saved' : 'Saving…'}</span>
        </div>} />

      <NextMatchBanner nextMatch={t.nextMatch} />

      {frozen && (
        <div className="card" style={{ padding: '11px 14px', marginBottom: 14, borderColor: 'var(--goldLine)', background: 'var(--goldSoft)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
          {eligible ? <StatusChip kind="r16live" /> : <StatusChip kind="prizelocked" />}
          <span style={{ flex: 1, minWidth: 180 }}>
            {eligible
              ? 'The Round of 16 has kicked off. You can still edit freely — but editing now forfeits grand-prize eligibility.'
              : 'You edited after the Round of 16 kicked off — no longer eligible for the grand prize. Your picks still score points & cash.'}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => setTab('picks')} style={tab === 'picks' ? { background: 'var(--greenSoft)', color: 'var(--green)', borderColor: 'transparent' } : {}}>My Picks</button>
        <button className="btn" onClick={() => setTab('results')} style={tab === 'results' ? { background: 'var(--greenSoft)', color: 'var(--green)', borderColor: 'transparent' } : {}}>Results</button>
        <button className="btn" onClick={() => setTab('cash')} style={tab === 'cash' ? { background: 'var(--greenSoft)', color: 'var(--green)', borderColor: 'transparent' } : {}}>Score for cash</button>
        {tab === 'picks' && (
          <div className="bb-viewtoggle" style={{ marginLeft: 'auto' }}>
            <button data-active={view === 'rounds'} onClick={() => setView('rounds')}>Rounds</button>
            <button data-active={view === 'whole'} onClick={() => setView('whole')}>Whole bracket</button>
          </div>
        )}
      </div>

      {/* grower: fills the remaining viewport height so short rounds don't leave the
          "next round" strip floating high — it sits at a consistent bottom position */}
      <div style={{ flex: 1, minHeight: 0 }}>
      {tab === 'picks' && (view === 'rounds' ? RoundsView : WholeView)}
      {tab === 'results' && <ResultsTab t={t} />}
      {tab === 'cash' && (
        <div className="card" style={{ padding: 16 }}>
          <strong style={{ fontSize: 15 }}>Correct score for cash 💵</strong>
          <p className="muted" style={{ fontSize: 13, margin: '4px 0 12px' }}>
            Predict the EXACT scoreline of the current round's upcoming matches — 100৳ each. Only matches whose teams are set and haven't kicked off appear here.
          </p>
          {cashMatches.length ? cashMatches.map((m) => {
            const ap = actualParticipants[m];
            return (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderTop: '1px solid var(--line)' }}>
                <span className="faint" style={{ fontSize: 10, fontWeight: 700, width: 66 }}>{RL[ROUND_OF(m)]}</span>
                <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', fontWeight: 700, minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ap.A}</span><Flag name={ap.A} size={20} /></span>
                <input className="input tabular" style={{ width: 40, padding: 6, textAlign: 'center' }} inputMode="numeric" value={scorePred[m]?.a ?? ''} onChange={(e) => setCashCell(m, 'a', e.target.value)} />
                <span className="faint">–</span>
                <input className="input tabular" style={{ width: 40, padding: 6, textAlign: 'center' }} inputMode="numeric" value={scorePred[m]?.b ?? ''} onChange={(e) => setCashCell(m, 'b', e.target.value)} />
                <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, minWidth: 0 }}><Flag name={ap.B} size={20} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ap.B}</span></span>
                <span className="pill pill-gold" style={{ fontSize: 9, flex: '0 0 auto' }}>100৳</span>
              </div>
            );
          }) : <div className="faint">No current-round matches open right now — check back when the next round's teams are set.</div>}
        </div>
      )}
      </div>

      <NextRoundStrip nextRound={t.nextRound} />

      {sheetMatch && (
        <PickSheet m={sheetMatch.m} A={sheetMatch.p.A} B={sheetMatch.p.B} round={sheetMatch.round}
          initialWinner={winners[sheetMatch.m] && (winners[sheetMatch.m] === sheetMatch.p.A || winners[sheetMatch.m] === sheetMatch.p.B) ? winners[sheetMatch.m] : null}
          initialManner={manner[sheetMatch.m] || 'FT'}
          onConfirm={(w, mn) => applyPick(sheetMatch.m, w, mn)} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}

// ============================================================
//  Whole bracket — computed geometry + SVG elbow connectors (R16→Final) — UNCHANGED
// ============================================================
const T_CARD_W = 150, T_CARD_H = 96, T_ROW = 120, T_COL = 190;
const T_LEFT_R16 = [89, 90, 93, 94], T_RIGHT_R16 = [91, 92, 95, 96];

function WholeBracket({ renderNode, champion, isMobile }: { renderNode: (m: number) => React.ReactNode; champion: string | null; isMobile: boolean }) {
  const [zoom, setZoom] = useState(isMobile ? 0.6 : 0.9);

  const { x, y, W, H, links } = useMemo(() => {
    const y: Record<number, number> = {}; const x: Record<number, number> = {};
    T_LEFT_R16.forEach((m, i) => { y[m] = i * T_ROW + T_ROW / 2; x[m] = 0; });
    T_RIGHT_R16.forEach((m, i) => { y[m] = i * T_ROW + T_ROW / 2; x[m] = 6 * T_COL; });
    y[97] = (y[89] + y[90]) / 2; y[98] = (y[93] + y[94]) / 2; x[97] = x[98] = T_COL;
    y[99] = (y[91] + y[92]) / 2; y[100] = (y[95] + y[96]) / 2; x[99] = x[100] = 5 * T_COL;
    y[101] = (y[97] + y[98]) / 2; x[101] = 2 * T_COL;
    y[102] = (y[99] + y[100]) / 2; x[102] = 4 * T_COL;
    y[104] = (y[101] + y[102]) / 2; x[104] = 3 * T_COL;
    y[103] = Math.max(...T_LEFT_R16.map((m) => y[m])) + T_ROW; x[103] = 3 * T_COL;
    const W = 6 * T_COL + T_CARD_W;
    const H = Math.max(y[103], y[104]) + T_ROW;
    const pairs: [number, number][] = [
      [89, 97], [90, 97], [93, 98], [94, 98], [97, 101], [98, 101], [101, 104],
      [91, 99], [92, 99], [95, 100], [96, 100], [99, 102], [100, 102], [102, 104],
    ];
    const links = pairs.map(([c, p]) => {
      const cy = y[c], py = y[p];
      if (x[p] > x[c]) { const x1 = x[c] + T_CARD_W, x2 = x[p], mx = (x1 + x2) / 2; return `M${x1} ${cy} H${mx} V${py} H${x2}`; }
      const x1 = x[c], x2 = x[p] + T_CARD_W, mx = (x1 + x2) / 2; return `M${x1} ${cy} H${mx} V${py} H${x2}`;
    });
    return { x, y, W, H, links };
  }, []);

  const nodes = [...T_LEFT_R16, 97, 98, 101, 104, 103, 102, 99, 100, ...T_RIGHT_R16];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span className="faint" style={{ fontSize: 12, fontWeight: 600 }}>Round of 16 → Final</span>
        <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
          <button className="btn" style={{ padding: '4px 10px' }} onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))}>−</button>
          <button className="btn" style={{ padding: '4px 10px' }} onClick={() => setZoom((z) => Math.min(1.3, +(z + 0.15).toFixed(2)))}>+</button>
        </div>
      </div>
      <div className="bb-tree-scroll" style={{ maxHeight: isMobile ? '68vh' : '76vh' }}>
        <div style={{ width: W * zoom, height: H * zoom, position: 'relative' }}>
          <div className="bb-tree" style={{ width: W, height: H, transform: `scale(${zoom})` }}>
            <svg width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {links.map((d, i) => <path key={i} d={d} fill="none" stroke="var(--line)" strokeWidth={2} />)}
            </svg>
            {nodes.map((m) => (
              <div key={m} className="bb-tree-node" style={{ left: x[m], top: y[m] - T_CARD_H / 2, width: T_CARD_W }}>{renderNode(m)}</div>
            ))}
            <div className="bb-tree-node" style={{ left: x[104] - 6, top: y[104] + T_CARD_H, width: T_CARD_W + 12 }}>
              <div style={{ textAlign: 'center', padding: '8px 8px', borderRadius: 12, background: 'var(--goldSoft)', border: '1px solid var(--goldLine)' }}>
                <div className="faint" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.06em' }}>YOUR CHAMPION</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 3 }}>
                  <Flag name={champion} size={20} /><strong style={{ fontSize: 14 }}>{champion || '—'}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
