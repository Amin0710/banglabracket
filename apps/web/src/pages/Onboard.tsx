import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/Providers';
import { LogoMark, Wordmark } from '../components/ui';
import { toast } from '../lib/feedback';

const DISTRICTS = ['Dhaka','Chattogram','Khulna','Rajshahi','Sylhet','Barishal','Rangpur','Mymensingh','Comilla','Gazipur','Narayanganj','Bogura','Jashore','Cox\u2019s Bazar','Dinajpur','Pabna','Tangail','Jamalpur','Noakhali','Feni','Brahmanbaria','Kushtia','Faridpur','Sirajganj','Naogaon','Natore','Joypurhat','Chuadanga','Magura','Jhenaidah','Satkhira','Bagerhat','Pirojpur','Patuakhali','Bhola','Barguna','Jhalokati','Lakshmipur','Chandpur','Habiganj','Moulvibazar','Sunamganj','Netrokona','Sherpur','Kishoreganj','Manikganj','Munshiganj','Narsingdi','Rajbari','Gopalganj','Madaripur','Shariatpur','Meherpur','Narail','Gaibandha','Kurigram','Lalmonirhat','Nilphamari','Panchagarh','Thakurgaon','Khagrachhari','Rangamati','Bandarban','Cumilla'];

export default function Onboard() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [district, setDistrict] = useState('');
  const [bkash, setBkash] = useState('');
  const [overseas, setOverseas] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName((v) => v || user.name || '');
    setEmail((v) => v || user.email || '');
    setPhone((v) => v || user.phone || '');
    setBkash((v) => v || user.bkash || '');
    setDistrict((v) => v || user.district || '');
    if (user.overseas) setOverseas(true);
  }, [user]);

  async function submit() {
    if (!phone || phone.length < 6) { toast('Add a phone number', 'error'); return; }
    if (!overseas && !district) { toast('Pick your district', 'error'); return; }
    setBusy(true);
    const payload: any = {
      phone, name: name || undefined, email: email || undefined,
      bkash: bkash || undefined, overseas, district: overseas ? '' : district || undefined,
    };
    try {
      if (user) await api.put('/api/me/profile', payload);
      else await api.post('/auth/signup', payload);
      await refresh();
      toast('You\u2019re in — make your picks!');
      nav('/bracket');
    } catch (e: any) {
      const m: Record<string, string> = {
        number_in_use: 'That number is already registered.',
        email_in_use: 'That email is already registered.',
        bkash_or_overseas_required: 'Add a Bkash number, or mark that you\u2019re overseas.',
      };
      toast(m[e.message] || ('Error: ' + e.message), 'error');
    } finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'radial-gradient(1100px 460px at 50% -10%, var(--greenSoft), var(--bg))' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 16 }}><LogoMark size={36} /><Wordmark /></div>
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ margin: 0 }}>Quick setup</h2>
          <p className="muted" style={{ marginTop: 4, fontSize: 14 }}>Just a couple of details so we can rank you and reach you if you win.</p>

          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            <label style={{ display: 'grid', gap: 6 }}><span>Name</span>
              <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} /></label>

            <label style={{ display: 'grid', gap: 6 }}><span>Phone number</span>
              <input className="input" inputMode="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>

            {!overseas && (
              <label style={{ display: 'grid', gap: 6 }}><span>District <span className="faint">(Bangladesh)</span></span>
                <select className="input" value={district} onChange={(e) => setDistrict(e.target.value)}>
                  <option value="">Select your district…</option>
                  {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select></label>
            )}

            {/* Bkash + Overseas side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Bkash number <span className="faint">(only if you win)</span></span>
                <input className="input" inputMode="tel" placeholder="Bkash number" value={bkash} onChange={(e) => setBkash(e.target.value)} disabled={overseas} style={{ opacity: overseas ? 0.5 : 1 }} />
              </label>
              <button className="btn" onClick={() => setOverseas((o) => !o)} style={{ height: 44, whiteSpace: 'nowrap', borderColor: overseas ? 'var(--gold)' : undefined, background: overseas ? 'var(--greenSoft)' : undefined }}>
                {overseas ? '✓ Overseas' : 'I\u2019m overseas'}
              </button>
            </div>

            {overseas && (
              <div className="card" style={{ padding: 12, background: 'var(--surface2)', borderColor: 'var(--gold)', fontSize: 13.5 }}>
                ⚠️ Prizes are for <strong>Bangladeshi nationals</strong> (by nationality, not residence). You can still play and win from overseas — we\u2019ll arrange payout if you win.
              </div>
            )}

            <button className="btn btn-primary" onClick={submit} disabled={busy} style={{ marginTop: 4, padding: 13 }}>
              {busy ? 'Saving…' : 'Start predicting →'}
            </button>
            <p className="faint" style={{ fontSize: 12, textAlign: 'center', margin: 0 }}>We only use your details to run the game and reach winners. Bkash is needed only if you win.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
