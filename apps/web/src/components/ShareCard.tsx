import { useMemo, useState } from 'react';
import { resolveR32, resolveBracketParticipants } from '@banglabracket/shared';
import { Flag } from './ui';
import { toast } from '../lib/feedback';

// Post-lock recap / share card. Champion centered, the user's completed bracket
// path, and BanglaBracket branding. "Share my bracket" renders a downloadable PNG.
//
// NOTE: the downloadable PNG is drawn on a <canvas> as text + brand marks (no
// external flag images) so the export can never be tainted/blocked by CORS. The
// on-screen preview below still shows flags. (Flagged in the summary.)

interface Props {
  prediction: any;                 // entry.prediction
  base: any; remaining: any;       // tournament base/remaining (resolve actual R32 slots)
  userName?: string | null;
}

const brandGreen = '#0b7a4b';
const brandGold = '#ffcb45';
const goldText = '#231a05';

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
      // Prefer the native share sheet (mobile) when it can carry the file.
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
      {/* Preview */}
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
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={share} disabled={busy || !champion}>
          {busy ? 'Preparing…' : champion ? '📤 Share my bracket' : 'Pick a champion to share'}
        </button>
      </div>
    </div>
  );
}

// Draw the shareable PNG on a canvas (text + brand marks only — CORS-safe).
async function drawShareImage({ champion, runnerUp, semis, userName }: {
  champion: string | null; runnerUp: string | null; semis: string[]; userName?: string | null;
}): Promise<Blob> {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;

  // background
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a140e'); bg.addColorStop(1, '#122017');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);

  // top accent stripes
  for (let x = 0; x < W; x += 30) {
    g.fillStyle = [brandGold, brandGreen, '#d8322f'][(x / 30) % 3 | 0];
    g.fillRect(x, 0, 10, 10);
  }

  const center = (text: string, y: number, font: string, color: string) => {
    g.font = font; g.fillStyle = color; g.textAlign = 'center';
    g.fillText(text, W / 2, y);
  };

  center('BanglaBracket', 150, '800 64px "Baloo Da 2", system-ui, sans-serif', '#f3f1e6');
  center('WORLD CUP 2026 · MY BRACKET', 200, '800 26px system-ui, sans-serif', '#a3b6a6');

  // champion gold plate
  const plateY = 300, plateH = 340;
  const gp = g.createLinearGradient(0, plateY, 0, plateY + plateH);
  gp.addColorStop(0, '#ffd76a'); gp.addColorStop(1, '#f0a921');
  g.fillStyle = gp;
  roundRect(g, 120, plateY, W - 240, plateH, 32); g.fill();
  center('MY CHAMPION', plateY + 70, '800 30px system-ui, sans-serif', 'rgba(35,26,5,.7)');
  center(champion || '—', plateY + 180, '800 92px "Baloo Da 2", system-ui, sans-serif', goldText);
  if (runnerUp) center(`def. ${runnerUp} in the Final`, plateY + 260, '600 30px system-ui, sans-serif', 'rgba(35,26,5,.8)');

  // final four
  if (semis.length) {
    center('MY FINAL FOUR', 760, '800 26px system-ui, sans-serif', '#a3b6a6');
    g.font = '700 34px system-ui, sans-serif'; g.fillStyle = '#f3f1e6'; g.textAlign = 'center';
    semis.slice(0, 4).forEach((s, i) => g.fillText(s, W / 2, 820 + i * 58));
  }

  if (userName) center(`— ${userName}`, H - 130, '600 30px system-ui, sans-serif', '#a3b6a6');
  center('banglabracket.com · Free to play · 18+', H - 70, '600 24px system-ui, sans-serif', '#6f8475');

  return await new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('no blob'))), 'image/png'));
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
