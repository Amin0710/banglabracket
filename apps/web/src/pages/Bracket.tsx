import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GROUP_KEYS, R32_MATCHES, KO_MATCHES, ROUND_OF, ROUND_MULTIPLIER,
  resolveR32, resolveBracketParticipants, rankGroup,
} from '@banglabracket/shared';
import { api } from '../lib/api';
import { useAuth } from '../context/Providers';
import { PageHeader, Flag } from '../components/ui';

type Scores = Record<string, { sa: number | ''; sb: number | '' }[]>;
const RL: Record<string, string> = { R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', THIRD: 'Third place', FINAL: 'Final' };

function TeamRow({ name, onClick, selected, dim }: { name: string | null; onClick?: () => void; selected?: boolean; dim?: boolean }) {
  return (
    <button onClick={onClick} disabled={!name || !onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
        background: selected ? 'var(--greenSoft)' : 'transparent', color: 'var(--ink)',
        border: 'none', borderRadius: 9, padding: '8px 10px', cursor: onClick && name ? 'pointer' : 'default',
        opacity: dim ? 0.4 : 1, fontWeight: 600, fontSize: 14 }}>
      <Flag name={name} /><span style={{ flex: 1, textDecoration: dim ? 'line-through' : 'none' }}>{name || '—'}</span>
      {selected && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}
    </button>
  );
}

