import { useEffect, useMemo, useRef, useState } from "react";
import { resolveR32, resolveBracketParticipants } from "@banglabracket/shared";
import { flagUrl } from "../lib/api";
import { toast } from "../lib/feedback";

// ============================================================================
//  Share image — "Layout 1b" (1080×1350 portrait), ONE design × TWO themes.
//  Header (logo + wordmark + user chip) → Champion hero (glow + stars = titles+1
//  + name + label + capsule) → Bracket receipt (R16→Final, per-match manner) →
//  marketing band. All data is dynamic (real champion / picks / manner / flags).
// ============================================================================

interface Props {
	prediction: any;               // { winners, manner }
	base: any;
	remaining: any;
	userName?: string | null;
	submittedAt?: Date | null;
	onClose?: () => void;          // renders submitted-header + close + "Share later" inside the card
}

type ImgTheme = "light" | "dark";

interface Theme {
	bg1: string; bg2: string;
	ink: string; sub: string;
	accent: string; accentText: string; accentSoft: string;
	gold: string;                  // wordmark "Bracket" + stars (brand gold, both themes)
	glow: string;
	boxBg: string; boxLine: string; winTint: string; line: string;
	flagBorder: string;
	chipBg: string; chipLine: string;
	bandBg: string; bandInk: string; bandAccent: string;
}

const THEMES: Record<ImgTheme, Theme> = {
	light: {
		bg1: "#fbf7ea", bg2: "#f0e8d0",
		ink: "#15231b", sub: "#6f8073",
		accent: "#0b7a4b", accentText: "#ffffff", accentSoft: "rgba(11,122,75,0.12)",
		gold: "#f0a921",
		glow: "rgba(240,169,33,0.34)",
		boxBg: "#ffffff", boxLine: "#e3dcc6", winTint: "rgba(11,122,75,0.15)", line: "#d8cfb4",
		flagBorder: "rgba(20,35,27,0.18)",
		chipBg: "#ffffff", chipLine: "#e3dcc6",
		bandBg: "#0b3b28", bandInk: "#ffffff", bandAccent: "#ffd75e",
	},
	dark: {
		bg1: "#0b3b28", bg2: "#07160e",
		ink: "#f6f2e4", sub: "#9db3a3",
		accent: "#ffcb45", accentText: "#231a05", accentSoft: "rgba(255,203,69,0.16)",
		gold: "#ffcb45",
		glow: "rgba(255,203,69,0.32)",
		boxBg: "rgba(255,255,255,0.05)", boxLine: "rgba(255,255,255,0.15)", winTint: "rgba(255,203,69,0.18)", line: "rgba(255,255,255,0.16)",
		flagBorder: "rgba(255,255,255,0.30)",
		chipBg: "rgba(255,255,255,0.06)", chipLine: "rgba(255,255,255,0.16)",
		bandBg: "#ffcb45", bandInk: "#231a05", bandAccent: "#0b3b28",
	},
};

// World Cup titles per nation (base). Champion shows titles + 1 stars (min 1).
const WC_TITLES: Record<string, number> = {
	Brazil: 5, Germany: 4, Italy: 4, Argentina: 3, France: 2, Uruguay: 2, England: 1, Spain: 1,
};
const starsFor = (name: string | null) => ((name && WC_TITLES[name]) || 0) + 1;

// Receipt = R16 → Final. 8 R16 matches (16 teams) → 4 QF → 2 SF → 1 Final.
const LEFT_R16 = [89, 90, 93, 94];
const RIGHT_R16 = [91, 92, 95, 96];
const FEEDERS: Record<number, [number, number]> = {
	97: [89, 90], 98: [93, 94], 101: [97, 98],
	99: [91, 92], 100: [95, 96], 102: [99, 100],
	104: [101, 102],
};
const RECEIPT_MATCHES = [89, 90, 93, 94, 91, 92, 95, 96, 97, 98, 99, 100, 101, 102, 104];

