import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/Providers';

export default function Verify() {
  const { user } = useAuth();
  const [idType, setIdType] = useState<'nid' | 'passport' | 'birth_certificate'>('nid');
  const [idNumber, setIdNumber] = useState('');
  const [dob, setDob] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) return <div className="card" style={{ padding: 24 }}>Please <Link to="/" style={{ color: 'var(--gold)' }}>sign in</Link>.</div>;

  async function submit() {
    setBusy(true); setMsg('');
    try { await api.put('/api/me/id', { idType, idNumber, dob: dob || undefined }); setMsg('Submitted. Now send your code + ID photo + selfie to the admin DM to finish verification.'); }
    catch (e: any) { setMsg(e.message === 'id_already_used' ? 'That ID is already linked to another account.' : 'Error: ' + e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 560, margin: '0 auto' }}>
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Play now, verify later</h2>
        <p className="muted">Only winners need to verify. Prize eligibility is based on <strong>Bangladeshi nationality</strong>, not where you live.</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span>Your verification code</span>
          <code className="pill pill-gold" style={{ fontSize: 16 }}>{user.verificationCode}</code>
        </div>
        {user.verified ? <p style={{ color: 'var(--good)' }}>✓ You are verified{user.prizeEligible ? ' and prize-eligible.' : '.'}</p>
          : <p className="faint">Status: not yet verified.</p>}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <strong>How to verify</strong>
        <ol className="muted" style={{ paddingLeft: 18 }}>
          <li>Send a private message to the admin (Discord / Messenger).</li>
          <li>Include your code <code>{user.verificationCode}</code>, a photo of your ID, and a selfie.</li>
          <li>The admin checks and marks you eligible. No photos are uploaded or stored in this app.</li>
        </ol>
      </div>

      <div className="card" style={{ padding: 20, display: 'grid', gap: 10 }}>
        <strong>Optional: pre-register your ID number</strong>
        <p className="faint" style={{ margin: 0, fontSize: 13 }}>Stored encrypted. This just reserves your ID so nobody else can claim it.</p>
        <select className="input" value={idType} onChange={(e) => setIdType(e.target.value as any)}>
          <option value="nid">National ID (NID)</option>
          <option value="passport">Passport</option>
          <option value="birth_certificate">Birth certificate</option>
        </select>
        <input className="input" placeholder="ID number" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
        <input className="input" placeholder="Date of birth (optional)" value={dob} onChange={(e) => setDob(e.target.value)} />
        <button className="btn btn-primary" onClick={submit} disabled={busy || idNumber.length < 3}>{busy ? 'Saving…' : 'Submit ID details'}</button>
        {msg && <div style={{ fontSize: 14, color: msg.startsWith('Error') || msg.includes('already') ? 'var(--bad)' : 'var(--good)' }}>{msg}</div>}
      </div>
    </div>
  );
}
