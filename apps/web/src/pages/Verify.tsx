import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/Providers";
import { PageHeader } from "../components/ui";
import { showLegal } from "../lib/feedback";

function LegalLinks({ align = "left" }: { align?: "left" | "center" }) {
	return (
		<div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start" }}>
			<button className="bb-legal-link" onClick={() => showLegal("terms")}>Terms</button>
			<button className="bb-legal-link" onClick={() => showLegal("privacy")}>Privacy</button>
			<button className="bb-legal-link" onClick={() => showLegal("deletion")}>Data deletion</button>
		</div>
	);
}

export default function Verify() {
	const { user } = useAuth();
	const [idType, setIdType] = useState<"nid" | "passport" | "birth_certificate">("nid");
	const [idName, setIdName] = useState("");
	const [idNumber, setIdNumber] = useState("");
	const [dob, setDob] = useState("");
	const [msg, setMsg] = useState("");
	const [busy, setBusy] = useState(false);
	if (!user) return null;

	async function submit() {
		setBusy(true);
		setMsg("");
		try {
			await api.put("/api/me/id", { idType, idNumber, idName: idName || undefined, dob: dob || undefined });
			setMsg("ok");
		} catch (e: any) {
			setMsg(e.message === "id_already_used" ? "used" : "err");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div style={{ paddingBottom: 40 }}>
			<PageHeader title="Verify ID" subtitle="Play now, verify later — only winners need it" />

			{/* What's required to be prize-eligible */}
			<div className="card" style={{ padding: 20, marginBottom: 16, borderColor: "var(--gold)" }}>
				<strong style={{ fontSize: 17 }}>To be eligible for a prize, verify BOTH ways</strong>
				<div style={{ display: "grid", gap: 10, marginTop: 12 }}>
					<div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
						<span className="bb-verify-num">1</span>
						<div><strong>Send an ID image</strong> — email a photo of your NID / passport (+ a selfie) with your code below.</div>
					</div>
					<div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
						<span className="bb-verify-num">2</span>
						<div><strong>Reserve your ID details</strong> — submit your name + ID number in the app (no image). This reserves your ID to your account so nobody else can claim it.</div>
					</div>
				</div>
				<p className="muted" style={{ fontSize: 14, marginTop: 14, marginBottom: 0, lineHeight: 1.6 }}>
					<strong style={{ color: "var(--ink)" }}>Deadline:</strong> at least <strong>one</strong> of the two must be submitted before the{" "}
					<strong>3rd Round-of-16 match finishes</strong>. The other can follow after. Eligibility is by{" "}
					<strong>nationality</strong> — Bangladeshi nationals can win from anywhere.
				</p>
			</div>

			{/* Verification code */}
			<div className="card" style={{ padding: 22, marginBottom: 16 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
					<span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--greenSoft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
						<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
							<path d="M9 12l2 2 4-4" />
						</svg>
					</span>
					<div>
						<strong style={{ fontSize: 18 }}>Send this code with your ID image</strong>
						<div className="muted" style={{ fontSize: 14 }}>Method 1 of 2</div>
					</div>
				</div>
				<div className="card" style={{ background: "var(--surface2)", padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
					<div>
						<div className="faint" style={{ fontSize: 11, fontWeight: 700 }}>SEND THIS CODE</div>
						<code style={{ fontSize: 22, fontWeight: 800, letterSpacing: "1px" }}>{user.verificationCode}</code>
					</div>
					<button className="btn btn-primary" onClick={() => { navigator.clipboard?.writeText(user.verificationCode || ""); }}>Copy code</button>
				</div>
				{user.verified && (
					<p style={{ color: "var(--green)", marginTop: 12 }}>✓ You are verified{user.prizeEligible ? " and prize-eligible." : "."}</p>
				)}
			</div>

			<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
				<div className="card" style={{ padding: 18 }}>
					<strong>How to send your ID · 2 min</strong>
					<ol className="muted" style={{ paddingLeft: 18, marginTop: 10, lineHeight: 1.7 }}>
						<li>Copy your code above.</li>
						<li>Email it to <strong>verify@banglabracket.com</strong>.</li>
						<li>Attach a photo of your <strong>NID / passport</strong> + a selfie, with your code.</li>
						<li>We verify you before the deadline.</li>
					</ol>
				</div>

				<div className="card" style={{ padding: 18 }}>
					<strong>Reserve your ID details</strong>
					<div className="muted" style={{ fontSize: 13 }}>Method 2 of 2 · no image needed</div>
					<p className="faint" style={{ fontSize: 13, marginTop: 6 }}>Stored encrypted. Reserves your name + ID so nobody else can claim it.</p>
					<div style={{ display: "grid", gap: 8 }}>
						<select className="input" value={idType} onChange={(e) => setIdType(e.target.value as any)}>
							<option value="nid">National ID (NID)</option>
							<option value="passport">Passport</option>
							<option value="birth_certificate">Birth certificate</option>
						</select>
						<input className="input" placeholder="Full name (as on ID)" value={idName} onChange={(e) => setIdName(e.target.value)} />
						<input className="input" placeholder="ID number" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
						<input className="input" placeholder="Date of birth (optional)" value={dob} onChange={(e) => setDob(e.target.value)} />
						<button className="btn btn-primary" onClick={submit} disabled={busy || idNumber.length < 3}>Submit ID details</button>
						{msg === "ok" && <div style={{ color: "var(--green)", fontSize: 14 }}>Reserved. Now email your code + photos to finish (or do that later).</div>}
						{msg === "used" && <div style={{ color: "var(--bad)", fontSize: 14 }}>That ID is already linked to another account.</div>}
						{msg === "err" && <div style={{ color: "var(--bad)", fontSize: 14 }}>Something went wrong.</div>}
					</div>
				</div>
			</div>

			<p className="faint" style={{ marginTop: 14, fontSize: 13 }}>
				🔒 No uploads in the app. We store only your verification status — your ID is sent by email for the check, never kept in our database.
			</p>

			{/* Legal links — on this page (people about to verify want them) */}
			<div style={{ marginTop: 12, marginBottom: 4 }}>
				<div className="faint" style={{ fontSize: 12, marginBottom: 6 }}>Before you verify, review:</div>
				<LegalLinks />
			</div>
		</div>
	);
}