export default function Bracket() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [t, setT] = useState<any>(null);
  const [tab, setTab] = useState<'groups' | 'ko'>('groups');
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

  const locked = !!t?.locked;
  const predForShared = useMemo(() => { const o: any = {}; for (const g of Object.keys(scores)) o[g] = scores[g].map((s) => ({ sa: s.sa, sb: s.sb })); return o; }, [scores]);
  const r32 = useMemo(() => t ? resolveR32(t.base || {}, t.remaining || {}, predForShared) : {}, [t, predForShared]);
  const participants = useMemo(() => resolveBracketParticipants(r32 as any, winners), [r32, winners]);

  useEffect(() => {
    if (!loaded || !user || locked) return;
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
  }, [scores, winners, manner, scorePred, loaded, user, locked]);

  if (!t) return <div className="muted">Loading bracket…</div>;
  if (!user) { nav('/'); return null; }
  const pick = (m: number, team: string | null) => { if (team && !locked) setWinners((w) => ({ ...w, [m]: team })); };

  return (
    <div>
      <PageHeader title="Bracket" subtitle="Predict the groups, then fill the knockout tree" lockAt={t.lockAt}
        right={<div className="card" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          {locked ? <span className="pill pill-gold">Locked</span> : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg><span style={{ fontWeight: 600, fontSize: 14 }}>{saved ? 'Saved' : 'Saving…'}</span></>}
        </div>} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button className="btn" onClick={() => setTab('groups')} style={tab === 'groups' ? { background: 'var(--greenSoft)', color: 'var(--green)', borderColor: 'transparent' } : {}}>Group stage</button>
        <button className="btn" onClick={() => setTab('ko')} style={tab === 'ko' ? { background: 'var(--greenSoft)', color: 'var(--green)', borderColor: 'transparent' } : {}}>Knockout bracket</button>
      </div>

      {tab === 'groups' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 14 }}>
          {GROUP_KEYS.map((g) => {
            const rem = t.remaining?.[g] || [];
            const table = rankGroup(g, t.base || {}, t.remaining || {}, predForShared);
            const done = rem.length === 0;
            return (
              <div key={g} className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><strong>Group {g}</strong>{done && <span className="pill">Confirmed</span>}</div>
                <table style={{ width: '100%', fontSize: 13 }}><tbody>
                  {table.map((row, i) => (
                    <tr key={row.abbr} style={{ color: i < 2 ? 'var(--ink)' : i === 2 ? 'var(--bronze)' : 'var(--faint)' }}>
                      <td style={{ width: 16 }}>{i + 1}</td>
                      <td style={{ padding: '3px 0' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Flag name={row.name} size={20} />{row.name}</span></td>
                      <td className="tabular" style={{ textAlign: 'right', fontWeight: 700 }}>{row.W * 3 + row.D}</td>
                    </tr>
                  ))}
                </tbody></table>
                {rem.map((fx: [string, string], i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <span style={{ flex: 1, fontSize: 12 }}>{fx[0]}</span>
                    <input className="input tabular" style={{ width: 40, padding: 6, textAlign: 'center' }} disabled={locked} value={scores[g]?.[i]?.sa ?? ''} onChange={(e) => setScores((s) => { const c = { ...s }; c[g] = [...c[g]]; c[g][i] = { ...c[g][i], sa: e.target.value === '' ? '' : Math.max(0, +e.target.value) }; return c; })} />
                    <span className="faint">–</span>
                    <input className="input tabular" style={{ width: 40, padding: 6, textAlign: 'center' }} disabled={locked} value={scores[g]?.[i]?.sb ?? ''} onChange={(e) => setScores((s) => { const c = { ...s }; c[g] = [...c[g]]; c[g][i] = { ...c[g][i], sb: e.target.value === '' ? '' : Math.max(0, +e.target.value) }; return c; })} />
                    <span style={{ flex: 1, fontSize: 12, textAlign: 'right' }}>{fx[1]}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'ko' && (<>
        <div style={{ marginBottom: 8, fontWeight: 700, color: 'var(--green)', fontSize: 13 }}>BONUS ROUND · ROUND OF 32 <span className="faint" style={{ fontWeight: 400, textTransform: 'none' }}>early picks earn tiebreaker points only</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 10, marginBottom: 24 }}>
          {R32_MATCHES.map((m) => { const p = r32[m] || { A: null, B: null }; return (
            <div key={m} className="card" style={{ padding: 8 }}>
              <span className="faint" style={{ fontSize: 10, fontWeight: 700 }}>M{m}</span>
              <TeamRow name={p.A} onClick={() => pick(m, p.A)} selected={winners[m] === p.A && !!p.A} />
              <TeamRow name={p.B} onClick={() => pick(m, p.B)} selected={winners[m] === p.B && !!p.B} />
            </div>
          ); })}
        </div>

        <div style={{ marginBottom: 12, fontWeight: 700, fontSize: 15 }}>⭐ The bracket — where points live <span className="faint" style={{ fontWeight: 400 }}>tap a team to send it through</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 12 }}>
          {KO_MATCHES.map((m) => {
            const p = participants[m] || { A: null, B: null }; const round = ROUND_OF(m);
            return (
              <div key={m} className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="faint" style={{ fontSize: 11, fontWeight: 700 }}>{RL[round]} · M{m}</span>
                  <span className="pill pill-gold" style={{ fontSize: 10 }}>+{ROUND_MULTIPLIER[round] * 100}</span>
                </div>
                <TeamRow name={p.A} onClick={() => pick(m, p.A)} selected={winners[m] === p.A && !!p.A} />
                <TeamRow name={p.B} onClick={() => pick(m, p.B)} selected={winners[m] === p.B && !!p.B} />
                {winners[m] && (p.A || p.B) && (expanded[m] ? (
                  <div style={{ display: 'grid', gap: 6, marginTop: 4, padding: 8, background: 'var(--surface2)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 11 }}>🎯 Score</span>
                      <input className="input tabular" style={{ width: 36, padding: 5, textAlign: 'center' }} disabled={locked} value={scorePred[m]?.a ?? ''} onChange={(e) => setScorePred((s) => ({ ...s, [m]: { a: e.target.value === '' ? '' : Math.max(0, +e.target.value), b: s[m]?.b ?? '' } }))} />
                      <span className="faint">–</span>
                      <input className="input tabular" style={{ width: 36, padding: 5, textAlign: 'center' }} disabled={locked} value={scorePred[m]?.b ?? ''} onChange={(e) => setScorePred((s) => ({ ...s, [m]: { a: s[m]?.a ?? '', b: e.target.value === '' ? '' : Math.max(0, +e.target.value) } }))} />
                      <span className="pill pill-gold" style={{ fontSize: 9 }}>100৳</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 11 }}>⚖️</span>
                      {(['FT', 'ET', 'PEN'] as const).map((mn) => <button key={mn} className="btn" disabled={locked} onClick={() => setManner((x) => ({ ...x, [m]: mn }))} style={{ padding: '3px 7px', fontSize: 11, borderColor: manner[m] === mn ? 'var(--gold)' : undefined }}>{mn}</button>)}
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
    </div>
  );
}