export function ShareCard({ prediction, base, remaining, userName, submittedAt, onClose }: Props) {
	const [busy, setBusy] = useState(false);
	const [imgTheme, setImgTheme] = useState<ImgTheme>("dark");
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const blobRef = useRef<Blob | null>(null);

	const winners: Record<number, string> = prediction?.winners || {};
	const manner: Record<number, string> = prediction?.manner || {};
	const champion = winners[104] || null;
	const stamp = submittedAt ? submittedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : undefined;

	const participants = useMemo(() => {
		const r32 = resolveR32(base || {}, remaining || {}, {});
		return resolveBracketParticipants(r32 as any, winners);
	}, [base, remaining, winners]);

	// Everything the canvas needs, resolved from the user's entry + tournament.
	const data = useMemo<ShareData>(() => {
		const receipt: Record<number, ReceiptMatch> = {};
		for (const m of RECEIPT_MATCHES) {
			const p = (participants as any)[m] || { A: null, B: null };
			receipt[m] = { A: p.A ?? null, B: p.B ?? null, pick: winners[m] ?? null, manner: (manner[m] as any) ?? null };
		}
		const initial = (userName || "You").trim()[0]?.toUpperCase() || "Y";
		return { champion, receipt, userName: userName || null, timestamp: stamp || null, initial };
	}, [participants, winners, manner, champion, userName, stamp]);

	// Generate the preview (and cache the blob for sharing) whenever theme / data change.
	useEffect(() => {
		if (!champion) { setPreviewUrl(null); blobRef.current = null; return; }
		let alive = true;
		let url: string | null = null;
		drawShareImage(data, THEMES[imgTheme]).then((blob) => {
			if (!alive) return;
			blobRef.current = blob;
			url = URL.createObjectURL(blob);
			setPreviewUrl(url);
		}).catch(() => { /* keep previous preview */ });
		return () => { alive = false; if (url) URL.revokeObjectURL(url); };
	}, [imgTheme, data, champion]);

	async function share() {
		setBusy(true);
		try {
			const blob = blobRef.current || await drawShareImage(data, THEMES[imgTheme]);
			const file = new File([blob], "banglabracket-bracket.png", { type: "image/png" });
			const navAny = navigator as any;
			if (navAny.share && navAny.canShare?.({ files: [file] })) {
				await navAny.share({ files: [file], title: "My BanglaBracket", text: "My World Cup 2026 bracket" });
			} else {
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url; a.download = "banglabracket-bracket.png";
				document.body.appendChild(a); a.click(); a.remove();
				setTimeout(() => URL.revokeObjectURL(url), 1000);
				toast("Bracket image downloaded");
			}
		} catch {
			toast("Could not create the image", "error");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="card" style={{ padding: 0, overflow: "hidden" }}>
			{onClose && (
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
					<strong style={{ fontSize: 16 }}>Bracket submitted ✓</strong>
					<button onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--line)", background: "var(--surface2)", color: "var(--ink)", cursor: "pointer", fontSize: 18, lineHeight: 1, flex: "0 0 auto" }}>×</button>
				</div>
			)}

			<div style={{ padding: 14 }}>
				{/* Theme toggle — the selected theme is what gets exported/shared */}
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
					<span className="faint" style={{ fontSize: 12, fontWeight: 700 }}>Card theme</span>
					<div className="bb-viewtoggle">
						<button data-active={imgTheme === "light"} onClick={() => setImgTheme("light")}>☀ Light</button>
						<button data-active={imgTheme === "dark"} onClick={() => setImgTheme("dark")}>☾ Dark</button>
					</div>
				</div>

				{/* WYSIWYG preview of the exact PNG that will be shared */}
				<div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--line)", background: "var(--surface2)", aspectRatio: "1080 / 1350", display: "flex", alignItems: "center", justifyContent: "center" }}>
					{previewUrl
						? <img src={previewUrl} alt="Share preview" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
						: <span className="muted" style={{ fontSize: 13 }}>{champion ? "Generating preview…" : "Pick a champion to share"}</span>}
				</div>
			</div>

			<div style={{ padding: 14, borderTop: "1px solid var(--line)", display: "grid", gap: 8 }}>
				<button className="btn btn-primary" style={{ width: "100%", minHeight: 46, fontSize: 15 }} onClick={share} disabled={busy || !champion}>
					{busy ? "Preparing image…" : champion ? "📤 Share my bracket (image)" : "Pick a champion to share"}
				</button>
				{onClose && (
					<button className="btn" style={{ width: "100%", minHeight: 42, fontSize: 14 }} onClick={onClose}>
						Share later — close
					</button>
				)}
			</div>
		</div>
	);
}

// ============================================================================
//  Canvas rendering
// ============================================================================
type Manner = "FT" | "ET" | "PEN";
interface ReceiptMatch { A: string | null; B: string | null; pick: string | null; manner: Manner | null }
interface ShareData {
	champion: string | null;
	receipt: Record<number, ReceiptMatch>;
	userName: string | null;
	timestamp: string | null;
	initial: string;
}

