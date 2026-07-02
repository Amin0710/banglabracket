import { PageHeader } from '../components/ui';

// Fantasy is a LOCKED placeholder for now — visible in the nav, disabled, and it
// explains the unlock trigger. No fantasy logic yet; this reserves the space + wires
// the lock. It opens once the semi-final teams are set.
export default function Fantasy() {
  return (
    <div>
      <PageHeader title="Fantasy" subtitle="A new way to play, coming later in the tournament" />
      <div className="card" style={{ padding: 36, textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto 18px', background: 'var(--surface2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 018 0v3" />
          </svg>
        </div>
        <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 8 }}>Fantasy is locked</div>
        <p className="muted" style={{ fontSize: 15, lineHeight: 1.6, maxWidth: 380, margin: '0 auto' }}>
          Opens when the <strong>semi-final teams are set</strong>. Check back once the quarter-finals are done — you'll build a fantasy lineup from the final four.
        </p>
        <span className="pill" style={{ marginTop: 20, display: 'inline-flex', gap: 6, fontSize: 12 }}>🔒 Coming soon</span>
      </div>
    </div>
  );
}
