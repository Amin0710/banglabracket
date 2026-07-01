import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GROUP_KEYS, R32_MATCHES, KO_MATCHES, ROUND_OF, ROUND_MULTIPLIER, MATCH_DEF,
  resolveR32, resolveBracketParticipants, rankGroup, formatCompletedMatch,
} from '@banglabracket/shared';
import { api } from '../lib/api';
import { useAuth } from '../context/Providers';
import { confirmFreezeEdit } from '../lib/feedback';
import { PageHeader, Flag, NextMatchBanner, NextRoundStrip, StatusChip, LiveDot, SubTabs, useIsMobile } from '../components/ui';

type Scores = Record<string, { sa: number | ''; sb: number | '' }[]>;
const RL: Record<string, string> = { R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', THIRD: 'Third place', FINAL: 'Final' };

type MatchState = 'upcoming' | 'live' | 'decided';
interface RowOutcome { score: number | null; won: boolean; decided: boolean }

function TeamRow({ name, onClick, selected, dim, interactive = true, outcome }: {
  name: string | null; onClick?: () => void; selected?: boolean; dim?: boolean;
  interactive?: boolean; outcome?: RowOutcome;
}) {
  const clickable = interactive && !!onClick && !!name;
  const won = !!outcome?.decided && outcome.won;
  const lost = !!outcome?.decided && !outcome.won;
  return (
    <button onClick={clickable ? onClick : undefined} disabled={!clickable}
      style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
        background: won ? 'var(--greenSoft)' : selected ? 'var(--greenSoft)' : 'transparent', color: 'var(--ink)',
        border: 'none', borderRadius: 9, padding: '8px 10px', cursor: clickable ? 'pointer' : 'default',
        opacity: (lost || dim) ? 0.45 : 1, fontWeight: won ? 800 : 600, fontSize: 14 }}>
      <Flag name={name} />
      <span style={{ flex: 1, textDecoration: (lost || dim) ? 'line-through' : 'none' }}>{name || '—'}</span>
      {outcome && outcome.score != null && <span className="tabular" style={{ fontWeight: won ? 800 : 700 }}>{outcome.score}</span>}
      {selected && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}
    </button>
  );
}

function StatusBadge({ state }: { state: MatchState }) {
  if (state === 'live') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: '#d83a3a' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d83a3a', animation: 'bbBlink 1.2s infinite' }} />LIVE
    </span>
  );
  if (state === 'decided') return <span className="faint" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.04em' }}>FINAL</span>;
  return null;
}

// Map the actual fixture/result onto a card's predicted A/B slots, but only when
// the predicted pair equals the actual pair (orientation-aware). Returns null
// when the match hasn't started or the user's predicted teams differ from reality.
function alignedOutcome(state: MatchState, fx: any, res: any, pA: string | null, pB: string | null): { A: RowOutcome; B: RowOutcome } | null {
  if (state === 'upcoming' || !fx || !pA || !pB) return null;
  const decided = state === 'decided';
  const aA = fx.teamA, aB = fx.teamB;
  const sa = decided ? res?.scoreA : fx.scoreA;
  const sb = decided ? res?.scoreB : fx.scoreB;
  const winner = decided ? res?.winner : null;
  if (aA === pA && aB === pB) return { A: { score: sa ?? null, won: winner === aA, decided }, B: { score: sb ?? null, won: winner === aB, decided } };
  if (aA === pB && aB === pA) return { A: { score: sb ?? null, won: winner === aB, decided }, B: { score: sa ?? null, won: winner === aA, decided } };
  return null;
}

