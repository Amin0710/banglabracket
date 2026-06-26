import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GROUP_KEYS, R32_MATCHES, KO_MATCHES, MATCH_DEF, ROUND_OF, ROUND_MULTIPLIER,
  resolveR32, resolveBracketParticipants, rankGroup,
} from '@banglabracket/shared';
import { api, flagUrl } from '../lib/api';
import { useAuth } from '../context/Providers';
import { Countdown } from '../App';

type Scores = Record<string, { sa: number | ''; sb: number | '' }[]>;
type Winners = Record<number, string>;
type MannerMap = Record<number, 'FT' | 'ET' | 'PEN'>;

const ROUND_LABEL: Record<string, string> = { R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', THIRD: 'Third place', FINAL: 'Final' };

function Team({ name, onClick, selected, dim }: { name: string | null; onClick?: () => void; selected?: boolean; dim?: boolean }) {
  const f = flagUrl(name);
  return (
    <button onClick={onClick} disabled={!name || !onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
        background: selected ? 'var(--gold)' : 'var(--bg2)', color: selected ? '#1a1405' : 'var(--ink)',
        border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', cursor: onClick && name ? 'pointer' : 'default',
        opacity: dim ? 0.4 : 1, fontWeight: 600, fontSize: 14 }}>
      {f ? <img className="flag" src={f} alt="" /> : <span className="flag" style={{ background: 'var(--line)' }} />}
      <span style={{ textDecoration: dim ? 'line-through' : 'none' }}>{name || '—'}</span>
    </button>
  );
}

