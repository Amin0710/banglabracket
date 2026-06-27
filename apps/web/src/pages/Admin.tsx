import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KO_MATCHES, ROUND_OF } from '@banglabracket/shared';
import { api, flagUrl } from '../lib/api';
import { useAuth } from '../context/Providers';
import { PageHeader } from '../components/ui';

const RL: Record<string, string> = { R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', THIRD: 'Third place', FINAL: 'Final' };

export default function Admin() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [kpis, setKpis] = useState<any>(null);
  const [t, setT] = useState<any>(null);
  const [drafts, setDrafts] = useState<Record<number, any>>({});
  const [code, setCode] = useState(''); const [found, setFound] = useState<any>(null); const [msg, setMsg] = useState('');

  async function loadKpis() { try { setKpis(await api.get('/api/admin/kpis')); } catch {} }
  useEffect(() => { loadKpis(); api.get('/api/tournament').then(setT).catch(() => {}); }, []);
  if (!user || user.role !== 'admin') { nav('/overview'); return null; }

  const participants = t?.results || {};
  const confirmed = Object.keys(participants).filter((m) => participants[m]?.winner).length;

  async function confirm(m: number, A: string | null, B: string | null) {
    const d = drafts[m] || {};
    if (!d.winner) { alert('Pick a winner'); return; }
    try { await api.post('/api/admin/result', { match: m, winner: d.winner, manner: d.manner || 'FT', scoreA: +d.scoreA || 0, scoreB: +d.scoreB || 0 }); loadKpis(); api.get('/api/tournament').then(setT); }
    catch (e: any) { alert('Error: ' + e.message); }
  }
  async function lookup() { setFound(null); setMsg(''); try { setFound((await api.get('/api/admin/user-by-code/' + code.trim())).user); } catch { setMsg('No user with that code.'); } }
  async function setVerified(v: boolean, e: boolean) { if (!found) return; await api.post('/api/admin/verify-user', { userId: found.id, verified: v, prizeEligible: e }); setMsg('Updated'); lookup(); loadKpis(); }

  return (
    <div>
      <PageHeader title="Match console" subtitle="Staff — confirm knockout results" />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        {[['SIGNUPS', kpis?.totalUsers, 'var(--ink)'], ['VERIFIED', kpis?.verified, 'var(--green)'], ['ELIGIBLE', kpis?.prizeEligible, 'var(--gold)']].map(([l, v, c]) => (
          <div key={l as string} className="card" style={{ padding: 18, flex: 1, minWidth: 130 }}>
            <div className="tabular" style={{ fontSize: 28, fontWeight: 800, color: c as string }}>{(v ?? 0).toLocaleString?.() ?? v ?? 0}</div>
            <div className="faint" style={{ fontSize: 12, fontWeight: 700 }}>{l}</div>
          </div>
        ))}
      </div>
      {kpis?.cashConfig && <div className="card" style={{ padding: 14, marginBottom: 16, borderColor: 'var(--gold)' }}>💵 Cash committed: <strong className="tabular">{kpis.cashTotal}৳</strong> · {kpis.cashWinners} winners · {kpis.cashConfig.perCorrect}৳/correct, {kpis.cashConfig.slotsPerMatch} slots/match, {kpis.cashConfig.perPlayerCap}৳ cap</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
        <strong className="faint" style={{ fontSize: 12, letterSpacing: '.05em' }}>KNOCKOUT RESULTS</strong>
        <span className="faint" style={{ fontSize: 13 }}>{confirmed} / {KO_MATCHES.length} confirmed</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        {KO_MATCHES.map((m) => {
          const res = participants[m]; const d = drafts[m] || {};
          const set = (patch: any) => setDrafts((x) => ({ ...x, [m]: { ...x[m], ...patch } }));
          return (
            <div key={m} className="card" style={{ padding: 14, ...(res?.winner ? { borderColor: 'var(--green)' } : {}) }}>
              <div className="faint" style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>{RL[ROUND_OF(m)]} · M{m}{res?.winner ? ' ✓' : ''}</div>
              <input className="input" placeholder="Winner (exact team name)" value={d.winner ?? res?.winner ?? ''} onChange={(e) => set({ winner: e.target.value })} style={{ marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                {(['FT', 'ET', 'PEN'] as const).map((mn) => <button key={mn} className="btn" onClick={() => set({ manner: mn })} style={{ padding: '4px 9px', fontSize: 12, borderColor: (d.manner ?? res?.manner) === mn ? 'var(--gold)' : undefined }}>{mn}</button>)}
                <input className="input tabular" style={{ width: 42, padding: 6, textAlign: 'center', marginLeft: 'auto' }} placeholder="0" value={d.scoreA ?? res?.scoreA ?? ''} onChange={(e) => set({ scoreA: e.target.value })} />
                <span className="faint">–</span>
                <input className="input tabular" style={{ width: 42, padding: 6, textAlign: 'center' }} placeholder="0" value={d.scoreB ?? res?.scoreB ?? ''} onChange={(e) => set({ scoreB: e.target.value })} />
              </div>
              <button className="btn btn-primary" onClick={() => confirm(m, null, null)} style={{ width: '100%' }}>Confirm result</button>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <strong>Verify a user</strong>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input className="input" placeholder="VERIFY-XXXXX" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn" onClick={lookup}>Look up</button>
        </div>
        {found && (
          <div className="card" style={{ padding: 12, marginTop: 10, background: 'var(--surface2)' }}>
            <div>{found.name || '(no name)'} · {found.phone || found.email} · ID: {found.hasId ? 'yes' : 'no'} · {found.verified ? 'verified' : 'unverified'}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={() => setVerified(true, true)}>Mark verified + eligible</button>
              <button className="btn" onClick={() => setVerified(false, false)}>Revoke</button>
            </div>
          </div>
        )}
        {msg && <div className="muted" style={{ marginTop: 8 }}>{msg}</div>}
      </div>
    </div>
  );
}
