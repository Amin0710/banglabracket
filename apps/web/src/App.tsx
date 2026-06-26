import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth, useTheme } from './context/Providers';
import SignIn from './pages/SignIn';
import Onboard from './pages/Onboard';
import Bracket from './pages/Bracket';
import MyEntry from './pages/MyEntry';
import Leaderboard from './pages/Leaderboard';
import Verify from './pages/Verify';
import Admin from './pages/Admin';

export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const diff = Math.max(0, new Date(to).getTime() - now);
  const d = Math.floor(diff / 86400000), h = Math.floor(diff / 3600000) % 24, m = Math.floor(diff / 60000) % 60, s = Math.floor(diff / 1000) % 60;
  if (diff === 0) return <span className="pill pill-gold">Locked</span>;
  return <span className="tabular" style={{ fontWeight: 700 }}>{d}d {h}h {m}m {s}s</span>;
}

function Nav() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const loc = useLocation();
  const link = (to: string, label: string) => (
    <Link to={to} style={{ color: loc.pathname === to ? 'var(--gold)' : 'var(--muted)', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>{label}</Link>
  );
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
      <Link to="/" style={{ textDecoration: 'none', color: 'var(--ink)', fontWeight: 800, fontSize: 18 }}>
        Bangla<span style={{ color: 'var(--gold)' }}>Bracket</span>
      </Link>
      <nav style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {link('/bracket', 'Bracket')}
        {link('/leaderboard', 'Leaderboard')}
        {user && link('/entry', 'My Entry')}
        {user && link('/verify', 'Verify')}
        {user?.role === 'admin' && link('/admin', 'Admin')}
      </nav>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn" onClick={toggle} title="Toggle theme">{dark ? '☀️' : '🌙'}</button>
        {user
          ? <button className="btn" onClick={logout}>Sign out</button>
          : <Link to="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>Sign in</Link>}
      </div>
    </header>
  );
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }} className="muted">Loading…</div>;
  return (
    <div style={{ minHeight: '100%' }}>
      <Nav />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
        <Routes>
          <Route path="/" element={<SignIn />} />
          <Route path="/onboard" element={<Onboard />} />
          <Route path="/bracket" element={<Bracket />} />
          <Route path="/entry" element={<MyEntry />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
