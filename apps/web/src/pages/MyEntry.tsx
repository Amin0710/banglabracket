import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUND_OF } from '@banglabracket/shared';
import { api } from '../lib/api';
import { useAuth } from '../context/Providers';

const ROUND_LABEL: Record<string, string> = { R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', THIRD: 'Third place', FINAL: 'Final' };

export default function MyEntry() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function load() { try { setData(await api.get('/api/entry')); } catch { setData({ entry: null }); } }
  useEffect(() => { load(); }, []);

  if (!user) return <div className="card" style={{ padding: 24 }}>Please <Link to="/" style={{ color: 'var(--gold)' }}>sign in</Link>.</div>;
  if (!data) return <div className="muted" style={{ padding: 24 }}>Loading…</div>;
  if (!data.entry) return <div className="card" style={{ padding: 24 }}>No entry yet. <Link to="/bracket" style={{ color: 'var(--gold)' }}>Fill your bracket →</Link></div>;

  const s = data.score;
  const correct = (s?.breakdown || []).filter((r: any) => r.correct);

  async function repick() {
    if (!confirm('Start fresh? This clears your picks AND your bonus points. You can only do this once.')) return;
    setBusy(true);
    try { await api.post('/api/entry/repick'); await load(); } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {!user.verified && (
        <div className="card" style={{ padding: 14, borderColor: 'var(--gold)' }}>
          ⚠️ Verify your ID before the 3rd-place match to be eligible for prizes. <Link to="/verify" style={{ color: 'var(--gold)' }}>Verify now →</Link>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="faint" style={{ fontSize: 12 }}>MAIN POINTS</div>
          <div className="tabular" style={{ fontSize: 36, fontWeight: 800, color: 'var(--gold)' }}>{s?.main ?? 0}</div>
          <div className="muted" style={{ fontSize: 13 }}>Correct winners × multiplier</div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div className="faint" style={{ fontSize: 12 }}>TIEBREAKER BONUS</div>
          <div className="tabular" style={{ fontSize: 22, fontWeight: 700 }}>
            <span title="exact final">🎯 {s?.tieExactFinal ?? 0}</span> ·
            <span title="manner"> ⚖️ {s?.tieManner ?? 0}</span> ·
            <span title="early R32"> 🐦 {s?.tieEarlyBird ?? 0}</span>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>Final · manner · early R32</div>
        </div>
        <div className="card" style={{ padding: 18, borderColor: (data.cash?.total ?? 0) > 0 ? 'var(--good)' : undefined }}>
          <div className="faint" style={{ fontSize: 12 }}>CASH WON 💵</div>
          <div className="tabular" style={{ fontSize: 36, fontWeight: 800, color: 'var(--good)' }}>{data.cash?.total ?? 0}৳</div>
          <div className="muted" style={{ fontSize: 13 }}>Exact-score prizes (paid after verification)</div>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Your verification code</strong>
          <code className="pill pill-gold" style={{ fontSize: 14 }}>{user.verificationCode}</code>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <strong>Correct picks ({correct.length})</strong>
        <table style={{ width: '100%', fontSize: 14, marginTop: 8 }}>
          <tbody>
            {correct.map((r: any) => (
              <tr key={r.match}><td className="muted">{ROUND_LABEL[ROUND_OF(r.match)]}</td><td>{r.predictedWinner}</td><td className="tabular" style={{ textAlign: 'right', color: 'var(--good)' }}>+{r.points}</td></tr>
            ))}
            {!correct.length && <tr><td className="faint">No results scored yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {!data.entry.rePicked && (
        <button className="btn" onClick={repick} disabled={busy} style={{ justifySelf: 'start' }}>
          Start fresh — free re-pick (clears your bonus points)
        </button>
      )}
    </div>
  );
}
