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

// Light/Dark switch — shared by the app shell (App.tsx) and the sign-in screen.
export function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <div style={{ display: 'inline-flex', background: 'var(--surface2)', borderRadius: 999, padding: 3, border: '1px solid var(--line)' }}>
      <button onClick={() => dark && toggle()} title="Light" style={{ border: 'none', borderRadius: 999, width: 32, height: 28, cursor: 'pointer', background: !dark ? 'var(--green)' : 'transparent', color: !dark ? '#fff' : 'var(--muted)' }}>☀</button>
      <button onClick={() => !dark && toggle()} title="Dark" style={{ border: 'none', borderRadius: 999, width: 32, height: 28, cursor: 'pointer', background: dark ? 'var(--green)' : 'transparent', color: dark ? '#fff' : 'var(--muted)' }}>☾</button>
    </div>
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

const pad2 = (n: number) => String(n).padStart(2, '0');
function fmtDiff(ms: number) {
  const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24,
    m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${d}d ${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}
function useNowTick() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return now;
}

export interface NextMatchInfo { kickoff: string; label: string; matchNumber?: number | null; }
export interface NextRoundInfo { round: string; startsAt: string | null; }

// "Next match starts in…" — sits at the top of the front page.
export function NextMatchBanner({ nextMatch }: { nextMatch?: NextMatchInfo | null }) {
  const now = useNowTick();
  if (!nextMatch?.kickoff) return null;
  const diff = Math.max(0, new Date(nextMatch.kickoff).getTime() - now);
  return (
    <div className="card" style={{ padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center',
      gap: 14, flexWrap: 'wrap', background: 'linear-gradient(120deg,var(--greenSoft),transparent)', borderColor: 'var(--green)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span className="faint" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em' }}>NEXT MATCH STARTS IN</span>
        <strong style={{ fontSize: 16 }}>{nextMatch.label}</strong>
      </div>
      <span className="tabular" style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 22 }}>
        {diff === 0 ? 'Kicking off' : fmtDiff(diff)}
      </span>
    </div>
  );
}

// "Next round starts in… (Round of 16)" — sits in the strip just above the footer.
export function NextRoundStrip({ nextRound }: { nextRound?: NextRoundInfo | null }) {
  const now = useNowTick();
  if (!nextRound?.round) return null;
  const ms = nextRound.startsAt ? Math.max(0, new Date(nextRound.startsAt).getTime() - now) : null;
  return (
    <div className="card" style={{ padding: '12px 16px', marginTop: 28, display: 'flex', alignItems: 'center',
      gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
      <span className="faint" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em' }}>NEXT ROUND STARTS IN</span>
      <span style={{ fontWeight: 800, color: 'var(--green)', fontSize: 13 }}>({nextRound.round})</span>
      <span className="tabular" style={{ fontWeight: 800, fontSize: 18 }}>{ms == null ? 'Schedule TBD' : fmtDiff(ms)}</span>
    </div>
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
