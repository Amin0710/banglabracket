import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, type User } from './context/Providers';
import { LogoMark, Wordmark, ThemeToggle, SubTabs } from './components/ui';
import { api } from './lib/api';
import LoginModal from './pages/SignIn';
import OnboardModal from './pages/Onboard';
import Bracket from './pages/Bracket';
import MyEntry from './pages/MyEntry';
import Leaderboard from './pages/Leaderboard';
import Verify from './pages/Verify';
import HowToPlay from './pages/HowToPlay';
import Scoring from './pages/Scoring';
import Prizes from './pages/Prizes';
import Winners from './pages/Winners';
import Admin from './pages/Admin';

// ── Mobile hubs: bottom-nav entry points that expose their sibling INFO/secondary
// pages as top sub-tabs. On desktop the sub-tabs hide (sidebar handles those routes).
function LeaderboardHub() {
  const [sub, setSub] = useState<'leaderboard' | 'winners'>('leaderboard');
  return (
    <div>
      <SubTabs<'leaderboard' | 'winners'> mobileOnly active={sub} onChange={setSub}
        tabs={[{ key: 'leaderboard', label: 'Leaderboard' }, { key: 'winners', label: 'Winners' }]} />
      {sub === 'winners' ? <Winners /> : <Leaderboard />}
    </div>
  );
}

function VerifyHub() {
  type V = 'verify' | 'howtoplay' | 'scoring' | 'prizes';
  const [sub, setSub] = useState<V>('verify');
  return (
    <div>
      <SubTabs<V> mobileOnly active={sub} onChange={setSub}
        tabs={[{ key: 'verify', label: 'Verify' }, { key: 'howtoplay', label: 'How to play' }, { key: 'scoring', label: 'Scoring' }, { key: 'prizes', label: 'Prizes' }]} />
      {sub === 'howtoplay' ? <HowToPlay /> : sub === 'scoring' ? <Scoring /> : sub === 'prizes' ? <Prizes /> : <Verify />}
    </div>
  );
}

interface NavItem { to: string; label: string; icon: string; info?: boolean; admin?: boolean; }
const NAV: NavItem[] = [
  { to: '/bracket', label: 'Bracket', icon: 'M4 6h6M4 18h6M10 6v12M10 12h6M16 12h4' },
  { to: '/entry', label: 'My Entry', icon: 'M3 5h18v14H3zM3 10h18' },
  { to: '/leaderboard', label: 'Leaderboard', icon: 'M6 20V10M12 20V4M18 20v-7' },
  { to: '/verify', label: 'Verify', icon: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z' },
  { to: '/howtoplay', label: 'How to play', icon: 'M9 9a3 3 0 0 1 5.12-2.12A3 3 0 0 1 12 12v1M12 17h.01', info: true },
  { to: '/scoring', label: 'Scoring', icon: 'M4 6h16M4 10h16M4 14h10', info: true },
  { to: '/prizes', label: 'Prizes', icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z', info: true },
  { to: '/winners', label: 'Winners', icon: 'M8 21h8M12 17v4M17 8a5 5 0 0 0-10 0c0 2 1 3 2 4l1 1h6l1-1c1-1 2-2 2-4z', info: true },
  { to: '/admin', label: 'Match console', icon: 'M4 7h16M4 12h16M4 17h10', admin: true },
];
const PLAY_NAV = NAV.filter((n) => !n.info && !n.admin);

function NavIcon({ d }: { d: string }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

function UserChip() {
  const { user } = useAuth();
  if (!user) return null;
  const initial = (user.name || user.email || 'Y')[0].toUpperCase();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flex: '0 0 auto' }}>{initial}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || 'You'}</div>
        <div className="faint" style={{ fontSize: 12 }}>{user.overseas ? 'Overseas' : 'Bangladesh'} · {user.verified ? 'Verified' : 'Unverified'}</div>
      </div>
    </div>
  );
}

