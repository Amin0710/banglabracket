import { useMemo, useState } from 'react';
import { resolveR32, resolveBracketParticipants } from '@banglabracket/shared';
import { Flag } from './ui';
import { flagUrl } from '../lib/api';
import { toast } from '../lib/feedback';

// Post-complete recap / share card. Champion centered, the user's completed
// bracket path, and BanglaBracket branding. "Share my bracket" renders a PNG
// that INCLUDES team flags + names.
//
// CORS: flag images are loaded with crossOrigin='anonymous'. flagcdn.com serves
// `Access-Control-Allow-Origin: *`, so the drawn canvas is NOT tainted and can be
// exported. Any flag that fails to load falls back to a coloured chip so export
// never breaks. (Flagged in the summary.)

interface Props {
  prediction: any;
  base: any; remaining: any;
  userName?: string | null;
}

const goldText = '#231a05';
const brandGreen = '#0b7a4b';
const brandGold = '#ffcb45';

export function ShareCard({ prediction, base, remaining, userName }: Props) {
  const [busy, setBusy] = useState(false);
  const winners: Record<number, string> = prediction?.winners || {};

  const participants = useMemo(() => {
    const r32 = resolveR32(base || {}, remaining || {}, {});
    return resolveBracketParticipants(r32 as any, winners);
  }, [base, remaining, winners]);

  const champion = winners[104] || null;
  const finalP = participants[104] || { A: null, B: null };
  const runnerUp = champion && finalP.A && finalP.B ? (champion === finalP.A ? finalP.B : finalP.A) : null;
  const semis = [participants[101]?.A, participants[101]?.B, participants[102]?.A, participants[102]?.B].filter(Boolean) as string[];

  async function share() {
    setBusy(true);
    try {
      const blob = await drawShareImage({ champion, runnerUp, semis, userName });
      const file = new File([blob], 'banglabracket-bracket.png', { type: 'image/png' });
      const navAny = navigator as any;
      if (navAny.share && navAny.canShare?.({ files: [file] })) {
        await navAny.share({ files: [file], title: 'My BanglaBracket', text: 'My World Cup 2026 bracket' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'banglabracket-bracket.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast('Bracket image downloaded');
      }
    } catch {
      toast('Could not create the image', 'error');
    } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: 20, background: 'linear-gradient(160deg, var(--surface), var(--surface2))', textAlign: 'center' }}>
        <div className="display" style={{ fontWeight: 800, fontSize: 18 }}>
          Bangla<span style={{ color: 'var(--goldText)' }}>Bracket</span>
        </div>
        <div className="faint" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', marginTop: 2 }}>WORLD CUP 2026 · MY BRACKET</div>

        <div style={{ margin: '18px auto', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '18px 26px', borderRadius: 18, background: `linear-gradient(150deg,#ffd76a,#f0a921)`, color: goldText, boxShadow: '0 14px 30px rgba(255,176,30,.28)' }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', opacity: .72 }}>MY CHAMPION</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Flag name={champion} size={34} />
            <strong className="display" style={{ fontSize: 28 }}>{champion || '—'}</strong>
          </span>
          {runnerUp && <span style={{ fontSize: 12, opacity: .8 }}>def. {runnerUp} in the Final</span>}
        </div>

        {semis.length > 0 && (
          <div>
            <div className="faint" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', marginBottom: 8 }}>MY FINAL FOUR</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {semis.map((s) => (
                <span key={s} className="pill" style={{ gap: 6, fontSize: 11 }}><Flag name={s} size={16} />{s}</span>
              ))}
            </div>
          </div>
        )}

        {userName && <div className="muted" style={{ fontSize: 12, marginTop: 16 }}>— {userName}</div>}
      </div>

      <div style={{ padding: 14, borderTop: '1px solid var(--line)' }}>
        <button className="btn btn-primary" style={{ width: '100%', minHeight: 46, fontSize: 15 }} onClick={share} disabled={busy || !champion}>
          {busy ? 'Preparing image…' : champion ? '📤 Share my bracket (image)' : 'Pick a champion to share'}
        </button>
      </div>
    </div>
  );
}