// Module-level flag cache so toggling the theme never re-downloads the ~16 flags.
const flagCache = new Map<string, HTMLImageElement | null>();
function loadFlag(name: string): Promise<HTMLImageElement | null> {
	if (flagCache.has(name)) return Promise.resolve(flagCache.get(name)!);
	const url = flagUrl(name);
	if (!url) { flagCache.set(name, null); return Promise.resolve(null); }
	const big = url.replace("/w40/", "/w160/");   // crisp asset; flagcdn sends ACAO:* → untainted
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => { flagCache.set(name, img); resolve(img); };
		img.onerror = () => { flagCache.set(name, null); resolve(null); };
		img.src = big;
	});
}

const DISPLAY = '"Baloo Da 2", system-ui, sans-serif';   // Latin + Bengala glyphs
const UI = 'system-ui, "Segoe UI", sans-serif';
const W = 1080, H = 1350;
const BOX_W = 104, FINAL_W = 152, MX = 40, COL_STEP = 120;

async function drawShareImage(data: ShareData, th: Theme): Promise<Blob> {
	const c = document.createElement("canvas");
	c.width = W; c.height = H;
	const g = c.getContext("2d")!;

	// CRITICAL: preload EVERY flag (champion + all receipt teams) and await them
	// ALL before drawing, so none render blank and the canvas stays untainted.
	const names = new Set<string>();
	if (data.champion) names.add(data.champion);
	for (const m of RECEIPT_MATCHES) { const r = data.receipt[m]; if (r?.A) names.add(r.A); if (r?.B) names.add(r.B); }
	const flags = new Map<string, HTMLImageElement | null>();
	await Promise.all([...names].map(async (n) => flags.set(n, await loadFlag(n))));
	try { await (document as any).fonts?.ready; } catch { /* fall back to system fonts */ }

	// ── background ──
	const bg = g.createLinearGradient(0, 0, 0, H);
	bg.addColorStop(0, th.bg1); bg.addColorStop(1, th.bg2);
	g.fillStyle = bg; g.fillRect(0, 0, W, H);

	const text = (t: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "center") => {
		g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = "alphabetic"; g.fillText(t, x, y);
	};
	const drawFlagAt = (name: string | null, x: number, y: number, w: number, h: number, radius = 4) => {
		const img = name ? flags.get(name) : null;
		g.save();
		roundRect(g, x, y, w, h, radius); g.clip();
		if (img) g.drawImage(img, x, y, w, h);
		else { g.fillStyle = "#8a9990"; g.fillRect(x, y, w, h); }
		g.restore();
		roundRect(g, x, y, w, h, radius); g.strokeStyle = th.flagBorder; g.lineWidth = Math.max(1, w * 0.02); g.stroke();
	};

	// ── 1) HEADER ──
	drawLogo(g, 40, 42, 62);
	text("BanglaBracket".slice(0, 6), 118, 74, `800 34px ${DISPLAY}`, th.ink, "left");
	const bw = g.measureText("Bangla").width;
	text("Bracket", 118 + bw, 74, `800 34px ${DISPLAY}`, th.gold, "left");
	text("FIFA World Cup 2026", 118, 100, `700 18px ${UI}`, th.sub, "left");

	// user chip (top-right): avatar initial + name + submitted date
	if (data.userName || data.timestamp) {
		const cy = 66, r = 22, rightX = W - 40;
		g.textAlign = "right";
		if (data.userName) text(data.userName.length > 20 ? data.userName.slice(0, 19) + "…" : data.userName, rightX - 56, 60, `700 20px ${UI}`, th.ink, "right");
		if (data.timestamp) text(data.timestamp, rightX - 56, 84, `600 15px ${UI}`, th.sub, "right");
		const ax = rightX - 22;
		g.beginPath(); g.arc(ax, cy, r, 0, Math.PI * 2); g.fillStyle = th.accent; g.fill();
		text(data.initial, ax, cy + 7, `800 22px ${UI}`, th.accentText, "center");
	}

	// ── 2) CHAMPION HERO ──
	const heroCx = W / 2;
	const flagW = 210, flagH = 140, flagTop = 236, flagCy = flagTop + flagH / 2;

	// soft radial glow behind the flag
	const glow = g.createRadialGradient(heroCx, flagCy, 20, heroCx, flagCy, 240);
	glow.addColorStop(0, th.glow); glow.addColorStop(1, "rgba(0,0,0,0)");
	g.fillStyle = glow; g.fillRect(heroCx - 300, flagCy - 260, 600, 520);

	// stars = titles + 1
	const nStars = starsFor(data.champion);
	const sr = 15, sgap = sr * 2.5;
	const sTotal = (nStars - 1) * sgap;
	for (let i = 0; i < nStars; i++) drawStar(g, heroCx - sTotal / 2 + i * sgap, 196, sr, th.gold);

	// champion flag (with shadow)
	g.save();
	g.shadowColor = "rgba(0,0,0,0.35)"; g.shadowBlur = 30; g.shadowOffsetY = 12;
	drawFlagAt(data.champion, heroCx - flagW / 2, flagTop, flagW, flagH, 12);
	g.restore();

	// champion name (fit to width)
	const name = data.champion || "—";
	const nameSize = fitFont(g, name, 900, 84, 800, DISPLAY);
	text(name, heroCx, flagTop + flagH + nameSize + 8, `800 ${nameSize}px ${DISPLAY}`, th.ink);

	// label CHAMPION / Bengali
	const labelY = flagTop + flagH + nameSize + 46;
	text("CHAMPION · আমার চ্যাম্পিয়ন", heroCx, labelY, `800 22px ${DISPLAY}`, th.accent);

	// "Think you can beat my bracket?" capsule
	const capText = "Think you can beat my bracket?";
	g.font = `800 24px ${DISPLAY}`;
	const capW = g.measureText(capText).width + 56, capH = 54, capY = labelY + 26;
	roundRect(g, heroCx - capW / 2, capY, capW, capH, capH / 2);
	g.fillStyle = th.accent; g.fill();
	text(capText, heroCx, capY + 35, `800 24px ${DISPLAY}`, th.accentText);

	// ── 3) BRACKET RECEIPT (R16 → Final) ──
	text("MY BRACKET · ROUND OF 16 → FINAL", heroCx, 664, `800 18px ${UI}`, th.sub);

	const yy: Record<number, number> = {};
	const Rtop = 690, Rbot = 1152, pitch = (Rbot - Rtop) / 4;
	LEFT_R16.forEach((m, i) => yy[m] = Rtop + pitch * i + pitch / 2);
	RIGHT_R16.forEach((m, i) => yy[m] = Rtop + pitch * i + pitch / 2);
	[97, 98, 99, 100, 101, 102].forEach((m) => yy[m] = (yy[FEEDERS[m][0]] + yy[FEEDERS[m][1]]) / 2);
	yy[104] = (yy[101] + yy[102]) / 2;

	const boxXOf = (m: number): number => {
		if (LEFT_R16.includes(m)) return MX;
		if (m === 97 || m === 98) return MX + COL_STEP;
		if (m === 101) return MX + 2 * COL_STEP;
		if (RIGHT_R16.includes(m)) return W - MX - BOX_W;
		if (m === 99 || m === 100) return W - MX - BOX_W - COL_STEP;
		if (m === 102) return W - MX - BOX_W - 2 * COL_STEP;
		return W / 2 - FINAL_W / 2;   // 104
	};
	const boxWOf = (m: number) => (m === 104 ? FINAL_W : BOX_W);

	// connectors (drawn first, under the boxes)
	g.strokeStyle = th.line; g.lineWidth = 2;
	for (const p of [97, 98, 99, 100, 101, 102, 104]) {
		const px = boxXOf(p), pw = boxWOf(p);
		for (const cm of FEEDERS[p]) {
			const cx = boxXOf(cm);
			const x1 = cx < px ? cx + BOX_W : cx;
			const x2 = cx < px ? px : px + pw;
			const mx = (x1 + x2) / 2;
			g.beginPath(); g.moveTo(x1, yy[cm]); g.lineTo(mx, yy[cm]); g.lineTo(mx, yy[p]); g.lineTo(x2, yy[p]); g.stroke();
		}
	}

	for (const m of RECEIPT_MATCHES) drawMatchBox(g, th, flags, m, boxXOf(m), yy[m], boxWOf(m), data.receipt[m]);

	// ── 4) MARKETING BAND ──
	const bandTop = 1176;
	g.fillStyle = th.bandBg; g.fillRect(0, bandTop, W, H - bandTop);
	text("WIN · FREE TO PLAY · ৳1,00,000", heroCx, bandTop + 46, `800 34px ${DISPLAY}`, th.bandInk);
	text("No entry fee · Pick all 32, climb the leaderboard", heroCx, bandTop + 82, `600 20px ${UI}`, th.bandInk);
	text("তুমিও খেলো!", heroCx, bandTop + 122, `800 28px ${DISPLAY}`, th.bandAccent);
	text("banglabracket.com", heroCx, bandTop + 160, `800 30px ${UI}`, th.bandInk);

	return await new Promise<Blob>((resolve, reject) =>
		c.toBlob((b) => (b ? resolve(b) : reject(new Error("no blob"))), "image/png"),
	);
}

