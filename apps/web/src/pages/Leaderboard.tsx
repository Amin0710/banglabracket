import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/Providers';
import { PageHeader } from '../components/ui';

function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flex: '0 0 auto' }} referrerPolicy="no-referrer" />;
  return <span style={{ width: size, height: size, borderRadius: '50%', background: 'var(--greenSoft)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flex: '0 0 auto' }}>{(name || 'P')[0].toUpperCase()}</span>;
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'points' | 'cash'>('points');
  const [rows, setRows] = useState<any[]>([]);
  const [cash, setCash] = useState<any[]>([]);
  const [eligibleOnly, setEligibleOnly] = useState(false);

  useEffect(() => { api.get('/api/cash-leaderboard').then((r) => setCash(r.rows || [])).catch(() => {}); }, []);
  useEffect(() => { api.get('/api/leaderboard' + (eligibleOnly ? '?eligible=1' : '')).then((r) => setRows(r.rows || [])); }, [eligibleOnly]);

  return (
    <div>
      <PageHeader title="Leaderboard" subtitle="Top predictors — updates after every match" />
      {user && !user.verified && (
        <div className="card" style={{ padding: 12, borderColor: 'var(--gold)', marginBottom: 14 }}>⚠️ You're playing, but not yet prize-eligible. <a href="#" onClick={(e) => { e.preventDefault(); location.hash = ''; }} style={{ color: 'var(--green)' }}>Verify your ID →</a></div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn" onClick={() => setTab('points')} style={tab === 'points' ? { background: 'var(--greenSoft)', color: 'var(--green)', borderColor: 'transparent' } : {}}>Points</button>
        <button className="btn" onClick={() => setTab('cash')} style={tab === 'cash' ? { background: 'var(--greenSoft)', color: 'var(--green)', borderColor: 'transparent' } : {}}>Cash winners 💵</button>
        {tab === 'points' && (
          <label style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }} className="muted">
            <input type="checkbox" checked={eligibleOnly} onChange={(e) => setEligibleOnly(e.target.checked)} /> Prize-eligible only
          </label>
        )}
      </div>

      {tab === 'points' ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: 'var(--faint)', letterSpacing: '.05em', borderBottom: '1px solid var(--line)' }}>
            <span style={{ width: 40 }}>RANK</span><span style={{ flex: 1 }}>PLAYER</span><span style={{ width: 80, textAlign: 'right' }}>MAIN</span><span style={{ width: 80, textAlign: 'right' }}>BONUS</span>
          </div>
          {rows.slice(0, 100).map((r) => {
            const me = r.userId === user?.id;
            const bonus = (r.tieManner || 0) + (r.tieEarlyBird || 0) + (r.tieExactFinal || 0);
            return (
              <div key={r.userId} style={{ display: 'flex', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid var(--line)', background: me ? 'var(--greenSoft)' : 'transparent' }}>
                <span style={{ width: 40 }}><span className="tabular" style={{ display: 'inline-flex', width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, background: r.rank <= 3 ? 'var(--gold)' : 'var(--surface2)', color: r.rank <= 3 ? '#1a1405' : 'var(--muted)' }}>{r.rank}</span></span>
                <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={r.name} src={r.avatar} size={30} />
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                  {me && <span className="pill pill-green" style={{ fontSize: 9 }}>YOU</span>}
                  {r.prizeEligible && <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--green)"><path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 14.8 7.2 16.6l.9-5.3L4.3 7.6l5.3-.8z" /></svg>}
                </span>
                <span className="tabular" style={{ width: 80, textAlign: 'right', fontWeight: 700 }}>{r.main.toLocaleString()}</span>
                <span className="tabular faint" style={{ width: 80, textAlign: 'right' }}>+{bonus}</span>
              </div>
            );
          })}
          {!rows.length && <div className="faint" style={{ padding: 20 }}>No players yet.</div>}
        </div>
      ) : (<>
        {/* Winners Wall */}
        <div style={{ marginBottom: 8, fontWeight: 700 }}>🏆 Winners Wall <span className="faint" style={{ fontWeight: 400 }}>players winning real Taka from exact scores</span></div>
        {cash.length === 0 ? (
          <div className="card muted" style={{ padding: 24, textAlign: 'center' }}>No cash winners yet — predict exact knockout scores to win 100৳ each.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
            {cash.map((w, i) => (
              <div key={w.userId} className="card" style={{ padding: 16, textAlign: 'center', ...(i === 0 ? { borderColor: 'var(--gold)' } : {}) }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Avatar name={w.name} src={w.avatar} size={56} /></div>
                <div style={{ fontWeight: 700 }}>{w.name}</div>
                <div className="tabular" style={{ fontSize: 22, fontWeight: 800, color: 'var(--bronze)' }}>{w.total}৳</div>
                <div className="faint" style={{ fontSize: 12 }}>{w.wins} correct {w.wins === 1 ? 'score' : 'scores'}</div>
              </div>
            ))}
          </div>
        )}
      </>)}
    </div>
  );
}
