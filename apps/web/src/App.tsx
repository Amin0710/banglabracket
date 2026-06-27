import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useTheme } from './context/Providers';
import { LogoMark, Wordmark, BrandLogo } from './components/ui';
import SignIn from './pages/SignIn';
import Onboard from './pages/Onboard';
import Overview from './pages/Overview';
import Bracket from './pages/Bracket';
import MyEntry from './pages/MyEntry';
import Leaderboard from './pages/Leaderboard';
import Verify from './pages/Verify';
import Admin from './pages/Admin';

interface NavItem { to: string; label: string; icon: string; admin?: boolean; }
const NAV: NavItem[] = [
  { to: '/overview', label: 'Overview', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' },
  { to: '/bracket', label: 'Bracket', icon: 'M4 6h6M4 18h6M10 6v12M10 12h6M16 12h4' },
  { to: '/entry', label: 'My Entry', icon: 'M3 5h18v14H3zM3 10h18' },
  { to: '/leaderboard', label: 'Leaderboard', icon: 'M6 20V10M12 20V4M18 20v-7' },
  { to: '/verify', label: 'Verify', icon: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z' },
  { to: '/admin', label: 'Match console', icon: 'M4 7h16M4 12h16M4 17h10', admin: true },
];

function NavIcon({ d }: { d: string }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <div style={{ display: 'inline-flex', background: 'var(--surface2)', borderRadius: 999, padding: 3, border: '1px solid var(--line)' }}>
      <button onClick={() => dark && toggle()} title="Light" style={{ border: 'none', borderRadius: 999, width: 32, height: 28, cursor: 'pointer', background: !dark ? 'var(--green)' : 'transparent', color: !dark ? '#fff' : 'var(--muted)' }}>☀</button>
      <button onClick={() => !dark && toggle()} title="Dark" style={{ border: 'none', borderRadius: 999, width: 32, height: 28, cursor: 'pointer', background: dark ? 'var(--green)' : 'transparent', color: dark ? '#fff' : 'var(--muted)' }}>☾</button>
    </div>
  );
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
        <div className="faint" style={{ fontSize: 12 }}>Bangladesh · {user.verified ? 'Verified' : 'Unverified'}</div>
      </div>
    </div>
  );
}

function Sidebar() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const items = NAV.filter((n) => !n.admin || user?.role === 'admin');
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
      <div style={{ padding: '20px 18px 14px', display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' }} onClick={() => nav('/overview')}>
        <BrandLogo height={30} />
      </div>
      <div style={{ padding: '6px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--faint)' }}>PLAY</div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>
        {items.filter((i) => !i.admin).map(Item)}
      </nav>
      {items.some((i) => i.admin) && (<>
        <div style={{ padding: '14px 18px 6px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--faint)' }}>STAFF</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>{items.filter((i) => i.admin).map(Item)}</nav>
      </>)}
      <div style={{ marginTop: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--line)' }}>
        <ThemeToggle /><UserChip />
        {user && <button className="btn" onClick={() => { logout(); nav('/'); }} style={{ fontSize: 13, padding: '7px 12px' }}>Sign out</button>}
      </div>
    </aside>
  );
}

function BottomNav() {
  const { user } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const items = NAV.filter((n) => !n.admin || user?.role === 'admin');
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

function MobileHeader() {
  return (
    <header className="bb-mobileheader" style={{ alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 40 }}>
      <BrandLogo height={28} />
      <div style={{ marginLeft: 'auto' }}><ThemeToggle /></div>
    </header>
  );
}

export default function App() {
  const { loading, user } = useAuth();
  const loc = useLocation();
  if (loading) return <div style={{ padding: 40 }} className="muted">Loading…</div>;
  const bare = loc.pathname === '/' || loc.pathname === '/onboard';
  if (bare) {
    return (
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/onboard" element={<Onboard />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    );
  }
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <MobileHeader />
        <main style={{ flex: 1, padding: 'clamp(16px,3vw,32px)', paddingBottom: 90, maxWidth: 1080, width: '100%', margin: '0 auto' }}>
          <Routes>
            <Route path="/overview" element={<Overview />} />
            <Route path="/bracket" element={<Bracket />} />
            <Route path="/entry" element={<MyEntry />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to={user ? '/overview' : '/'} />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