// Decided/live result strip. DECIDED shows the real match with manner + score in
// GOLD (both themes), score in "2+1" extra-time form via formatCompletedMatch().
function ActualResultLine({ state, fx, res }: { state: MatchState; fx: any; res: any }) {
  if (!fx && state === 'upcoming') return null;
  if (state === 'decided') {
    const f = formatCompletedMatch({ manner: res?.manner, scoreA: res?.scoreA, scoreB: res?.scoreB, ftA: res?.ftA, ftB: res?.ftB, penA: res?.penA, penB: res?.penB });
    const teamA = fx?.teamA, teamB = fx?.teamB, winner = res?.winner;
    return (
      <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'var(--goldSoft)', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span className="bb-decided" style={{ fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase' }}>{f.statusLabel}</span>
        {teamA && <span style={{ fontWeight: winner === teamA ? 800 : 600 }}>{teamA}</span>}
        <span className="tabular bb-decided">{f.scoreA}–{f.scoreB}</span>
        {teamB && <span style={{ fontWeight: winner === teamB ? 800 : 600 }}>{teamB}</span>}
        {f.pens && <span className="bb-decided" style={{ fontSize: 10 }}>pens {f.pens}</span>}
      </div>
    );
  }
  // live
  return (
    <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(216,50,47,.08)', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--bad)', fontWeight: 800, fontSize: 10 }}><LiveDot color="var(--teal)" size={6} />LIVE</span>
      {fx?.teamA && <span style={{ fontWeight: 700 }}>{fx.teamA}</span>}
      <span className="tabular" style={{ fontWeight: 800 }}>{fx?.scoreA ?? 0}–{fx?.scoreB ?? 0}</span>
      {fx?.teamB && <span style={{ fontWeight: 700 }}>{fx.teamB}</span>}
    </div>
  );
}

// ── Bracket geometry (from the shared knockout wiring) ──
const ROUND_DEFS: { key: string; label: string; matches: number[] }[] = [
  { key: 'R32', label: 'Round of 32', matches: R32_MATCHES },
  { key: 'R16', label: 'Round of 16', matches: KO_MATCHES.filter((m) => ROUND_OF(m) === 'R16') },
  { key: 'QF', label: 'Quarter-finals', matches: KO_MATCHES.filter((m) => ROUND_OF(m) === 'QF') },
  { key: 'SF', label: 'Semi-finals', matches: KO_MATCHES.filter((m) => ROUND_OF(m) === 'SF') },
  { key: 'THIRD', label: 'Third-place play-off', matches: KO_MATCHES.filter((m) => ROUND_OF(m) === 'THIRD') },
  { key: 'FINAL', label: 'Final', matches: KO_MATCHES.filter((m) => ROUND_OF(m) === 'FINAL') },
];

// Winner-feeder children of a knockout match (stops at R32, which has no feeders).
function koChildren(m: number): number[] {
  const d = MATCH_DEF[m]; const out: number[] = [];
  if (d?.srcA?.type === 'W') out.push(d.srcA.from);
  if (d?.srcB?.type === 'W') out.push(d.srcB.from);
  return out;
}
// Levels from a root SF match down to its R32 feeders: [[SF],[QF..],[R16..],[R32..]].
function levelsFrom(root: number): number[][] {
  const levels: number[][] = []; let cur = [root];
  while (cur.length) { levels.push(cur); cur = cur.flatMap(koChildren); }
  return levels;
}
const LEFT_LEVELS = levelsFrom(101);   // half feeding Semi-final 101
const RIGHT_LEVELS = levelsFrom(102);  // half feeding Semi-final 102

// ── Results tab: read-only ACTUAL tournament (from synced base/results/fixtures
// + daily scorer/assist tables). Basic render — the design pass styles this.
function PlayerStatRow({ p, unit }: { p: any; unit: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid var(--line)' }}>
      <span className="tabular faint" style={{ width: 18 }}>{p.rank}</span>
      {p.photo
        ? <img src={p.photo} alt="" width={24} height={24} style={{ borderRadius: '50%', objectFit: 'cover' }} />
        : <Flag name={p.flag || p.country} size={22} />}
      <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
      <span className="faint" style={{ fontSize: 12 }}>{p.country || p.team}</span>
      <span className="tabular" style={{ fontWeight: 700 }}>{p.value} {unit}</span>
    </div>
  );
}

