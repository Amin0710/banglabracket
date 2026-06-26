import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/Providers';

export default function Leaderboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/api/leaderboard' + (eligibleOnly ? '?eligible=1' : '')).then((r) => setRows(r.rows)).finally(() => setLoading(false));
  }, [eligibleOnly]);

  const mine = rows.find((r) => r.userId === user?.id);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {user && !user.verified && (
        <div className="card" style={{ padding: 12, borderColor: 'var(--gold)' }}>
          ⚠️ You’re playing, but not yet prize-eligible. <Link to="/verify" style={{ color: 'var(--gold)' }}>Verify your ID →</Link>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Leaderboard</h2>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }} className="muted">
          <input type="checkbox" checked={eligibleOnly} onChange={(e) => setEligibleOnly(e.target.checked)} /> Prize-eligible only
        </label>
      </div>

      <div className="card" style={{ padding: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead><tr className="faint" style={{ textAlign: 'left' }}>
            <th style={{ padding: 8 }}>#</th><th>Player</th><th style={{ textAlign: 'right' }}>Main</th><th style={{ textAlign: 'right' }}>Bonus</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="muted" style={{ padding: 12 }}>Loading…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={4} className="faint" style={{ padding: 12 }}>No players yet.</td></tr>
              : rows.slice(0, 100).map((r) => (
                <tr key={r.userId} style={{ borderTop: '1px solid var(--line)', background: r.userId === user?.id ? 'var(--bg2)' : undefined }}>
                  <td className="tabular" style={{ padding: 8 }}>{r.rank}</td>
                  <td>{r.name}{r.prizeEligible && <span className="pill pill-good" style={{ marginLeft: 6, fontSize: 9 }}>eligible</span>}</td>
                  <td className="tabular" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--gold)' }}>{r.main}</td>
                  <td className="tabular faint" style={{ textAlign: 'right' }}>{r.tieExactFinal + '·' + r.tieManner + '·' + r.tieEarlyBird}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {mine && <div className="card" style={{ padding: 12 }}>Your rank: <strong style={{ color: 'var(--gold)' }}>#{mine.rank}</strong> · {mine.main} main pts</div>}
    </div>
  );
}