// One receipt match: two team flags (winner highlighted = pick advancing) + manner marker.
function drawMatchBox(
	g: CanvasRenderingContext2D, th: Theme, flags: Map<string, HTMLImageElement | null>,
	m: number, x: number, cy: number, bw: number, r: ReceiptMatch | undefined,
) {
	const bh = m === 104 ? 62 : 52;
	const top = cy - bh / 2;
	roundRect(g, x, top, bw, bh, 10); g.fillStyle = th.boxBg; g.fill();
	g.strokeStyle = th.boxLine; g.lineWidth = 1.5; g.stroke();
	if (!r) return;

	const rowH = (bh - 8) / 2;
	const fw = m === 104 ? 38 : 32, fh = m === 104 ? 25 : 21;
	const teams = [r.A, r.B];
	teams.forEach((team, idx) => {
		const rtop = top + 4 + idx * rowH;
		const isWin = !!r.pick && team === r.pick;
		if (isWin) { roundRect(g, x + 2, rtop, bw - 4, rowH - 1, 6); g.fillStyle = th.winTint; g.fill(); }
		const fx = x + 9, fy = rtop + (rowH - fh) / 2;
		g.globalAlpha = team ? (r.pick && !isWin ? 0.5 : 1) : 1;
		const img = team ? flags.get(team) : null;
		g.save(); roundRect(g, fx, fy, fw, fh, 3); g.clip();
		if (img) g.drawImage(img, fx, fy, fw, fh); else { g.fillStyle = "#8a9990"; g.fillRect(fx, fy, fw, fh); }
		g.restore();
		roundRect(g, fx, fy, fw, fh, 3); g.strokeStyle = th.flagBorder; g.lineWidth = 1; g.stroke();
		g.globalAlpha = 1;
	});

	// manner marker (single clean letter): F / E / P
	if (r.manner) {
		const letter = r.manner === "PEN" ? "P" : r.manner === "ET" ? "E" : "F";
		const bx = x + bw - 18, by = cy;
		g.beginPath(); g.arc(bx, by, 11, 0, Math.PI * 2); g.fillStyle = th.accent; g.fill();
		g.font = `800 13px ${UI}`; g.fillStyle = th.accentText; g.textAlign = "center"; g.textBaseline = "middle";
		g.fillText(letter, bx, by + 0.5);
		g.textBaseline = "alphabetic";
	}
}

