import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui';

export default function Winners() {
  const nav = useNavigate();
  return (
    <div>
      <PageHeader title="Winners" subtitle="Top finishers when the final whistle blows" />

      <div className="card" style={{ padding: 36, textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🏆</div>
        <div style={{ fontWeight: 800, fontSize: 24, marginBottom: 8 }}>Tournament in progress</div>
        <p className="muted" style={{ fontSize: 15, lineHeight: 1.6, maxWidth: 440, margin: '0 auto 24px' }}>
          Winners will be announced here after the Final. The leaderboard is live — check your rank and see who's ahead.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => nav('/leaderboard')}>Live leaderboard →</button>
          <button className="btn" onClick={() => nav('/prizes')}>View prizes</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, opacity: 0.4 }}>
        {['Grand Prize', 'Runner-up', 'Third place'].map((label, i) => (
          <div key={i} className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>?</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>You?</div>
            <div className="muted" style={{ fontSize: 13, textAlign: 'center' }}>{label}</div>
            <div className="faint" style={{ fontSize: 12 }}>Announced after the Final</div>
          </div>
        ))}
      </div>
    </div>
  );
}
