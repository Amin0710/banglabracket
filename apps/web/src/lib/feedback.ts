// Premium, self-contained feedback: corner toasts + a confirm modal.
// No provider/wiring needed — just import { toast, confirmDialog }.
// Uses the app's CSS variables so it matches light/dark automatically.

type ToastKind = "success" | "error" | "info";

function container(): HTMLElement {
	let el = document.getElementById("bb-toasts");
	if (!el) {
		el = document.createElement("div");
		el.id = "bb-toasts";
		el.style.cssText =
			"position:fixed;top:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:10px;max-width:min(360px,92vw);pointer-events:none";
		document.body.appendChild(el);
	}
	return el;
}

const ICONS: Record<ToastKind, string> = {
	success:
		'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
	error:
		'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
	info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 16v-5M12 8h.01"/><circle cx="12" cy="12" r="9"/></svg>',
};
const ACCENT: Record<ToastKind, string> = {
	success: "var(--green)",
	error: "var(--bad)",
	info: "var(--gold)",
};

export function toast(message: string, kind: ToastKind = "success", ms = 3500) {
	const root = container();
	const card = document.createElement("div");
	card.style.cssText =
		`pointer-events:auto;display:flex;align-items:center;gap:11px;padding:13px 15px;border-radius:14px;` +
		`background:var(--surface);color:var(--ink);border:1px solid var(--line);` +
		`border-left:4px solid ${ACCENT[kind]};box-shadow:0 18px 40px -16px rgba(20,35,27,.35);` +
		`font-family:'Hanken Grotesk',system-ui,sans-serif;font-size:14px;font-weight:600;` +
		`transform:translateX(120%);transition:transform .28s cubic-bezier(.2,.9,.3,1),opacity .28s;opacity:0`;
	card.innerHTML = `<span style="color:${ACCENT[kind]};display:flex;flex:0 0 auto">${ICONS[kind]}</span><span style="flex:1">${message}</span>`;
	root.appendChild(card);
	requestAnimationFrame(() => {
		card.style.transform = "translateX(0)";
		card.style.opacity = "1";
	});
	const close = () => {
		card.style.transform = "translateX(120%)";
		card.style.opacity = "0";
		setTimeout(() => card.remove(), 300);
	};
	card.addEventListener("click", close);
	setTimeout(close, ms);
}

// ---- Legal modal (Terms / Privacy) ----
const LEGAL_CONTENT = {
	terms: {
		title: "Terms of Play",
		html: `
      <p><b>Free to play.</b> BanglaBracket is a free prediction game for the 2026 World Cup. No entry fee, no purchase, no card required.</p>
      <p><b>Eligibility.</b> Prizes are for Bangladeshi nationals (by nationality, not residence) aged 18+. You can play and win from anywhere in the world. Winners must verify their identity before prizes are paid.</p>
      <p><b>Winners on the Wall &amp; social media.</b> If you appear on the leaderboard or win, your <b>display name and profile photo may be shown publicly</b> on the Winners Wall and shared by BanglaBracket on social media to announce results and winners. By playing, you consent to this use of your name and image for these purposes.</p>
      <p><b>Admin decisions.</b> All admin decisions are final. BanglaBracket may withhold or reallocate any prize — including paying the next eligible player — at its sole discretion and without explanation, including where cheating or multiple/fake accounts are suspected. We are not obligated to disclose our reasoning.</p>
      <p><b>Fair play.</b> One account per person. Multiple, fake, or automated accounts may be disqualified. The bracket locks at the first Round-of-32 kick-off; picks are final after lock.</p>
      <p><b>Prizes.</b> The grand prize is ৳1,00,000 for the top of the points leaderboard. Additional cash rewards are paid for exact knockout scorelines. Prize details may be updated before lock; the current rules in-app govern.</p>
      <p><b>Not affiliated</b> with FIFA or any official body. Play responsibly. 18+.</p>`,
	},
	privacy: {
		title: "Privacy Policy",
		html: `
      <p><b>What we collect.</b> Your name, email and/or phone, the bracket picks you make, and — only if you choose to verify — your nationality status. We never store images of your ID.</p>
      <p><b>How we use it.</b> Only to run the game: sign you in, score your bracket, rank the leaderboard, and contact winners. We do not sell your data.</p>
      <p><b>Public display.</b> Your display name and profile photo may appear publicly on the leaderboard and Winners Wall, and may be shared by BanglaBracket on social media if you rank highly or win (see Terms).</p>
      <p><b>Security.</b> Sensitive data is encrypted. Sessions use secure cookies.</p>
      <p><b>Your choices.</b> You can request deletion of your account and data any time via <a href="mailto:data.delete@banglabracket.com" style="color:var(--green)">data.delete@banglabracket.com</a>.</p>`,
	},
	deletion: {
		title: "Data Deletion",
		html: `
      <p><b>How to delete your data.</b> To request deletion of your BanglaBracket account and all associated data, email <a href="mailto:data.delete@banglabracket.com" style="color:var(--green)">data.delete@banglabracket.com</a> with the subject line <b>"Delete my account"</b>. Please include the name or email address linked to your account.</p>
      <p><b>What we delete.</b> We will permanently delete your profile (name, phone, email), your bracket picks, your score history, and any verification data we hold. We will process your request within 30 days.</p>
      <p><b>Note.</b> If you have won a prize, we retain minimal records required by law or for prize payment purposes until those obligations are fulfilled.</p>`,
	},
} as const;