// Sportsbook-style finished match: manner + score in gold, ET score as "2+1".
function CompletedMatchRow({ fx }: { fx: any }) {
  const f = formatCompletedMatch({ manner: fx.manner, scoreA: fx.scoreA, scoreB: fx.scoreB, ftA: fx.ftA, ftB: fx.ftB, penA: fx.penA, penB: fx.penB });
  const roundLabel = RL[fx.round] || (fx.round === 'R32' ? 'Round of 32' : fx.round === 'GROUP' ? 'Group stage' : '');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderTop: '1px solid var(--line)', fontSize: 13.5 }}>
      <span style={{ width: 58, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="bb-decided" style={{ fontSize: 10.5, letterSpacing: '.04em' }}>{f.statusLabel}</span>
        {roundLabel && <span className="faint" style={{ fontSize: 9 }}>{roundLabel}</span>}
      </span>
      <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', fontWeight: fx.winner === fx.teamA ? 800 : 600 }}>{fx.teamA}<Flag name={fx.teamA} size={20} /></span>
      <span className="tabular bb-decided" style={{ minWidth: 58, textAlign: 'center', fontSize: 15 }}>{f.scoreA}–{f.scoreB}</span>
      <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontWeight: fx.winner === fx.teamB ? 800 : 600 }}><Flag name={fx.teamB} size={20} />{fx.teamB}</span>
      {f.pens && <span className="bb-decided" style={{ fontSize: 11, width: 54, textAlign: 'right' }}>pens {f.pens}</span>}
    </div>
  );
}

type ResultsSub = 'groups' | 'scorers' | 'assists' | 'matches';
function ResultsTab({ t }: { t: any }) {
  const [sub, setSub] = useState<ResultsSub>('matches');
  const completed = useMemo(() => (t?.fixtures || [])
    .filter((f: any) => f?.status === 'finished')
    .sort((a: any, b: any) => +new Date(b.kickoff) - +new Date(a.kickoff)), [t]);
  const scorers: any[] = t?.topScorers || [];
  const assists: any[] = t?.topAssists || [];

  return (
    <div>
      <SubTabs<ResultsSub>
        active={sub} onChange={setSub}
        tabs={[
          { key: 'matches', label: 'Matches' },
          { key: 'groups', label: 'Groups' },
          { key: 'scorers', label: 'Top scorers' },
          { key: 'assists', label: 'Top assists' },
        ]} />

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

      {sub === 'scorers' && (
        <div className="card" style={{ padding: 16 }}>
          <strong style={{ fontSize: 15 }}>⚽ Top scorers</strong>
          {scorers.length ? scorers.slice(0, 20).map((p, i) => <PlayerStatRow key={i} p={p} unit="G" />) : <div className="faint" style={{ marginTop: 8 }}>No data yet.</div>}
        </div>
      )}

      {sub === 'assists' && (
        <div className="card" style={{ padding: 16 }}>
          <strong style={{ fontSize: 15 }}>🅰️ Top assists</strong>
          {assists.length ? assists.slice(0, 20).map((p, i) => <PlayerStatRow key={i} p={p} unit="A" />) : <div className="faint" style={{ marginTop: 8 }}>No data yet.</div>}
        </div>
      )}
    </div>
  );
}

