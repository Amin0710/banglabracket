import { useEffect, useState } from 'react';
import { KO_MATCHES, MATCH_DEF, ROUND_OF } from '@banglabracket/shared';
import { api } from '../lib/api';
import { useAuth } from '../context/Providers';

const ROUND_LABEL: Record<string, string> = { R32: 'R32', R16: 'R16', QF: 'QF', SF: 'SF', THIRD: '3rd', FINAL: 'Final' };

export default function Admin() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<any>(null);
  const [match, setMatch] = useState(89);
  const [winner, setWinner] = useState('');
  const [manner, setManner] = useState<'FT' | 'ET' | 'PEN'>('FT');
  const [sa, setSa] = useState(0); const [sb, setSb] = useState(0);
  const [code, setCode] = useState(''); const [found, setFound] = useState<any>(null);
  const [msg, setMsg] = useState('');

  async function loadKpis() { try { setKpis(await api.get('/api/admin/kpis')); } catch {} }
  useEffect(() => { loadKpis(); }, []);

  if (!user || user.role !== 'admin') return <div className="card" style={{ padding: 24 }}>Admin only. Add your email to <code>ADMIN_EMAILS</code> on the API.</div>;

  async function confirmResult() {
    setMsg('');
    try { await api.post('/api/admin/result', { match: Number(match), winner, manner, scoreA: Number(sa), scoreB: Number(sb) }); setMsg('✓ Result confirmed for match ' + match); loadKpis(); }
    catch (e: any) { setMsg('Error: ' + e.message); }
  }
  async function lookup() {
    setFound(null); setMsg('');
    try { const r = await api.get('/api/admin/user-by-code/' + code.trim()); setFound(r.user); }
    catch { setMsg('No user with that code.'); }
  }
  async function setVerified(verified: boolean, eligible: boolean) {
    if (!found) return;
    await api.post('/api/admin/verify-user', { userId: found.id, verified, prizeEligible: eligible });
    setMsg('Updated ' + found.name); lookup(); loadKpis();
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>Admin</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[['Signups', kpis?.totalUsers], ['Verified', kpis?.verified], ['Eligible', kpis?.prizeEligible], ['Entries', kpis?.entries]].map(([l, v]) => (
          <div key={l as string} className="card" style={{ padding: 14 }}><div className="faint" style={{ fontSize: 12 }}>{l}</div><div className="tabular" style={{ fontSize: 26, fontWeight: 800 }}>{v ?? '—'}</div></div>
        ))}
      </div>
      {kpis?.cashConfig && (
        <div className="card" style={{ padding: 14, borderColor: 'var(--good)' }}>
          <div className="faint" style={{ fontSize: 12 }}>EXACT-SCORE CASH SIDE-GAME 💵</div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', marginTop: 4, flexWrap: 'wrap' }}>
            <div><span className="tabular" style={{ fontSize: 26, fontWeight: 800, color: 'var(--good)' }}>{kpis.cashTotal}৳</span> <span className="muted">committed</span></div>
            <div className="muted">{kpis.cashWinners} winners</div>
            <div className="faint" style={{ fontSize: 12 }}>{kpis.cashConfig.perCorrect}৳/correct · {kpis.cashConfig.slotsPerMatch} slots/match · {kpis.cashConfig.perPlayerCap}৳/player cap</div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <strong>Confirm knockout result</strong>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="input" style={{ width: 'auto' }} value={match} onChange={(e) => setMatch(+e.target.value)}>
            {KO_MATCHES.map((m) => <option key={m} value={m}>#{m} · {ROUND_LABEL[ROUND_OF(m)]}</option>)}
          </select>
          <input className="input" style={{ width: 200 }} placeholder="Winner (exact team name)" value={winner} onChange={(e) => setWinner(e.target.value)} />
          <select className="input" style={{ width: 'auto' }} value={manner} onChange={(e) => setManner(e.target.value as any)}><option>FT</option><option>ET</option><option>PEN</option></select>
          <input className="input tabular" style={{ width: 50 }} type="number" value={sa} onChange={(e) => setSa(+e.target.value)} />
          <input className="input tabular" style={{ width: 50 }} type="number" value={sb} onChange={(e) => setSb(+e.target.value)} />
          <button className="btn btn-primary" onClick={confirmResult} disabled={!winner}>Confirm</button>
        </div>
        <p className="faint" style={{ margin: 0, fontSize: 12 }}>Winner must match the team name exactly (e.g. “Brazil”, “IR Iran”). This recomputes the leaderboard.</p>
      </div>

      <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <strong>Verify a user</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder="VERIFY-XXXXX" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn" onClick={lookup}>Look up</button>
        </div>
        {found && (
          <div className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
            <div>{found.name || '(no name)'} · {found.phone || found.email} · ID on file: {found.hasId ? 'yes' : 'no'}</div>
            <div>Status: {found.verified ? 'verified' : 'unverified'} · {found.prizeEligible ? 'eligible' : 'not eligible'}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => setVerified(true, true)}>Mark verified + eligible</button>
              <button className="btn" onClick={() => setVerified(false, false)}>Revoke</button>
            </div>
          </div>
        )}
      </div>
      {msg && <div className="muted">{msg}</div>}
    </div>
  );
}
