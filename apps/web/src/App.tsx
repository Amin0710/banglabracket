import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, type User } from './context/Providers';
import { LogoMark, Wordmark, ThemeToggle, SubTabs } from './components/ui';
import { api } from './lib/api';
import { prefetchOnIdle } from './lib/tournament';
import LoginModal from './pages/SignIn';
import OnboardModal from './pages/Onboard';
import Bracket from './pages/Bracket';          // eager: the primary tab (fast first paint)
import MyEntry from './pages/MyEntry';
import Leaderboard from './pages/Leaderboard';
import Verify from './pages/Verify';
import HowToPlay from './pages/HowToPlay';
import Scoring from './pages/Scoring';
import Prizes from './pages/Prizes';
import Winners from './pages/Winners';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';

// Heavier / secondary tabs are lazy so the Bracket paints first; they're prefetched
// on idle (see prefetchOnIdle below) so switching to them is instant on slow links.
const Fantasy = lazy(() => import('./pages/Fantasy'));
const Results = lazy(() => import('./pages/Results'));

// Small tab-switch loading indicator (Suspense fallback for lazy tabs).
function TabFallback() {
  return <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;
}

// ── Hubs: a bottom-nav destination that groups its sibling pages as top sub-tabs
// (shown on every viewport now — the sub-tabs ARE the secondary navigation).

// Leaderboard groups: Leaderboard · Results (moved out of Bracket) · Winners.
function LeaderboardHub() {
  type L = 'leaderboard' | 'results' | 'winners';
  const [sub, setSub] = useState<L>('leaderboard');
  return (
    <div>
      <SubTabs<L> active={sub} onChange={setSub}
        tabs={[{ key: 'leaderboard', label: 'Leaderboard' }, { key: 'results', label: 'Results' }, { key: 'winners', label: 'Winners' }]} />
      <Suspense fallback={<TabFallback />}>
        {sub === 'results' ? <Results /> : sub === 'winners' ? <Winners /> : <Leaderboard />}
      </Suspense>
    </div>
  );
}

// My Entry groups: My Entry · Verify (moved in) · the info pages (How to play / Scoring / Prizes).
function MyEntryHub() {
  type E = 'entry' | 'verify' | 'howtoplay' | 'scoring' | 'prizes';
  const [sub, setSub] = useState<E>('entry');
  return (
    <div>
      <SubTabs<E> active={sub} onChange={setSub}
        tabs={[{ key: 'entry', label: 'My Entry' }, { key: 'verify', label: 'Verify' }, { key: 'howtoplay', label: 'How to play' }, { key: 'scoring', label: 'Scoring' }, { key: 'prizes', label: 'Prizes' }]} />
      {sub === 'verify' ? <Verify /> : sub === 'howtoplay' ? <HowToPlay /> : sub === 'scoring' ? <Scoring /> : sub === 'prizes' ? <Prizes /> : <MyEntry />}
    </div>
  );
}

interface NavItem { to: string; label: string; icon: string; locked?: boolean; admin?: boolean; }
// Bottom nav = EXACTLY 4: Bracket · Fantasy(locked) · My Entry · Leaderboard.
const NAV: NavItem[] = [
  { to: '/bracket', label: 'Bracket', icon: 'M4 6h6M4 18h6M10 6v12M10 12h6M16 12h4' },
  { to: '/fantasy', label: 'Fantasy', icon: 'M4 10h16M4 10v8a2 2 0 002 2h12a2 2 0 002-2v-8M8 10V7a4 4 0 018 0v3', locked: true },
  { to: '/entry', label: 'My Entry', icon: 'M3 5h18v14H3zM3 10h18' },
  { to: '/leaderboard', label: 'Leaderboard', icon: 'M6 20V10M12 20V4M18 20v-7' },
  { to: '/admin', label: 'Match console', icon: 'M4 7h16M4 12h16M4 17h10', admin: true },
];
const PLAY_NAV = NAV.filter((n) => !n.admin);

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
  const mainItems = NAV.filter((n) => !n.admin || user?.role === 'admin');
  const Item = (i: NavItem) => {
    const active = loc.pathname === i.to;
    return (
      <button key={i.to} onClick={() => nav(i.to)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 11, border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: 600, fontSize: 15, background: active ? 'var(--greenSoft)' : 'transparent', color: active ? 'var(--green)' : i.locked ? 'var(--faint)' : 'var(--ink)' }}>
        <NavIcon d={i.icon} /><span style={{ flex: 1 }}>{i.label}</span>{i.locked && <span style={{ fontSize: 12 }}>🔒</span>}
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
  const loc = useLocation();
  const nav = useNavigate();
  // Mobile bottom nav is EXACTLY 4: Bracket · Fantasy(locked) · My Entry · Leaderboard.
  // Admin ("Match console") stays on the desktop sidebar + its route, never here.
  const items = PLAY_NAV;
  return (
    <nav className="bb-bottomnav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--line)', zIndex: 50, padding: '6px 4px', paddingBottom: 'calc(6px + env(safe-area-inset-bottom))', justifyContent: 'space-around' }}>
      {items.map((i) => {
        const active = loc.pathname === i.to;
        return (
          <button key={i.to} onClick={() => nav(i.to)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 2px', color: active ? 'var(--green)' : i.locked ? 'var(--faint)' : 'var(--muted)', fontSize: 10, fontWeight: 600 }}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <NavIcon d={i.icon} />
              {i.locked && <span style={{ position: 'absolute', top: -5, right: -8, fontSize: 9 }}>🔒</span>}
            </span>
            {i.label.split(' ')[0]}
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

  // After first paint / idle, quietly warm the lazy tab chunks so the first switch
  // to Fantasy / Results / Cash the Guess is instant on slow (BD-mobile) connections.
  useEffect(() => {
    prefetchOnIdle([
      () => import('./pages/Fantasy'),
      () => import('./pages/Results'),
      () => import('./pages/CashGuess'),
    ]);
  }, []);

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
            <Suspense fallback={<TabFallback />}>
              <Routes>
                <Route path="/" element={null} />
                <Route path="/bracket" element={<Bracket />} />
                <Route path="/fantasy" element={<Fantasy />} />
                <Route path="/entry" element={<MyEntryHub />} />
                <Route path="/leaderboard" element={<LeaderboardHub />} />
                {/* direct routes preserved for deep links / post-login redirects */}
                <Route path="/verify" element={<Verify />} />
                <Route path="/howtoplay" element={<HowToPlay />} />
                <Route path="/scoring" element={<Scoring />} />
                <Route path="/prizes" element={<Prizes />} />
                <Route path="/winners" element={<Winners />} />
                <Route path="/results" element={<Results />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
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
