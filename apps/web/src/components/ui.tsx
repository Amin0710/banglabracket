import type React from 'react';
import { useEffect, useState } from 'react';
import { flagUrl } from '../lib/api';
import { useTheme } from '../context/Providers';

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.28, flex: '0 0 auto',
      background: 'linear-gradient(150deg,#ffd45f,#e8ab1f)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', boxShadow: '0 6px 15px rgba(232,171,31,.3)' }}>
      <svg width={size * 0.69} height={size * 0.69} viewBox="0 0 48 48" fill="none" stroke="#1a1405" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6H14M4 18H14M4 30H14M4 42H14M14 6V18M14 30V42M14 12H24M14 36H24M24 12V36M24 24H34" />
        <path d="M39 19 44 24 39 29 34 24Z" fill="#1a1405" stroke="none" />
      </svg>
    </span>
  );
}

export function Wordmark() {
  return (
    <span className="display" style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-.01em' }}>
      Bangla<span style={{ color: 'var(--gold)' }}>Bracket</span>
    </span>
  );
}

// Real PNG wordmark (theme-aware). Falls back to the SVG mark + text if the
// image is missing, so the app never shows a broken logo.
export function BrandLogo({ height = 30 }: { height?: number }) {
  const { dark } = useTheme();
  const [failed, setFailed] = useState(false);
  const src = (import.meta.env.BASE_URL || '/') + (dark ? 'wordmark-dark.png' : 'wordmark-light.png');
  if (failed) return <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><LogoMark size={height + 4} /><Wordmark /></span>;
  return <img src={src} alt="BanglaBracket" height={height} style={{ height, width: 'auto', display: 'block' }} onError={() => setFailed(true)} />;
}

export function Countdown({ to, compact }: { to: string; compact?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const diff = Math.max(0, new Date(to).getTime() - now);
  if (diff === 0) return <span className="pill pill-gold">Locked</span>;
  const d = Math.floor(diff / 86400000), h = Math.floor(diff / 3600000) % 24,
    m = Math.floor(diff / 60000) % 60, s = Math.floor(diff / 1000) % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (compact) return <span className="tabular" style={{ fontWeight: 700 }}>{d}d {pad(h)}:{pad(m)}:{pad(s)}</span>;
  return (
    <span className="tabular" style={{ fontWeight: 800 }}>
      {d}d&nbsp;{pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}

export function Flag({ name, size = 24 }: { name?: string | null; size?: number }) {
  const f = flagUrl(name);
  return f
    ? <img className="flag" src={f} alt="" style={{ width: size, height: size * 0.66 }} />
    : <span className="flag" style={{ width: size, height: size * 0.66, background: 'var(--line)' }} />;
}

export function PageHeader({ title, subtitle, lockAt, right }: { title: string; subtitle?: string; lockAt?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(24px,4vw,32px)', fontWeight: 800 }}>{title}</h1>
        {subtitle && <p className="muted" style={{ margin: '4px 0 0', fontSize: 15 }}>{subtitle}</p>}
      </div>
      {right}
      {lockAt && (
        <div className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          <span className="faint" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em' }}>LOCKS IN</span>
          <Countdown to={lockAt} compact />
        </div>
      )}
    </div>
  );
}