// BanglaBracket LogoMark → canvas (gold rounded square + bracket glyph + play arrow).
function drawLogo(g: CanvasRenderingContext2D, x: number, y: number, size: number) {
	roundRect(g, x, y, size, size, size * 0.28);
	const grad = g.createLinearGradient(x, y, x + size, y + size);
	grad.addColorStop(0, "#ffd45f"); grad.addColorStop(1, "#e8ab1f");
	g.fillStyle = grad; g.fill();
	const inner = size * 0.69, off = (size - inner) / 2, s = inner / 48;
	g.save();
	g.translate(x + off, y + off); g.scale(s, s);
	g.strokeStyle = "#1a1405"; g.lineWidth = 3.2; g.lineCap = "round"; g.lineJoin = "round";
	g.stroke(new Path2D("M4 6H14M4 18H14M4 30H14M4 42H14M14 6V18M14 30V42M14 12H24M14 36H24M24 12V36M24 24H34"));
	g.fillStyle = "#1a1405"; g.fill(new Path2D("M39 19 44 24 39 29 34 24Z"));
	g.restore();
}

function drawStar(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
	g.beginPath();
	for (let i = 0; i < 10; i++) {
		const rad = i % 2 === 0 ? r : r * 0.44;
		const a = -Math.PI / 2 + (i * Math.PI) / 5;
		const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
		i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
	}
	g.closePath(); g.fillStyle = color; g.fill();
}

function fitFont(g: CanvasRenderingContext2D, t: string, maxW: number, base: number, weight: number, family: string): number {
	let s = base; g.font = `${weight} ${s}px ${family}`;
	while (g.measureText(t).width > maxW && s > 28) { s -= 3; g.font = `${weight} ${s}px ${family}`; }
	return s;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	const rr = Math.min(r, w / 2, h / 2);
	g.beginPath();
	g.moveTo(x + rr, y);
	g.arcTo(x + w, y, x + w, y + h, rr);
	g.arcTo(x + w, y + h, x, y + h, rr);
	g.arcTo(x, y + h, x, y, rr);
	g.arcTo(x, y, x + w, y, rr);
	g.closePath();
}
