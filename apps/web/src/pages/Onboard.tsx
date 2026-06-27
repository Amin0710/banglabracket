import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/Providers";

export default function Onboard() {
	const { user, refresh } = useAuth();
	const nav = useNavigate();
	const [phone, setPhone] = useState(user?.phone || "");
	const [name, setName] = useState(user?.name || "");
	const [email, setEmail] = useState(user?.email || "");
	const [bkash, setBkash] = useState("");
	const [overseas, setOverseas] = useState(false);
	const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState("");
	useEffect(() => {
		if (!user) return;
		setName((v) => v || user.name || "");
		setEmail((v) => v || user.email || "");
		setPhone((v) => v || user.phone || "");
	}, [user]);

	function askLocation() {
		setOverseas(true);
		if (!navigator.geolocation) return;
		navigator.geolocation.getCurrentPosition(
			(p) =>
				setLoc({
					lat: +p.coords.latitude.toFixed(3),
					lng: +p.coords.longitude.toFixed(3),
				}),
			() => {},
			{ timeout: 6000 },
		);
	}

	async function submit() {
		setBusy(true);
		setMsg("");
		const payload: any = {
			phone,
			name: name || undefined,
			email: email || undefined,
			bkash: bkash || undefined,
			overseas,
			location: loc || undefined,
		};
		try {
			if (user)
				await api.put("/api/me/profile", payload); // already authenticated (e.g. Google) → complete profile
			else await api.post("/auth/signup", payload); // phone-first signup
			await refresh();
			nav("/bracket");
		} catch (e: any) {
			const m: Record<string, string> = {
				number_in_use: "That number is already registered.",
				email_in_use: "That email is already registered.",
				bkash_or_overseas_required:
					"Add a Bkash number, or tap “I’m overseas”.",
			};
			setMsg(m[e.message] || "Error: " + e.message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div
			className="card"
			style={{
				padding: 22,
				maxWidth: 480,
				margin: "24px auto",
				display: "grid",
				gap: 14,
			}}>
			<h2 style={{ margin: 0 }}>Quick setup</h2>
			<p className="muted" style={{ margin: 0 }}>
				You can start playing right away. ID verification comes later, only if
				you win.
			</p>

			<label style={{ display: "grid", gap: 6 }}>
				<span>
					Phone number <span style={{ color: "var(--bad)" }}>*</span>
				</span>
				<input
					className="input"
					inputMode="tel"
					placeholder="01XXXXXXXXX"
					value={phone}
					onChange={(e) => setPhone(e.target.value)}
				/>
			</label>

			<label style={{ display: "grid", gap: 6 }}>
				<span>Name</span>
				<input
					className="input"
					placeholder="Your name"
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>
				<span className="faint" style={{ fontSize: 12 }}>
					Use your real ID name if you want to claim a prize.
				</span>
			</label>

			<label style={{ display: "grid", gap: 6 }}>
				<span>
					Email <span className="faint">(optional)</span>
				</span>
				<input
					className="input"
					placeholder="you@email.com"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
				/>
			</label>

			<label style={{ display: "grid", gap: 6 }}>
				<span>
					Bkash number <span className="faint">(optional)</span>
				</span>
				<input
					className="input"
					inputMode="tel"
					placeholder="Bkash number"
					value={bkash}
					onChange={(e) => setBkash(e.target.value)}
					disabled={overseas}
				/>
			</label>

			<button
				className="btn"
				onClick={askLocation}
				style={{ borderColor: overseas ? "var(--gold)" : undefined }}>
				{overseas
					? "✓ Overseas — Bkash not required"
					: "I don't have one — I'm overseas"}
			</button>

			{msg && <div style={{ color: "var(--bad)", fontSize: 14 }}>{msg}</div>}
			<button
				className="btn btn-primary"
				onClick={submit}
				disabled={busy || !phone}>
				{busy ? "Saving…" : "Start playing"}
			</button>
		</div>
	);
}