// ── canvas rendering (with flags) ──
function loadFlag(name: string): Promise<HTMLImageElement | null> {
  const url = flagUrl(name);
  if (!url) return Promise.resolve(null);
  // request the larger asset for crisp drawing
  const big = url.replace('/w40/', '/w160/');
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';       // keeps the canvas untainted (flagcdn sends ACAO:*)
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = big;
  });
}

async function drawShareImage({ champion, runnerUp, semis, userName }: {
  champion: string | null; runnerUp: string | null; semis: string[]; userName?: string | null;
}): Promise<Blob> {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;

  // preload every flag we need (champion + final four)
  const names = Array.from(new Set([champion, ...semis].filter(Boolean))) as string[];
  const flags = new Map<string, HTMLImageElement | null>();
  await Promise.all(names.map(async (n) => flags.set(n, await loadFlag(n))));

  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a140e'); bg.addColorStop(1, '#122017');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 30) { g.fillStyle = [brandGold, brandGreen, '#d8322f'][(x / 30) % 3 | 0]; g.fillRect(x, 0, 10, 10); }

  const center = (text: string, y: number, font: string, color: string) => { g.font = font; g.fillStyle = color; g.textAlign = 'center'; g.fillText(text, W / 2, y); };
  const flagW = 66, flagH = 44;
  // draw a flag centered horizontally at (cx, top); fallback = grey chip
  const drawFlag = (name: string | null, cx: number, top: number) => {
    const img = name ? flags.get(name) : null;
    if (img) g.drawImage(img, cx - flagW / 2, top, flagW, flagH);
    else { g.fillStyle = '#2a3a2f'; g.fillRect(cx - flagW / 2, top, flagW, flagH); }
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2; g.strokeRect(cx - flagW / 2, top, flagW, flagH);
  };

  center('BanglaBracket', 150, '800 64px "Baloo Da 2", system-ui, sans-serif', '#f3f1e6');
  center('WORLD CUP 2026 · MY BRACKET', 200, '800 26px system-ui, sans-serif', '#a3b6a6');

  const plateY = 300, plateH = 360;
  const gp = g.createLinearGradient(0, plateY, 0, plateY + plateH);
  gp.addColorStop(0, '#ffd76a'); gp.addColorStop(1, '#f0a921');
  g.fillStyle = gp; roundRect(g, 120, plateY, W - 240, plateH, 32); g.fill();
  center('MY CHAMPION', plateY + 66, '800 30px system-ui, sans-serif', 'rgba(35,26,5,.7)');
  drawFlag(champion, W / 2, plateY + 92);
  center(champion || '—', plateY + 210, '800 84px "Baloo Da 2", system-ui, sans-serif', goldText);
  if (runnerUp) center(`def. ${runnerUp} in the Final`, plateY + 288, '600 30px system-ui, sans-serif', 'rgba(35,26,5,.8)');

  if (semis.length) {
    center('MY FINAL FOUR', 780, '800 26px system-ui, sans-serif', '#a3b6a6');
    const n = Math.min(4, semis.length);
    const gap = W / (n + 1);
    for (let i = 0; i < n; i++) {
      const cx = gap * (i + 1);
      drawFlag(semis[i], cx, 820);
      g.font = '700 26px system-ui, sans-serif'; g.fillStyle = '#f3f1e6'; g.textAlign = 'center';
      g.fillText(semis[i].length > 12 ? semis[i].slice(0, 11) + '…' : semis[i], cx, 902);
    }
  }

  if (userName) center(`— ${userName}`, H - 130, '600 30px system-ui, sans-serif', '#a3b6a6');
  center('banglabracket.com · Free to play · 18+', H - 70, '600 24px system-ui, sans-serif', '#6f8475');

  return await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('no blob'))), 'image/png'));
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
