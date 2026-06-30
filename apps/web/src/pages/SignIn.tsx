import { useEffect, useState } from 'react';
import { api, API_BASE } from '../lib/api';
import { useAuth } from '../context/Providers';
import { LogoMark, ThemeToggle } from '../components/ui';
import { showLegal } from '../lib/feedback';

interface Props {
  onClose: () => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

// Live "next match" countdown — wired to the real /api/tournament nextMatch.
// Renders nothing when there's no upcoming match (rather than dead zeros).
function CountdownStrip({ nextMatch }: { nextMatch?: { kickoff?: string; label?: string } | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!nextMatch?.kickoff) return null;

  const diff = Math.max(0, new Date(nextMatch.kickoff).getTime() - now);
  const cells = [
    { v: Math.floor(diff / 86400000), label: 'Days' },
    { v: Math.floor(diff / 3600000) % 24, label: 'Hrs' },
    { v: Math.floor(diff / 60000) % 60, label: 'Min' },
    { v: Math.floor(diff / 1000) % 60, label: 'Sec' },
  ];
  const dateLine = new Date(nextMatch.kickoff).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="faint" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', display: 'inline-block', animation: 'bbGlow 1.6s infinite' }} />
        NEXT MATCH STARTS IN
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {cells.map((c) => (
          <div key={c.label} style={{
            background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 13,
            padding: '10px 4px', textAlign: 'center', boxShadow: '0 6px 16px rgba(0,0,0,.06)',
          }}>
            <div className="display tabular" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
              {pad2(c.v)}
            </div>
            <div className="faint" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 4 }}>
              {c.label}
            </div>
          </div>
        ))}
      </div>
      {(nextMatch.label || dateLine) && (
        <div className="muted" style={{ fontSize: 12.5, fontWeight: 600, textAlign: 'center' }}>
          {nextMatch.label ? `${nextMatch.label} · ${dateLine}` : dateLine}
        </div>
      )}
    </div>
  );
}

export default function LoginModal({ onClose }: Props) {
  const { user, refresh } = useAuth();
  const [t, setT] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'idle' | 'email' | 'code'>('idle');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/tournament').then(setT).catch(() => {});
  }, []);

  async function sendCode() {
    setBusy(true); setMsg('');
    try {
      const r = await api.post('/auth/email/request', { email });
      setStage('code');
      setMsg(r.delivered ? 'Code sent — check your email.' : 'Check the server console for your code (dev mode).');
    } catch (e: any) {
      setMsg('Could not send code: ' + (e.message || 'try again'));
    } finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setMsg('');
    try {
      await api.post('/auth/email/verify', { email, code });
      await refresh();
    } catch {
      setMsg('Invalid code.');
    } finally { setBusy(false); }
  }

  const isAdmin = user?.role === 'admin';
  const btnBase: React.CSSProperties = {
    minHeight: 54, borderRadius: 13, width: '100%', fontWeight: 700, fontSize: 15,
    cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 9, textDecoration: 'none', transition: '.15s',
  };
  const legalLink: React.CSSProperties = {
    background: 'none', border: 'none', padding: 0, color: 'var(--faint)',
    fontSize: 11, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit',
  };

  return (
    <div
      className="bb-signin-overlay"
      // No outside-click dismiss — accidental taps lose half-typed codes
    >
      <div className="bb-signin-panel">
        <div className="bb-signin-accent" />

        <div style={{
          padding: 'clamp(22px,5vw,30px)', display: 'grid', gap: 18,
          maxWidth: 420, margin: '0 auto', width: '100%',
        }}>
          {/* Top bar: logo left, theme toggle + close right */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <LogoMark size={36} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ThemeToggle />
              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  width: 34, height: 34, border: '1px solid var(--line)',
                  borderRadius: 10, background: 'var(--surface2)',
                  color: 'var(--ink)', cursor: 'pointer', fontSize: 20, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
                }}
              >×</button>
            </div>
          </div>

          {/* Pill badge */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em',
              padding: '5px 12px', borderRadius: 999, background: 'var(--surface2)',
              border: '1px solid var(--line)', color: 'var(--muted)',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
              World Cup 2026
            </span>
          </div>

          {/* Wordmark + tagline */}
          <div style={{ textAlign: 'center' }}>
            <div className="bb-wordmark">
              Bangla<span style={{ color: 'var(--goldText)' }}>Bracket</span>
            </div>
            <p className="muted" style={{ margin: '10px 0 0', fontSize: 13.5 }}>
              Brings World Cup 2026 to your hands
            </p>
          </div>

          {/* Grand prize — solid gold block */}
          <div style={{
            position: 'relative', overflow: 'hidden', borderRadius: 18, padding: 16,
            background: 'linear-gradient(150deg,#ffd76a,#f0a921)', color: '#231a05',
            boxShadow: '0 14px 30px rgba(255,176,30,.28)',
          }}>
            {/* subtle diagonal sheen */}
            <div style={{
              position: 'absolute', inset: 0, opacity: .5, pointerEvents: 'none',
              background: 'repeating-linear-gradient(135deg, rgba(255,255,255,.14) 0 2px, transparent 2px 16px)',
            }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  Entry Pass · 2026
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em' }}>FREE</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .72, marginTop: 14 }}>
                Grand Prize
              </div>
              <div className="display" style={{ fontWeight: 800, fontSize: 48, lineHeight: 1, marginTop: 2 }}>
                ৳1,00,000
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 12.5, opacity: .85 }}>
                Predict the bracket. Top the table. Win.
              </p>
            </div>
          </div>

          {/* Live countdown (hidden when no upcoming match) */}
          <CountdownStrip nextMatch={t?.nextMatch} />

          {/* Sign-in buttons */}
          <div style={{ display: 'grid', gap: 10 }}>
            <a href={API_BASE + '/auth/google'} style={{ ...btnBase, background: '#fff', color: '#1a1405', border: '1px solid var(--lineStrong)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
              </svg>
              Continue with Google
            </a>

            {stage === 'idle' && (
              <button
                onClick={() => setStage('email')}
                style={{ ...btnBase, background: 'var(--green)', color: '#fff', border: '1px solid var(--green)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
                </svg>
                Email code
              </button>
            )}

            {stage === 'email' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  placeholder="you@email.com"
                  type="email"
                  value={email}
                  autoFocus
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && email && !busy && sendCode()}
                />
                <button className="btn btn-primary" style={{ flex: '0 0 auto' }} onClick={sendCode} disabled={!email || busy}>Send</button>
              </div>
            )}

            {stage === 'code' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input tabular"
                  placeholder="6-digit code"
                  inputMode="numeric"
                  value={code}
                  autoFocus
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && code.length >= 4 && !busy && verify()}
                />
                <button className="btn btn-primary" style={{ flex: '0 0 auto' }} onClick={verify} disabled={code.length < 4 || busy}>Verify</button>
              </div>
            )}

            {msg && <div className="faint" style={{ fontSize: 13, textAlign: 'center' }}>{msg}</div>}
          </div>

          {/* Footer */}
          <div className="muted" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12.5 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Free to play · Your data is protected
          </div>

          <p style={{ fontSize: 11, textAlign: 'center', margin: 0, color: 'var(--faint)' }}>
            By playing you agree to our{' '}
            <button style={legalLink} onClick={() => showLegal('terms')}>Terms</button>
            {' · '}
            <button style={legalLink} onClick={() => showLegal('privacy')}>Privacy</button>
          </p>

          {isAdmin && (
            <div style={{ textAlign: 'center' }}>
              <a href="/admin" style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textDecoration: 'none' }}>
                Admin console →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
