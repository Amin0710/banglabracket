import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GROUP_KEYS, R32_MATCHES, KO_MATCHES, ROUND_OF, ROUND_MULTIPLIER,
  resolveR32, resolveBracketParticipants, rankGroup, formatCompletedMatch,
} from '@banglabracket/shared';
import { api } from '../lib/api';
import { useAuth } from '../context/Providers';
import { PageHeader, Flag, NextMatchBanner, NextRoundStrip } from '../components/ui';

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

// Compact line showing the ACTUAL match when it differs from the user's predicted pair.
function ActualResultLine({ state, fx, res }: { state: MatchState; fx: any; res: any }) {
  if (!fx) return null;
  const decided = state === 'decided';
  const sa = decided ? res?.scoreA : fx.scoreA, sb = decided ? res?.scoreB : fx.scoreB;
  const winner = decided ? res?.winner : null;
  const mannerTag = decided && res?.manner && res.manner !== 'FT' ? (res.manner === 'PEN' ? ' (pens)' : ' (a.e.t.)') : '';
  return (
    <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 8, background: 'var(--surface2)', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <StatusBadge state={state} />
      <span style={{ fontWeight: winner === fx.teamA ? 800 : 600 }}>{fx.teamA}</span>
      <span className="tabular" style={{ fontWeight: 800 }}>{sa ?? 0}–{sb ?? 0}{mannerTag}</span>
      <span style={{ fontWeight: winner === fx.teamB ? 800 : 600 }}>{fx.teamB}</span>
    </div>
  );
}

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

function CompletedMatchRow({ fx }: { fx: any }) {
  const f = formatCompletedMatch({ manner: fx.manner, scoreA: fx.scoreA, scoreB: fx.scoreB, ftA: fx.ftA, ftB: fx.ftB, penA: fx.penA, penB: fx.penB });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 13 }}>
      <span className="faint" style={{ width: 64, fontSize: 11, fontWeight: 700 }}>{f.statusLabel}</span>
      <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', fontWeight: fx.winner === fx.teamA ? 800 : 600 }}>{fx.teamA}<Flag name={fx.teamA} size={20} /></span>
      <span className="tabular" style={{ fontWeight: 800, minWidth: 56, textAlign: 'center' }}>{f.scoreA}–{f.scoreB}</span>
      <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontWeight: fx.winner === fx.teamB ? 800 : 600 }}><Flag name={fx.teamB} size={20} />{fx.teamB}</span>
      {f.pens && <span className="faint" style={{ fontSize: 11 }}>pens {f.pens}</span>}
    </div>
  );
}

function ResultsTab({ t }: { t: any }) {
  const completed = useMemo(() => (t?.fixtures || [])
    .filter((f: any) => f?.status === 'finished')
    .sort((a: any, b: any) => +new Date(b.kickoff) - +new Date(a.kickoff)), [t]);
  const scorers: any[] = t?.topScorers || [];
  const assists: any[] = t?.topAssists || [];

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Completed matches */}
      <div className="card" style={{ padding: 16 }}>
        <strong style={{ fontSize: 15 }}>Completed matches</strong>
        {completed.length
          ? completed.map((fx: any, i: number) => <CompletedMatchRow key={fx.providerId ?? i} fx={fx} />)
          : <div className="faint" style={{ marginTop: 8 }}>No completed matches yet.</div>}
      </div>

      {/* Group-stage standings (actual) */}
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

      {/* Top scorers + assists */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
        <div className="card" style={{ padding: 16 }}>
          <strong style={{ fontSize: 15 }}>⚽ Top scorers</strong>
          {scorers.length ? scorers.slice(0, 10).map((p, i) => <PlayerStatRow key={i} p={p} unit="G" />) : <div className="faint" style={{ marginTop: 8 }}>No data yet.</div>}
        </div>
        <div className="card" style={{ padding: 16 }}>
          <strong style={{ fontSize: 15 }}>🅰️ Top assists</strong>
          {assists.length ? assists.slice(0, 10).map((p, i) => <PlayerStatRow key={i} p={p} unit="A" />) : <div className="faint" style={{ marginTop: 8 }}>No data yet.</div>}
        </div>
      </div>
    </div>
  );
}