export type LegalKey = keyof typeof LEGAL_CONTENT;

export function showLegal(key: LegalKey) {
	const content = LEGAL_CONTENT[key];
	const overlay = document.createElement("div");
	overlay.style.cssText =
		"position:fixed;inset:0;z-index:10001;background:rgba(8,16,11,.55);backdrop-filter:blur(4px);" +
		"display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .2s";
	const box = document.createElement("div");
	box.style.cssText =
		"width:100%;max-width:640px;max-height:84vh;overflow:auto;background:var(--surface);color:var(--ink);" +
		"border:1px solid var(--line);border-radius:20px;box-shadow:0 40px 90px -30px rgba(0,0,0,.6);" +
		"font-family:'Hanken Grotesk',system-ui,sans-serif;transform:scale(.97);transition:transform .2s";
	box.innerHTML =
		`<div style="position:sticky;top:0;background:var(--surface);display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--line)">` +
		`<div style="font-family:'Baloo Da 2';font-weight:800;font-size:22px;color:var(--ink)">${content.title}</div>` +
		`<button id="bb-legal-x" aria-label="Close" style="width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:var(--surface2);color:var(--ink);cursor:pointer;font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center">×</button>` +
		`</div>` +
		`<div style="padding:24px;color:var(--muted);font-size:14.5px;line-height:1.7">${content.html}</div>`;
	overlay.appendChild(box);
	document.body.appendChild(overlay);
	requestAnimationFrame(() => {
		overlay.style.opacity = "1";
		box.style.transform = "scale(1)";
	});
	const close = () => {
		overlay.style.opacity = "0";
		box.style.transform = "scale(.97)";
		setTimeout(() => overlay.remove(), 200);
	};
	box.querySelector("#bb-legal-x")!.addEventListener("click", close);
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) close();
	});
	document.addEventListener("keydown", function onKey(e) {
		if (e.key === "Escape") {
			close();
			document.removeEventListener("keydown", onKey);
		}
	});
}

// Promise-based confirm modal (replaces window.confirm).
export function confirmDialog(opts: {
	title?: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	danger?: boolean;
}): Promise<boolean> {
	return new Promise((resolve) => {
		const overlay = document.createElement("div");
		overlay.style.cssText =
			"position:fixed;inset:0;z-index:10000;background:rgba(8,16,11,.5);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .2s";
		const box = document.createElement("div");
		box.style.cssText =
			`width:100%;max-width:400px;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:18px;` +
			`box-shadow:0 30px 70px -20px rgba(0,0,0,.5);padding:22px;font-family:'Hanken Grotesk',system-ui,sans-serif;` +
			`transform:scale(.96);transition:transform .2s`;
		const accent = opts.danger ? "var(--bad)" : "var(--green)";
		box.innerHTML =
			`${opts.title ? `<div style="font-family:'Baloo Da 2';font-weight:800;font-size:19px;margin-bottom:6px">${opts.title}</div>` : ""}` +
			`<div style="color:var(--muted);font-size:15px;line-height:1.5">${opts.message}</div>` +
			`<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">` +
			`<button id="bb-cancel" style="padding:10px 16px;border-radius:11px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-weight:600;cursor:pointer;font-family:inherit">${opts.cancelText || "Cancel"}</button>` +
			`<button id="bb-ok" style="padding:10px 16px;border-radius:11px;border:none;background:${accent};color:#fff;font-weight:700;cursor:pointer;font-family:inherit">${opts.confirmText || "Confirm"}</button>` +
			`</div>`;
		overlay.appendChild(box);
		document.body.appendChild(overlay);
		requestAnimationFrame(() => {
			overlay.style.opacity = "1";
			box.style.transform = "scale(1)";
		});
		const done = (v: boolean) => {
			overlay.style.opacity = "0";
			setTimeout(() => overlay.remove(), 200);
			resolve(v);
		};
		box.querySelector("#bb-ok")!.addEventListener("click", () => done(true));
		box
			.querySelector("#bb-cancel")!
			.addEventListener("click", () => done(false));
		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) done(false);
		});
	});
}
