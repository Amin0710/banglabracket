import { useNavigate } from 'react-router-dom';
import { LogoMark, Wordmark } from '../components/ui';

// Branded in-app 404 — the SPA catch-all route. (Vercel serves a matching static
// 404.html for unknown paths OUTSIDE the app; this handles unknown /wc2026/app/* routes.)
export default function NotFound() {
  const nav = useNavigate();
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 440, width: '100%', padding: 'clamp(24px,5vw,40px)', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, marginBottom: 20 }}>
          <LogoMark size={40} />
          <Wordmark />
        </div>
        <div className="display" style={{ fontWeight: 800, fontSize: 'clamp(52px,12vw,72px)', lineHeight: 1, color: 'var(--goldText)' }}>404</div>
        <h1 className="display" style={{ fontSize: 22, fontWeight: 800, margin: '10px 0 0' }}>Page not found</h1>
        <p className="muted" style={{ fontSize: 15, lineHeight: 1.6, margin: '10px 0 24px' }}>
          The page you're looking for doesn't exist or has moved. Let's get you back to the bracket.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-primary" style={{ width: '100%', minHeight: 48, fontSize: 15 }} onClick={() => nav('/bracket')}>
            Back to the app
          </button>
          <button className="btn" style={{ width: '100%', minHeight: 44, fontSize: 14 }} onClick={() => { window.location.href = '/'; }}>
            Go to banglabracket.com
          </button>
        </div>
      </div>
    </div>
  );
}