export default function Bracket() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [t, setT] = useState<any>(null);
  const [tab, setTab] = useState<'results' | 'ko'>('ko');
  const [scores, setScores] = useState<Scores>({});
  const [winners, setWinners] = useState<Record<number, string>>({});
  const [manner, setManner] = useState<Record<number, 'FT' | 'ET' | 'PEN'>>({});
  const [scorePred, setScorePred] = useState<Record<number, { a: number | ''; b: number | '' }>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<any>(null);

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
      try { await api.put('/api/entry', payload); setSaved(true); } catch {}
    }, 800);
    return () => clearTimeout(timer.current);
  }, [scores, winners, manner, scorePred, loaded, user]);

  if (!t) return <div className="muted">Loading bracket…</div>;
  if (!user) { nav('/'); return null; }
  const pick = (m: number, team: string | null) => { if (team) setWinners((w) => ({ ...w, [m]: team })); };

  return (
    <div>
      <PageHeader title="Bracket" subtitle="Fill the knockout tree — results update live" lockAt={t.lockAt}
        right={<div className="card" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg><span style={{ fontWeight: 600, fontSize: 14 }}>{saved ? 'Saved' : 'Saving…'}</span>
        </div>} />

      <NextMatchBanner nextMatch={t.nextMatch} />

      {frozen && (
        <div className="card" style={{ padding: '10px 14px', marginBottom: 14, borderColor: 'var(--gold)', fontSize: 13 }}>
          ⚠️ The Round of 16 has kicked off — your bracket is set for the grand prize. Editing now keeps your picks live but forfeits grand-prize eligibility.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button className="btn" onClick={() => setTab('ko')} style={tab === 'ko' ? { background: 'var(--greenSoft)', color: 'var(--green)', borderColor: 'transparent' } : {}}>Knockout bracket</button>
        <button className="btn" onClick={() => setTab('results')} style={tab === 'results' ? { background: 'var(--greenSoft)', color: 'var(--green)', borderColor: 'transparent' } : {}}>Results</button>
      </div>

      {tab === 'results' && <ResultsTab t={t} />}

      {tab === 'ko' && (<>
        <div style={{ marginBottom: 8, fontWeight: 700, color: 'var(--green)', fontSize: 13 }}>BONUS ROUND · ROUND OF 32 <span className="faint" style={{ fontWeight: 400, textTransform: 'none' }}>early picks earn tiebreaker points only</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 10, marginBottom: 24 }}>
          {R32_MATCHES.map((m) => {
            const p = r32[m] || { A: null, B: null };
            const st = matchStatus(m);
            const oc = alignedOutcome(st.state, st.fx, st.res, p.A, p.B);
            const interactive = st.state === 'upcoming';
            return (
            <div key={m} className="card" style={{ padding: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>M{m}</span>
                <StatusBadge state={st.state} />
              </div>
              <TeamRow name={p.A} onClick={() => pick(m, p.A)} selected={winners[m] === p.A && !!p.A} interactive={interactive} outcome={oc?.A} />
              <TeamRow name={p.B} onClick={() => pick(m, p.B)} selected={winners[m] === p.B && !!p.B} interactive={interactive} outcome={oc?.B} />
              {st.state !== 'upcoming' && !oc && <ActualResultLine state={st.state} fx={st.fx} res={st.res} />}
            </div>
          ); })}
        </div>

        <div style={{ marginBottom: 12, fontWeight: 700, fontSize: 15 }}>⭐ The bracket — where points live <span className="faint" style={{ fontWeight: 400 }}>tap a team to send it through</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 12 }}>
          {KO_MATCHES.map((m) => {
            const p = participants[m] || { A: null, B: null }; const round = ROUND_OF(m);
            const st = matchStatus(m);
            const oc = alignedOutcome(st.state, st.fx, st.res, p.A, p.B);
            const interactive = st.state === 'upcoming';
            return (
              <div key={m} className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span className="faint" style={{ fontSize: 11, fontWeight: 700 }}>{RL[round]} · M{m}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <StatusBadge state={st.state} />
                    <span className="pill pill-gold" style={{ fontSize: 10 }}>+{ROUND_MULTIPLIER[round] * 100}</span>
                  </span>
                </div>
                <TeamRow name={p.A} onClick={() => pick(m, p.A)} selected={winners[m] === p.A && !!p.A} interactive={interactive} outcome={oc?.A} />
                <TeamRow name={p.B} onClick={() => pick(m, p.B)} selected={winners[m] === p.B && !!p.B} interactive={interactive} outcome={oc?.B} />
                {st.state !== 'upcoming' && !oc && <ActualResultLine state={st.state} fx={st.fx} res={st.res} />}
                {st.state === 'upcoming' && winners[m] && (p.A || p.B) && (expanded[m] ? (
                  <div style={{ display: 'grid', gap: 6, marginTop: 4, padding: 8, background: 'var(--surface2)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 11 }}>🎯 Score</span>
                      <input className="input tabular" style={{ width: 36, padding: 5, textAlign: 'center' }} value={scorePred[m]?.a ?? ''} onChange={(e) => setScorePred((s) => ({ ...s, [m]: { a: e.target.value === '' ? '' : Math.max(0, +e.target.value), b: s[m]?.b ?? '' } }))} />
                      <span className="faint">–</span>
                      <input className="input tabular" style={{ width: 36, padding: 5, textAlign: 'center' }} value={scorePred[m]?.b ?? ''} onChange={(e) => setScorePred((s) => ({ ...s, [m]: { a: s[m]?.a ?? '', b: e.target.value === '' ? '' : Math.max(0, +e.target.value) } }))} />
                      <span className="pill pill-gold" style={{ fontSize: 9 }}>100৳</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 11 }}>⚖️</span>
                      {(['FT', 'ET', 'PEN'] as const).map((mn) => <button key={mn} className="btn" onClick={() => setManner((x) => ({ ...x, [m]: mn }))} style={{ padding: '3px 7px', fontSize: 11, borderColor: manner[m] === mn ? 'var(--gold)' : undefined }}>{mn}</button>)}
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setExpanded((x) => ({ ...x, [m]: true }))} style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--green)', fontSize: 11, padding: '4px 0', fontWeight: 600 }}>
                    🎯 Predict score → 100৳ · ⚖️ manner → bonus
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </>)}

      <NextRoundStrip nextRound={t.nextRound} />
    </div>
  );
}