function Sidebar({ onSignIn }: { onSignIn: () => void }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const mainItems = NAV.filter((n) => !n.info && (!n.admin || user?.role === 'admin'));
  const infoItems = NAV.filter((n) => n.info);
  const Item = (i: NavItem) => {
    const active = loc.pathname === i.to;
    return (
      <button key={i.to} onClick={() => nav(i.to)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 11, border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: 600, fontSize: 15, background: active ? 'var(--greenSoft)' : 'transparent', color: active ? 'var(--green)' : 'var(--ink)' }}>
        <NavIcon d={i.icon} />{i.label}
      </button>
    );
  };
  return (
    <aside className="bb-sidebar" style={{ width: 252, flex: '0 0 auto', height: '100vh', position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRight: '1px solid var(--line)' }}>
      <div style={{ padding: '20px 18px 14px', display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' }} onClick={() => nav('/bracket')}>
        <LogoMark /><Wordmark />
      </div>
      <div style={{ padding: '6px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--faint)' }}>PLAY</div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>
        {mainItems.filter((i) => !i.admin).map(Item)}
      </nav>
      <div style={{ padding: '14px 18px 6px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--faint)' }}>INFO</div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>
        {infoItems.map(Item)}
      </nav>
      {mainItems.some((i) => i.admin) && (<>
        <div style={{ padding: '14px 18px 6px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--faint)' }}>STAFF</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>{mainItems.filter((i) => i.admin).map(Item)}</nav>
      </>)}
      <div style={{ marginTop: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--line)' }}>
        <ThemeToggle />
        {user ? (
          <>
            <UserChip />
            <button className="btn" onClick={() => { logout(); }} style={{ fontSize: 13, padding: '7px 12px' }}>Sign out</button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={onSignIn} style={{ fontSize: 13, padding: '7px 12px' }}>Sign in</button>
        )}
      </div>
    </aside>
  );
}

function BottomNav() {
  const { user } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const items = PLAY_NAV.concat(NAV.filter((n) => n.admin && user?.role === 'admin'));
  return (
    <nav className="bb-bottomnav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--line)', zIndex: 50, padding: '6px 4px', justifyContent: 'space-around' }}>
      {items.map((i) => {
        const active = loc.pathname === i.to;
        return (
          <button key={i.to} onClick={() => nav(i.to)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 2px', color: active ? 'var(--green)' : 'var(--muted)', fontSize: 10, fontWeight: 600 }}>
            <NavIcon d={i.icon} />{i.label.split(' ')[0]}
          </button>
        );
      })}
    </nav>
  );
}

function MobileHeader({ onSignIn }: { onSignIn: () => void }) {
  const { user } = useAuth();
  return (
    <header className="bb-mobileheader" style={{ alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 40 }}>
      <LogoMark size={30} /><Wordmark />
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {!user && (
          <button className="btn btn-primary" onClick={onSignIn} style={{ fontSize: 13, padding: '6px 12px' }}>Sign in</button>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}

function profileIncomplete(user: User | null): boolean {
  if (!user) return false;
  return !user.phone || (!user.overseas && !user.district);
}

export default function App() {
  const { loading, user } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const prevUserRef = useRef<User | null | undefined>(undefined);

  async function redirectAfterLogin() {
    try {
      // Complete bracket (all knockout winners picked through the Final) → My Entry;
      // incomplete (or no entry) → Bracket to keep filling it in.
      const d = await api.get('/api/entry');
      nav(d?.entry && d?.bracketComplete ? '/entry' : '/bracket');
    } catch {
      nav('/bracket');
    }
  }

  useEffect(() => {
    if (loading) return;
    const prev = prevUserRef.current;
    prevUserRef.current = user;

    if (!user) {
      if (prev === undefined || prev !== null) setLoginOpen(true);
    } else if (profileIncomplete(user)) {
      setLoginOpen(false);
      setOnboardOpen(true);
    } else {
      setLoginOpen(false);
      setOnboardOpen(false);
      if (loc.pathname === '/') redirectAfterLogin();
    }
  }, [user, loading]);

  if (loading) return <div style={{ padding: 40 }} className="muted">Loading…</div>;

  const toLanding = () => { window.location.href = '/'; };
  const blurred = !user;

  return (
    <>
      <div style={{
        display: 'flex', minHeight: '100vh',
        ...(blurred ? { filter: 'blur(6px) brightness(0.7)', pointerEvents: 'none', userSelect: 'none' } : {}),
      }}>
        <Sidebar onSignIn={() => setLoginOpen(true)} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <MobileHeader onSignIn={() => setLoginOpen(true)} />
          <main style={{ flex: 1, padding: 'clamp(16px,3vw,32px)', paddingBottom: 90, maxWidth: 1080, width: '100%', margin: '0 auto' }}>
            <Routes>
              <Route path="/" element={null} />
              <Route path="/bracket" element={<Bracket />} />
              <Route path="/entry" element={<MyEntry />} />
              <Route path="/leaderboard" element={<LeaderboardHub />} />
              <Route path="/verify" element={<VerifyHub />} />
              <Route path="/howtoplay" element={<HowToPlay />} />
              <Route path="/scoring" element={<Scoring />} />
              <Route path="/prizes" element={<Prizes />} />
              <Route path="/winners" element={<Winners />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<Navigate to="/bracket" />} />
            </Routes>
          </main>
          <BottomNav />
        </div>
      </div>

      {loginOpen && (
        <LoginModal onClose={toLanding} />
      )}
      {onboardOpen && (
        <OnboardModal
          onClose={toLanding}
          onDone={() => { if (loc.pathname === '/') redirectAfterLogin(); }}
        />
      )}
    </>
  );
}