export default function Bracket() {
  const { user } = useAuth();
  const [t, setT] = useState<any>(null);
  const [scores, setScores] = useState<Scores>({});
  const [winners, setWinners] = useState<Winners>({});
  const [manner, setManner] = useState<MannerMap>({});
  const [scorePred, setScorePred] = useState<Record<number, { a: number | ''; b: number | '' }>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const tour = await api.get('/api/tournament');
      setT(tour);
      // init score arrays for groups with remaining fixtures
      const init: Scores = {};
      for (const g of GROUP_KEYS) {
        const rem = tour.remaining?.[g] || [];
        init[g] = rem.map(() => ({ sa: '' as const, sb: '' as const }));
      }
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

  // ---- resolve predicted R32 from current group predictions ----
  const predForShared = useMemo(() => {
    const out: Record<string, { sa: number | ''; sb: number | '' }[]> = {};
    for (const g of Object.keys(scores)) out[g] = scores[g].map((s) => ({ sa: s.sa, sb: s.sb }));
    return out;
  }, [scores]);

  const r32 = useMemo(() => t ? resolveR32(t.base || {}, t.remaining || {}, predForShared as any) : {}, [t, predForShared]);
  const participants = useMemo(() => resolveBracketParticipants(r32 as any, winners), [r32, winners]);

  // ---- autosave ----
  useEffect(() => {
    if (!loaded || !user || locked) return;
    setSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const groups: any = {};
      for (const g of GROUP_KEYS) {
        const rem = t.remaining?.[g] || [];
        const arr = (scores[g] || []).map((s, i) => rem[i] && s.sa !== '' && s.sb !== '' ? { a: rem[i][0], b: rem[i][1], sa: Number(s.sa), sb: Number(s.sb) } : null).filter(Boolean);
        if (arr.length) groups[g] = { scores: arr };
      }
      const payload: any = { groups, winners, manner };
      const sp: any = {};
      for (const m of Object.keys(scorePred)) {
        const v = scorePred[Number(m)];
        if (v && v.a !== '' && v.b !== '') sp[m] = { a: Number(v.a), b: Number(v.b) };
      }
      if (Object.keys(sp).length) payload.scorePredictions = sp;
      try { await api.put('/api/entry', payload); setSaved(true); } catch {}
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [scores, winners, manner, scorePred, loaded, user, locked]);

  if (!t) return <div className="muted" style={{ padding: 24 }}>Loading bracket…</div>;
  if (!user) return <div className="card" style={{ padding: 24, textAlign: 'center' }}>Please <Link to="/" style={{ color: 'var(--gold)' }}>sign in</Link> to make predictions.</div>;

  const pick = (m: number, team: string | null) => { if (team && !locked) setWinners((w) => ({ ...w, [m]: team })); };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* status bar */}
      <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 14, alignItems: 'center', position: 'sticky', top: 8, zIndex: 5 }}>
        <strong>{locked ? '🔒 Locked' : 'Editable'}</strong>
        {!locked && <span className="muted">{saved ? 'Saved ✓' : 'Saving…'}</span>}
        <span style={{ marginLeft: 'auto' }} className="muted">Locks in <Countdown to={t.lockAt} /></span>
      </div>

      {/* Step A: groups */}
      <section>
        <h2 style={{ margin: '0 0 6px' }}>1 · Complete the groups</h2>
        <p className="muted" style={{ marginTop: 0 }}>Predict the remaining results. Standings re-sort live and fill your Round of 32.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {GROUP_KEYS.map((g) => {
            const rem = t.remaining?.[g] || [];
            const table = rankGroup(g, t.base || {}, t.remaining || {}, predForShared as any);
            const done = rem.length === 0;
            return (
              <div key={g} className="card" style={{ padding: 12, opacity: done ? 0.85 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>Group {g}</strong>{done && <span className="pill">Confirmed</span>}
                </div>
                <table style={{ width: '100%', fontSize: 13, margin: '8px 0' }}>
                  <tbody>
                    {table.map((row, i) => (
                      <tr key={row.abbr} style={{ color: i < 2 ? 'var(--ink)' : i === 2 ? 'var(--bronze)' : 'var(--faint)' }}>
                        <td style={{ width: 18 }}>{i + 1}</td>
                        <td><img className="flag" src={flagUrl(row.name) || ''} alt="" style={{ marginRight: 6, verticalAlign: 'middle' }} />{row.name}</td>
                        <td className="tabular" style={{ textAlign: 'right' }}>{row.W * 3 + row.D}p</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rem.map((fx: [string, string], i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <span style={{ flex: 1, fontSize: 13 }}>{fx[0]}</span>
                    <input className="input tabular" style={{ width: 42, padding: 6, textAlign: 'center' }} disabled={locked}
                      value={scores[g]?.[i]?.sa ?? ''} onChange={(e) => setScores((s) => { const c = { ...s }; c[g] = [...c[g]]; c[g][i] = { ...c[g][i], sa: e.target.value === '' ? '' : Math.max(0, +e.target.value) }; return c; })} />
                    <span className="faint">–</span>
                    <input className="input tabular" style={{ width: 42, padding: 6, textAlign: 'center' }} disabled={locked}
                      value={scores[g]?.[i]?.sb ?? ''} onChange={(e) => setScores((s) => { const c = { ...s }; c[g] = [...c[g]]; c[g][i] = { ...c[g][i], sb: e.target.value === '' ? '' : Math.max(0, +e.target.value) }; return c; })} />
                    <span style={{ flex: 1, fontSize: 13, textAlign: 'right' }}>{fx[1]}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bonus round R32 */}
      <section>
        <h2 style={{ margin: '0 0 4px' }}>2 · Round of 32 <span className="pill" style={{ marginLeft: 8 }}>Bonus round</span></h2>
        <p className="muted" style={{ marginTop: 0 }}>Early picks earn tiebreaker points only — no main points here.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 10 }}>
          {R32_MATCHES.map((m) => {
            const p = r32[m] || { A: null, B: null };
            return (
              <div key={m} className="card" style={{ padding: 8, display: 'grid', gap: 6, opacity: 0.92 }}>
                <span className="faint" style={{ fontSize: 11 }}>Match {m}</span>
                <Team name={p.A} onClick={() => pick(m, p.A)} selected={winners[m] === p.A && !!p.A} />
                <Team name={p.B} onClick={() => pick(m, p.B)} selected={winners[m] === p.B && !!p.B} />
              </div>
            );
          })}
        </div>
      </section>

      {/* Main knockout tree */}
      <section>
        <h2 style={{ margin: '0 0 4px' }}>3 · The knockouts <span className="pill pill-gold" style={{ marginLeft: 8 }}>Main points</span></h2>
        <p className="muted" style={{ marginTop: 0 }}>R16 ×100 · QF ×200 · SF ×300 · 3rd ×400 · Final ×500.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 10 }}>
          {KO_MATCHES.map((m) => {
            const p = participants[m] || { A: null, B: null };
            const round = ROUND_OF(m);
            return (
              <div key={m} className="card" style={{ padding: 10, display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="faint" style={{ fontSize: 11 }}>{ROUND_LABEL[round]} · #{m}</span>
                  <span className="pill pill-gold" style={{ fontSize: 10 }}>×{ROUND_MULTIPLIER[round] * 100}</span>
                </div>
                <Team name={p.A} onClick={() => pick(m, p.A)} selected={winners[m] === p.A && !!p.A} />
                <Team name={p.B} onClick={() => pick(m, p.B)} selected={winners[m] === p.B && !!p.B} />

                {/* progressive disclosure: only after a winner is picked */}
                {winners[m] && (p.A || p.B) && (
                  expanded[m] ? (
                    <div style={{ display: 'grid', gap: 6, marginTop: 2, padding: 8, background: 'var(--bg2)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11 }}>🎯 Exact score</span>
                        <input className="input tabular" style={{ width: 38, padding: 5, textAlign: 'center' }} disabled={locked}
                          value={scorePred[m]?.a ?? ''} onChange={(e) => setScorePred((s) => ({ ...s, [m]: { a: e.target.value === '' ? '' : Math.max(0, +e.target.value), b: s[m]?.b ?? '' } }))} />
                        <span className="faint">–</span>
                        <input className="input tabular" style={{ width: 38, padding: 5, textAlign: 'center' }} disabled={locked}
                          value={scorePred[m]?.b ?? ''} onChange={(e) => setScorePred((s) => ({ ...s, [m]: { a: s[m]?.a ?? '', b: e.target.value === '' ? '' : Math.max(0, +e.target.value) } }))} />
                        <span className="pill pill-gold" style={{ fontSize: 9 }}>100৳</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 11 }}>⚖️</span>
                        {(['FT', 'ET', 'PEN'] as const).map((mn) => (
                          <button key={mn} className="btn" disabled={locked} onClick={() => setManner((x) => ({ ...x, [m]: mn }))}
                            style={{ padding: '3px 7px', fontSize: 11, borderColor: manner[m] === mn ? 'var(--gold)' : undefined }}>{mn}</button>
                        ))}
                        <span className="faint" style={{ fontSize: 10 }}>bonus pts</span>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setExpanded((x) => ({ ...x, [m]: true }))}
                      style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--gold)', fontSize: 11, padding: '2px 0' }}>
                      🎯 Predict exact score → win 100৳ · ⚖️ pick manner → bonus
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 12 }}>
        <Link to="/entry" className="btn btn-primary" style={{ textDecoration: 'none' }}>See my entry & score →</Link>
      </div>
    </div>
  );
}
