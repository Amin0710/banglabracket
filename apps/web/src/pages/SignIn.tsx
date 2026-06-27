import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE } from '../lib/api';
import { useAuth } from '../context/Providers';
import { LogoMark, Wordmark, Countdown } from '../components/ui';

export default function SignIn() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [t, setT] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'idle' | 'code'>('idle');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/api/tournament').then(setT).catch(() => {}); api.get('/api/stats').then(setStats).catch(() => {}); }, []);
  useEffect(() => { if (user) nav(user.phone ? '/overview' : '/onboard'); }, [user]);

  async function sendCode() {
    setBusy(true); setMsg('');
    try { const r = await api.post('/auth/email/request', { email }); setStage('code'); setMsg(r.delivered ? 'Code sent — check your email.' : 'Check the server console for your code (dev mode).'); }
    catch (e: any) { setMsg('Could not send code: ' + (e.message || 'try again')); }
    finally { setBusy(false); }
  }
  async function verify() {
    setBusy(true); setMsg('');
    try { await api.post('/auth/email/verify', { email, code }); await refresh(); }
    catch (e: any) { setMsg('Invalid code.'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr', placeItems: 'center', padding: 20, background: 'radial-gradient(1200px 500px at 50% -10%, var(--greenSoft), var(--bg))' }}>
      <div style={{ width: '100%', maxWidth: 460, display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, justifyContent: 'center' }}><LogoMark size={40} /><Wordmark /></div>

        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <div className="pill pill-gold" style={{ marginBottom: 14 }}>WORLD CUP 2026</div>
          <h1 style={{ margin: '0 0 6px', fontSize: 30, lineHeight: 1.08 }}>Predict the World Cup.<br />Win <span style={{ color: 'var(--gold)' }}>৳1,00,000</span>.</h1>
          <p className="muted" style={{ margin: '8px 0 0' }}>Call the group games, send teams through every knockout, and climb the live leaderboard. Free, no catch.</p>
          {t?.lockAt && <div style={{ marginTop: 16 }} className="muted">Bracket locks in <strong style={{ color: 'var(--ink)' }}><Countdown to={t.lockAt} compact /></strong></div>}
        </div>

        <div className="card" style={{ padding: 22, display: 'grid', gap: 12 }}>
          <a className="btn" href={API_BASE + '/auth/google'} style={{ textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            Continue with Google
          </a>
          <button className="btn btn-primary" onClick={() => nav('/onboard')} style={{ textAlign: 'center' }}>Sign up with phone</button>

          <div className="faint" style={{ textAlign: 'center', fontSize: 12, margin: '2px 0' }}>or use an email code</div>
          {stage === 'idle' ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn" onClick={sendCode} disabled={!email || busy}>Send</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input tabular" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="btn btn-primary" onClick={verify} disabled={code.length < 4 || busy}>Verify</button>
            </div>
          )}
          {msg && <div className="faint" style={{ fontSize: 13, textAlign: 'center' }}>{msg}</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }} className="faint">
          <span>🔒 Free to play</span>
          {stats && <span>· {stats.totalUsers?.toLocaleString?.() || stats.totalUsers} players</span>}
          <span>· Data protected</span>
        </div>
      </div>
    </div>
  );
}
