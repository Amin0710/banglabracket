import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/Providers';
import { Countdown } from '../App';

// Facebook is kept built but hidden until the app is approved (see FACEBOOK_ENABLED on the API).
const FACEBOOK_VISIBLE = false;

export default function SignIn() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [lockAt, setLockAt] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'idle' | 'code'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => { api.get('/api/tournament').then((t) => setLockAt(t.lockAt)).catch(() => {}); }, []);
  useEffect(() => { if (user) nav(user.phone ? '/bracket' : '/onboard'); }, [user]);

  async function sendCode() {
    setMsg('');
    try { const r = await api.post('/auth/email/request', { email }); setStage('code'); setMsg(r.delivered ? 'Code sent — check your email.' : 'Dev mode: check the API console for your code.'); }
    catch (e: any) { setMsg('Could not send code: ' + e.message); }
  }
  async function verify() {
    setMsg('');
    try { await api.post('/auth/email/verify', { email, code }); await refresh(); }
    catch (e: any) { setMsg('Invalid code: ' + e.message); }
  }

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 520, margin: '24px auto' }}>
      <div className="card" style={{ padding: 24, textAlign: 'center', background: 'linear-gradient(160deg, var(--surface), var(--bg2))' }}>
        <div className="pill pill-gold" style={{ display: 'inline-block', marginBottom: 12 }}>Win 100,000 BDT</div>
        <h1 style={{ margin: '4px 0', fontSize: 30, lineHeight: 1.1 }}>Bangla<span style={{ color: 'var(--gold)' }}>Bracket</span></h1>
        <p className="muted" style={{ marginTop: 4 }}>Brings World Cup 2026 · Predict the bracket, win the prize.</p>
        {lockAt && <div style={{ marginTop: 14 }} className="muted">Bracket locks in <Countdown to={lockAt} /></div>}
        <p className="faint" style={{ fontSize: 13, marginTop: 12 }}>Free to play · Your data is protected</p>
      </div>

      <div className="card" style={{ padding: 20, display: 'grid', gap: 12 }}>
        <a className="btn" href="/auth/google" style={{ textAlign: 'center', textDecoration: 'none' }}>Continue with Google</a>
        {FACEBOOK_VISIBLE && <a className="btn" href="/auth/facebook" style={{ textAlign: 'center', textDecoration: 'none' }}>Continue with Facebook</a>}
        <Link className="btn btn-primary" to="/onboard" style={{ textAlign: 'center', textDecoration: 'none' }}>Sign up with phone</Link>

        <div className="faint" style={{ textAlign: 'center', fontSize: 12 }}>or use an email code</div>
        {stage === 'idle' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn" onClick={sendCode} disabled={!email}>Send code</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn btn-primary" onClick={verify} disabled={code.length < 4}>Verify</button>
          </div>
        )}
        {msg && <div className="faint" style={{ fontSize: 13 }}>{msg}</div>}
      </div>
    </div>
  );
}
