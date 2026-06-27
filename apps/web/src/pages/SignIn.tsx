import { useEffect, useState } from 'react';
import { api, API_BASE } from '../lib/api';
import { useAuth } from '../context/Providers';
import { LogoMark, Wordmark, Countdown } from '../components/ui';
import { showLegal } from '../lib/feedback';

interface Props {
  onClose: () => void;
  onPhoneSignup: () => void;
}

export default function LoginModal({ onClose, onPhoneSignup }: Props) {
  const { refresh } = useAuth();
  const [t, setT] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'idle' | 'code'>('idle');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/tournament').then(setT).catch(() => {});
    api.get('/api/stats').then(setStats).catch(() => {});
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

  const linkStyle: React.CSSProperties = {
    background: 'none', border: 'none', padding: 0, color: 'var(--faint)',
    fontSize: 11, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(8,16,11,.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      // No outside-click dismiss — accidental taps lose half-typed codes
    >
      <div style={{
        width: '100%', maxWidth: 460, position: 'relative',
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 20, boxShadow: '0 30px 70px -20px rgba(0,0,0,.5)',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        {/* X close — only dismiss mechanism */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 14, right: 14, zIndex: 1,
            width: 34, height: 34, border: '1px solid var(--line)',
            borderRadius: 10, background: 'var(--surface2)',
            color: 'var(--ink)', cursor: 'pointer', fontSize: 20, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>

        <div style={{ padding: 28, display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, justifyContent: 'center', paddingRight: 32 }}>
            <LogoMark size={36} /><Wordmark />
          </div>

          <div style={{ textAlign: 'center' }}>
            <div className="pill pill-gold" style={{ marginBottom: 12 }}>WORLD CUP 2026</div>
            <h2 style={{ margin: '0 0 6px', fontSize: 26, lineHeight: 1.08 }}>
              Predict the World Cup.<br />Win <span style={{ color: 'var(--gold)' }}>৳1,00,000</span>.
            </h2>
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>
              Call the group games, send teams through every knockout, climb the live leaderboard. Free, no catch.
            </p>
            {t?.lockAt && (
              <div style={{ marginTop: 12, fontSize: 13 }} className="muted">
                Bracket locks in <strong style={{ color: 'var(--ink)' }}><Countdown to={t.lockAt} compact /></strong>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <a
              className="btn"
              href={API_BASE + '/auth/google'}
              style={{ textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
              Continue with Google
            </a>

            <button className="btn btn-primary" onClick={onPhoneSignup} style={{ textAlign: 'center' }}>
              Sign up with phone
            </button>

            <div className="faint" style={{ textAlign: 'center', fontSize: 12, margin: '2px 0' }}>or use an email code</div>

            {stage === 'idle' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && email && !busy && sendCode()}
                />
                <button className="btn" onClick={sendCode} disabled={!email || busy}>Send</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input tabular"
                  placeholder="6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && code.length >= 4 && !busy && verify()}
                  autoFocus
                />
                <button className="btn btn-primary" onClick={verify} disabled={code.length < 4 || busy}>Verify</button>
              </div>
            )}
            {msg && <div className="faint" style={{ fontSize: 13, textAlign: 'center' }}>{msg}</div>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }} className="faint">
            <span>🔒 Free to play</span>
            {stats && <span>· {stats.totalUsers?.toLocaleString?.() || stats.totalUsers} players</span>}
          </div>

          <p style={{ fontSize: 11, textAlign: 'center', margin: 0, color: 'var(--faint)' }}>
            By playing you agree to our{' '}
            <button style={linkStyle} onClick={() => showLegal('terms')}>Terms</button>
            {' · '}
            <button style={linkStyle} onClick={() => showLegal('privacy')}>Privacy</button>
          </p>
        </div>
      </div>
    </div>
  );
}
