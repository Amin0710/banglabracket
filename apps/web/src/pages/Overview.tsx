import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KO_MATCHES } from '@banglabracket/shared';
import { api } from '../lib/api';
import { useAuth } from '../context/Providers';
import { PageHeader, Flag } from '../components/ui';

export default function Overview() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [t, setT] = useState<any>(null);
  const [entry, setEntry] = useState<any>(null);
  const [lb, setLb] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/tournament').then(setT).catch(() => {});
    api.get('/api/entry').then(setEntry).catch(() => setEntry({ entry: null }));
    api.get('/api/leaderboard').then((r) => setLb(r.rows || [])).catch(() => {});
  }, []);

  const myRank = lb.find((r) => r.userId === user?.id)?.rank;
  const score = entry?.score;
  const champion = entry?.entry?.prediction?.winners?.[104] || null;
  const koPicks = entry?.entry?.prediction?.winners ? Object.keys(entry.entry.prediction.winners).filter((m) => KO_MATCHES.includes(+m)).length : 0;

  const Stat = ({ label, value, sub, gold }: any) => (
    <div className="card" style={{ padding: 18, flex: 1, minWidth: 150, ...(gold ? { background: 'linear-gradient(160deg,#fff7e0,#fff)', borderColor: 'var(--gold)' } : {}) }}>
      <div className="faint" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em' }}>{label}</div>
      <div className="tabular" style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 13 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <PageHeader title="Overview" subtitle="Your tournament at a glance" lockAt={t?.lockAt} />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Stat label="LIVE RANK" value={myRank ? '#' + myRank : '—'} sub={lb.length ? `of ${lb.length} players` : ''} />
        <Stat label="PROJECTED POINTS" value={score ? (score.main).toLocaleString() : 0} sub={score ? `+${score.tieManner + score.tieEarlyBird + score.tieExactFinal} bonus` : ''} />
        <Stat label="KNOCKOUT PICKS" value={`${koPicks}/16`} sub="picks made" />
        <div className="card" style={{ padding: 18, flex: 1, minWidth: 150, background: 'linear-gradient(160deg,#fff7e0,#fff)', borderColor: 'var(--gold)' }}>
          <div className="faint" style={{ fontSize: 11, fontWeight: 700 }}>YOUR CHAMPION</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <Flag name={champion} /><strong style={{ fontSize: 18 }}>{champion || '—'}</strong>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{champion ? 'Lifts the trophy on your card' : 'Pick your winner'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 17 }}>Your bracket</strong>
            <span className="pill pill-green">{entry?.entry ? 'In progress' : 'Not started'}</span>
          </div>
          <button className="btn btn-primary" onClick={() => nav('/bracket')} style={{ width: '100%', marginTop: 16, padding: '13px' }}>Open the bracket →</button>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <strong style={{ fontSize: 17 }}>Top of the table</strong>
            <button onClick={() => nav('/leaderboard')} style={{ background: 'none', border: 'none', color: 'var(--green)', fontWeight: 600, cursor: 'pointer' }}>View all →</button>
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
    </div>
  );
}
