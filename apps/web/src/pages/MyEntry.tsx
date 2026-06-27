import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KO_MATCHES } from '@banglabracket/shared';
import { api } from '../lib/api';
import { useAuth } from '../context/Providers';
import { PageHeader, Flag } from '../components/ui';
import { toast, confirmDialog } from '../lib/feedback';

const RL: Record<string, string> = { R16: 'Round of 16', QF: 'Quarter-finals', SF: 'Semi-finals', THIRD: 'Third place', FINAL: 'Final' };
const MULT: Record<string, number> = { R16: 100, QF: 200, SF: 300, THIRD: 400, FINAL: 500 };

export default function MyEntry() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [t, setT] = useState<any>(null);
  const [lb, setLb] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() { try { setData(await api.get('/api/entry')); } catch { setData({ entry: null }); } }
  useEffect(() => {
    load();
    api.get('/api/tournament').then(setT).catch(() => {});
    api.get('/api/leaderboard').then((r) => setLb(r.rows || [])).catch(() => {});
  }, []);

  if (!user) return null;
  if (!data) return <div className="muted">Loading…</div>;
  if (!data.entry) return <div className="card" style={{ padding: 24 }}>No entry yet. <a onClick={() => nav('/bracket')} style={{ color: 'var(--green)', cursor: 'pointer' }}>Fill your bracket →</a></div>;

  const s = data.score;
  const correct = (s?.breakdown || []).filter((r: any) => r.correct);
  const byRound: Record<string, number> = {};
  correct.forEach((r: any) => { byRound[r.round] = (byRound[r.round] || 0) + 1; });

  const myRank = lb.find((r) => r.userId === user.id)?.rank;
  const champion = data.entry?.prediction?.winners?.[104] || null;
  const koPicks = data.entry?.prediction?.winners
    ? Object.keys(data.entry.prediction.winners).filter((m) => KO_MATCHES.includes(+m)).length
    : 0;

  async function repick() {
    const ok = await confirmDialog({ title: 'Start fresh?', message: 'This clears your picks and all bonus points. You can only do this once.', confirmText: 'Yes, reset', danger: true });
    if (!ok) return;
    setBusy(true); try { await api.post('/api/entry/repick'); await load(); toast('Bracket reset — pick again'); } finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="My Entry" subtitle="Your picks and points, projected live" lockAt={t?.lockAt} />
      {!user.verified && (
        <div className="card" style={{ padding: 14, borderColor: 'var(--gold)', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          ⚠️ Verify your ID before the 3rd-place match to be eligible for prizes. <a onClick={() => nav('/verify')} style={{ color: 'var(--green)', cursor: 'pointer', fontWeight: 600 }}>Verify now →</a>
        </div>
      )}

      {/* Overview stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="card" style={{ padding: 18, flex: 1, minWidth: 140 }}>
          <div className="faint" style={{ fontSize: 11, fontWeight: 700 }}>LIVE RANK</div>
          <div className="tabular" style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{myRank ? '#' + myRank : '—'}</div>
          <div className="muted" style={{ fontSize: 13 }}>{lb.length ? `of ${lb.length} players` : ''}</div>
        </div>
        <div className="card" style={{ padding: 18, flex: 1, minWidth: 140 }}>
          <div className="faint" style={{ fontSize: 11, fontWeight: 700 }}>PROJECTED POINTS</div>
          <div className="tabular" style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{s ? s.main.toLocaleString() : 0}</div>
          <div className="muted" style={{ fontSize: 13 }}>{s ? `+${s.tieManner + s.tieEarlyBird + s.tieExactFinal} bonus` : ''}</div>
        </div>
        <div className="card" style={{ padding: 18, flex: 1, minWidth: 140 }}>
          <div className="faint" style={{ fontSize: 11, fontWeight: 700 }}>KNOCKOUT PICKS</div>
          <div className="tabular" style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{koPicks}/16</div>
          <div className="muted" style={{ fontSize: 13 }}>picks made</div>
        </div>
        <div className="card" style={{ padding: 18, flex: 1, minWidth: 140, background: 'linear-gradient(160deg,#fff7e0,#fff)', borderColor: 'var(--gold)' }}>
          <div className="faint" style={{ fontSize: 11, fontWeight: 700 }}>YOUR CHAMPION</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <Flag name={champion} /><strong style={{ fontSize: 18 }}>{champion || '—'}</strong>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{champion ? 'Lifts the trophy on your card' : 'Pick your winner'}</div>
        </div>
      </div>

      {/* Points breakdown cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div className="card" style={{ padding: 18, flex: 1, minWidth: 150 }}>
          <div className="faint" style={{ fontSize: 11, fontWeight: 700 }}>MAIN POINTS</div>
          <div className="tabular" style={{ fontSize: 34, fontWeight: 800, color: 'var(--green)' }}>{s?.main?.toLocaleString() ?? 0}</div>
          <div className="muted" style={{ fontSize: 13 }}>correct winners</div>
        </div>
        <div className="card" style={{ padding: 18, flex: 1, minWidth: 150, background: 'var(--greenSoft)' }}>
          <div className="faint" style={{ fontSize: 11, fontWeight: 700 }}>TIEBREAKER BONUS</div>
          <div className="tabular" style={{ fontSize: 34, fontWeight: 800 }}>{(s?.tieManner ?? 0) + (s?.tieEarlyBird ?? 0) + (s?.tieExactFinal ?? 0)}</div>
          <div className="muted" style={{ fontSize: 13 }}>tie-breakers only</div>
        </div>
        <div className="card" style={{ padding: 18, flex: 1, minWidth: 150, borderColor: (data.cash?.total ?? 0) > 0 ? 'var(--gold)' : undefined }}>
          <div className="faint" style={{ fontSize: 11, fontWeight: 700 }}>CASH WON 💵</div>
          <div className="tabular" style={{ fontSize: 34, fontWeight: 800, color: 'var(--bronze)' }}>{data.cash?.total ?? 0}৳</div>
          <div className="muted" style={{ fontSize: 13 }}>exact scores · paid after verify</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="dot-live" style={{ background: 'var(--green)' }} /> MAIN POINTS</strong>
          <table style={{ width: '100%', fontSize: 14, marginTop: 10 }}><tbody>
            {(['R16', 'QF', 'SF', 'THIRD', 'FINAL'] as const).map((rd) => (
              <tr key={rd} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '9px 0' }}>{RL[rd]}</td>
                <td className="faint" style={{ textAlign: 'right', fontSize: 12 }}>{byRound[rd] || 0} × {MULT[rd]}</td>
                <td className="tabular" style={{ textAlign: 'right', fontWeight: 700, paddingLeft: 12 }}>{(byRound[rd] || 0) * MULT[rd]}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="dot-live" style={{ background: 'var(--gold)' }} /> TIEBREAKER BONUS</strong>
          <table style={{ width: '100%', fontSize: 14, marginTop: 10 }}><tbody>
            <tr style={{ borderTop: '1px solid var(--line)' }}><td style={{ padding: '9px 0' }}>Manner of advance</td><td className="tabular" style={{ textAlign: 'right', fontWeight: 700 }}>{s?.tieManner ?? 0}</td></tr>
            <tr style={{ borderTop: '1px solid var(--line)' }}><td style={{ padding: '9px 0' }}>Exact final score</td><td className="tabular" style={{ textAlign: 'right', fontWeight: 700 }}>{s?.tieExactFinal ?? 0}</td></tr>
            <tr style={{ borderTop: '1px solid var(--line)' }}><td style={{ padding: '9px 0' }}>Early R32 picks</td><td className="tabular" style={{ textAlign: 'right', fontWeight: 700 }}>{s?.tieEarlyBird ?? 0}</td></tr>
          </tbody></table>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <strong style={{ fontSize: 15 }}>Top of the table</strong>
            <button onClick={() => nav('/leaderboard')} style={{ background: 'none', border: 'none', color: 'var(--green)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>View all →</button>
          </div>
          {lb.slice(0, 5).map((r) => (
            <div key={r.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--line)' }}>
              <span className="tabular faint" style={{ width: 20 }}>{r.rank}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{r.name}</span>
              <span className="tabular" style={{ fontWeight: 700 }}>{r.main.toLocaleString()}</span>
            </div>
          ))}
          {!lb.length && <div className="faint">No players yet.</div>}
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <span>Your verification code</span>
        <code className="pill pill-gold" style={{ fontSize: 15 }}>{user.verificationCode}</code>
      </div>

      {!data.entry.rePicked && (
        <button className="btn" onClick={repick} disabled={busy} style={{ marginTop: 16 }}>Start fresh — free re-pick (clears bonus points)</button>
      )}
    </div>
  );
}