export default function Bracket() {
  const { user } = useAuth();
  const nav = useNavigate();
  const isMobile = useIsMobile();
  const [t, setT] = useState<any>(null);
  const [tab, setTab] = useState<'results' | 'ko'>('ko');
  const [view, setView] = useState<'rounds' | 'whole'>('rounds');
  const [roundIdx, setRoundIdx] = useState(0);
  const [scores, setScores] = useState<Scores>({});
  const [winners, setWinners] = useState<Record<number, string>>({});
  const [manner, setManner] = useState<Record<number, 'FT' | 'ET' | 'PEN'>>({});
  const [scorePred, setScorePred] = useState<Record<number, { a: number | ''; b: number | '' }>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [eligible, setEligible] = useState(true);   // grand-prize eligibility (from /entry)
  const [freezeAck, setFreezeAck] = useState(false);  // user already accepted forfeiting this session
  const timer = useRef<any>(null);
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

  // Model Y: no global hard-lock. The bracket is editable; per-match cards lock
  // themselves once that match kicks off (via matchStatus → 'upcoming' gating).
  // Editing after the R16 kickoff is allowed but forfeits grand-prize eligibility
  // (enforced server-side; the warning UI lands in the design pass).
  const frozen = !!t?.bracketFrozenForPrize;
  const skipFirstSave = useRef(true);
  const predForShared = useMemo(() => { const o: any = {}; for (const g of Object.keys(scores)) o[g] = scores[g].map((s) => ({ sa: s.sa, sb: s.sb })); return o; }, [scores]);
  const r32 = useMemo(() => t ? resolveR32(t.base || {}, t.remaining || {}, predForShared) : {}, [t, predForShared]);
  const participants = useMemo(() => resolveBracketParticipants(r32 as any, winners), [r32, winners]);

  // Per-match live status, derived from the synced truth (results[] + fixtures[]).
  const fixturesByMatch = useMemo(() => {
    const map: Record<number, any> = {};
    for (const f of (t?.fixtures || [])) if (f?.matchNumber != null) map[f.matchNumber] = f;
    return map;
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
    // Skip the save that the initial load's setState would otherwise trigger — a
    // no-op write must never forfeit grand-prize eligibility once frozen.
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

  // Two-step soft-freeze guard: any mutating edit after R16 kickoff prompts once.
  // Confirm → optimistically drop eligibility (server flips it authoritatively on save);
  // cancel → abort the edit. No prompt when open, already ineligible, or already acked.
  async function guardEdit(): Promise<boolean> {
    if (!frozen || !eligible || freezeAck) return true;
    const ok = await confirmFreezeEdit();
    if (ok) { setFreezeAck(true); setEligible(false); }
    return ok;
  }
  const pick = async (m: number, team: string | null) => { if (!team) return; if (!(await guardEdit())) return; setWinners((w) => ({ ...w, [m]: team })); };
  const setScoreCell = async (m: number, side: 'a' | 'b', raw: string) => {
    if (!(await guardEdit())) return;
    const v = raw === '' ? '' : Math.max(0, +raw);
    setScorePred((s) => ({ ...s, [m]: { a: side === 'a' ? v : (s[m]?.a ?? ''), b: side === 'b' ? v : (s[m]?.b ?? '') } }));
  };
  const setMannerCell = async (m: number, mn: 'FT' | 'ET' | 'PEN') => { if (!(await guardEdit())) return; setManner((x) => ({ ...x, [m]: mn })); };
  const openExtras = async (m: number) => { if (!(await guardEdit())) return; setExpanded((x) => ({ ...x, [m]: true })); };

  const partOf = (m: number): { A: string | null; B: string | null } =>
    (ROUND_OF(m) === 'R32' ? r32[m] : participants[m]) || { A: null, B: null };

  // One match card — reused by both view modes (compact = tighter for the map).
  function renderMatchCard(m: number, compact = false) {
    const p = partOf(m); const round = ROUND_OF(m);
    const st = matchStatus(m);
    const oc = alignedOutcome(st.state, st.fx, st.res, p.A, p.B);
    const interactive = st.state === 'upcoming';
    const isR32 = round === 'R32';
    return (
      <div key={m} className="card" style={{ padding: compact ? 7 : 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, gap: 6 }}>
          <span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>{compact ? `M${m}` : `${RL[round] || 'R32'} · M${m}`}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {st.state === 'live' ? <StatusChip kind="live" /> : <StatusBadge state={st.state} />}
            {!compact && (isR32
              ? <span className="pill" style={{ fontSize: 9 }}>Bonus</span>
              : <span className="pill pill-gold" style={{ fontSize: 9 }}>+{ROUND_MULTIPLIER[round] * 100}</span>)}
          </span>
        </div>
        <TeamRow name={p.A} onClick={() => pick(m, p.A)} selected={winners[m] === p.A && !!p.A} interactive={interactive} outcome={oc?.A} />
        <TeamRow name={p.B} onClick={() => pick(m, p.B)} selected={winners[m] === p.B && !!p.B} interactive={interactive} outcome={oc?.B} />
        {st.state !== 'upcoming' && !oc && <ActualResultLine state={st.state} fx={st.fx} res={st.res} />}
        {!compact && !isR32 && st.state === 'upcoming' && winners[m] && (p.A || p.B) && (expanded[m] ? (
          <div style={{ display: 'grid', gap: 6, marginTop: 4, padding: 8, background: 'var(--surface2)', borderRadius: 10 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11 }}>🎯 Score</span>
              <input className="input tabular" style={{ width: 36, padding: 5, textAlign: 'center' }} value={scorePred[m]?.a ?? ''} onChange={(e) => setScoreCell(m, 'a', e.target.value)} />
              <span className="faint">–</span>
              <input className="input tabular" style={{ width: 36, padding: 5, textAlign: 'center' }} value={scorePred[m]?.b ?? ''} onChange={(e) => setScoreCell(m, 'b', e.target.value)} />
              <span className="pill pill-gold" style={{ fontSize: 9 }}>100৳</span>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 11 }}>⚖️</span>
              {(['FT', 'ET', 'PEN'] as const).map((mn) => <button key={mn} className="btn" onClick={() => setMannerCell(m, mn)} style={{ padding: '3px 7px', fontSize: 11, borderColor: manner[m] === mn ? 'var(--gold)' : undefined }}>{mn}</button>)}
            </div>
          </div>
        ) : (
          <button onClick={() => openExtras(m)} style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--green)', fontSize: 11, padding: '4px 0', fontWeight: 600 }}>
            🎯 Predict score → 100৳ · ⚖️ manner → bonus
          </button>
        ))}
      </div>
    );
  }

  // ROUNDS VIEW — one round at a time; swipe (mobile) or arrows (desktop).
  const rd = ROUND_DEFS[roundIdx];
  const go = (dir: -1 | 1) => setRoundIdx((i) => Math.min(ROUND_DEFS.length - 1, Math.max(0, i + dir)));
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
    touch.current = null;
  };
  const arrowBtn = (dir: -1 | 1, disabled: boolean) => (
    <button onClick={() => go(dir)} disabled={disabled} aria-label={dir < 0 ? 'Previous round' : 'Next round'}
      style={{ width: 38, height: 38, borderRadius: 11, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .35 : 1, flex: '0 0 auto', fontSize: 18, lineHeight: 1 }}>
      {dir < 0 ? '‹' : '›'}
    </button>
  );
  const RoundsView = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {!isMobile && arrowBtn(-1, roundIdx === 0)}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{rd.label}</div>
          <div className="faint" style={{ fontSize: 11.5, fontWeight: 600 }}>
            {rd.key === 'R32' ? 'Bonus round · tiebreaker points only' : `Round ${roundIdx + 1} of ${ROUND_DEFS.length}`}
            {isMobile && ' · swipe ‹ ›'}
          </div>
        </div>
        {!isMobile && arrowBtn(1, roundIdx === ROUND_DEFS.length - 1)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 14 }}>
        {ROUND_DEFS.map((r, i) => (
          <button key={r.key} onClick={() => setRoundIdx(i)} aria-label={r.label}
            style={{ width: i === roundIdx ? 22 : 8, height: 8, borderRadius: 999, border: 'none', cursor: 'pointer', background: i === roundIdx ? 'var(--green)' : 'var(--line)', transition: '.2s' }} />
        ))}
      </div>
      <div className="bb-round-track" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        style={{ display: 'grid', gridTemplateColumns: rd.matches.length === 1 ? 'minmax(0,340px)' : 'repeat(auto-fill,minmax(230px,1fr))', gap: 12, justifyContent: rd.matches.length <= 2 ? 'center' : undefined }}>
        {rd.matches.map((m) => renderMatchCard(m, false))}
      </div>
    </div>
  );

  // WHOLE BRACKET — two halves converging on a centered Final.
  const mapCol = (matches: number[], compact = true) => (
    <div className={`bb-map-col${compact ? ' compact' : ''}`}>{matches.map((m) => renderMatchCard(m, compact))}</div>
  );
  const champion = winners[104] || null;
  const WholeView = (
    <div className="bb-map-scroll">
      <div className="bb-map">
        {/* left half: R32 → R16 → QF → SF */}
        {[...LEFT_LEVELS].reverse().map((lvl, i) => <div key={'L' + i}>{mapCol(lvl)}</div>)}
        {/* center: Final + 3rd place */}
        <div className="bb-map-center">
          <div className="faint" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em' }}>FINAL</div>
          <div style={{ width: 178 }}>{renderMatchCard(104, false)}</div>
          <div style={{ textAlign: 'center', padding: '8px 10px', borderRadius: 12, background: 'var(--goldSoft)', border: '1px solid var(--goldLine)' }}>
            <div className="faint" style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.06em' }}>YOUR CHAMPION</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 4 }}>
              <Flag name={champion} size={22} /><strong style={{ fontSize: 15 }}>{champion || '—'}</strong>
            </div>
          </div>
          <div className="faint" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', marginTop: 4 }}>3RD PLACE</div>
          <div style={{ width: 178 }}>{renderMatchCard(103, false)}</div>
        </div>
        {/* right half: SF → QF → R16 → R32 */}
        {RIGHT_LEVELS.map((lvl, i) => <div key={'R' + i}>{mapCol(lvl)}</div>)}
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Bracket" subtitle="Fill the knockout tree — results update live" lockAt={t.lockAt}
        right={<div className="card" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg><span style={{ fontWeight: 600, fontSize: 14 }}>{saved ? 'Saved' : 'Saving…'}</span>
        </div>} />

      <NextMatchBanner nextMatch={t.nextMatch} />

      {frozen && (
        <div className="card" style={{ padding: '11px 14px', marginBottom: 14, borderColor: 'var(--goldLine)', background: 'var(--goldSoft)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
          {eligible ? <StatusChip kind="r16live" /> : <StatusChip kind="prizelocked" />}
          <span style={{ flex: 1, minWidth: 180 }}>
            {eligible
              ? 'The Round of 16 has kicked off — your bracket is set. Editing now forfeits grand-prize eligibility.'
              : 'You edited after the freeze — no longer eligible for the grand prize. Your picks still score points & cash.'}
          </span>
        </div>
      )}

      {/* My Picks / Results sub-tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => setTab('ko')} style={tab === 'ko' ? { background: 'var(--greenSoft)', color: 'var(--green)', borderColor: 'transparent' } : {}}>My Picks</button>
        <button className="btn" onClick={() => setTab('results')} style={tab === 'results' ? { background: 'var(--greenSoft)', color: 'var(--green)', borderColor: 'transparent' } : {}}>Results</button>
        {tab === 'ko' && (
          <div className="bb-viewtoggle" style={{ marginLeft: 'auto' }}>
            <button data-active={view === 'rounds'} onClick={() => setView('rounds')}>Rounds</button>
            <button data-active={view === 'whole'} onClick={() => setView('whole')}>Whole bracket</button>
          </div>
        )}
      </div>

      {tab === 'results' && <ResultsTab t={t} />}
      {tab === 'ko' && (view === 'rounds' ? RoundsView : WholeView)}

      <NextRoundStrip nextRound={t.nextRound} />
    </div>
  );
}
