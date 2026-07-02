import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui";

function GameCard({ tag, tagColor, title, children }: { tag: string; tagColor: string; title: string; children: React.ReactNode }) {
	return (
		<div className="card" style={{ padding: 22, marginBottom: 16 }}>
			<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
				<span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 999, background: tagColor, color: "#1a1405" }}>{tag}</span>
				<h3 style={{ margin: 0, fontSize: 19 }}>{title}</h3>
			</div>
			<div className="muted" style={{ fontSize: 15, lineHeight: 1.7 }}>{children}</div>
		</div>
	);
}

export default function HowToPlay() {
	const nav = useNavigate();
	return (
		<div>
			<PageHeader title="How to play" subtitle="Three games, one tournament" />

			<div className="card" style={{ padding: 18, marginBottom: 16, background: "var(--greenSoft)", borderColor: "transparent" }}>
				<div style={{ fontSize: 15, lineHeight: 1.6 }}>
					BanglaBracket has <strong>three separate games</strong>. Play one, some, or all — they don't affect each other.
				</div>
			</div>

			<GameCard tag="Game 1" tagColor="var(--gold)" title="The Bracket">
				{/* R32-structural note — TOP of Game 1, seen first on mobile + web */}
				<div style={{ background: "var(--goldSoft)", border: "1px solid var(--goldLine)", borderRadius: 12, padding: "12px 14px", marginBottom: 14, color: "var(--ink)", fontSize: 14.5, lineHeight: 1.6 }}>
					<strong>Round of 32 is structural</strong> — you pick it only to set up your Round of 16. No
					punishment for early pickers: the real winners flow in and you can re-pick. R32 gives{" "}
					<strong>no bracket points</strong>.
				</div>

				Send teams through every knockout round —{" "}
				<strong>Round of 32 (only to continue the bracket) → Round of 16 → Quarter-finals → Semi-finals → Final</strong>.
				For each knockout match you pick <strong>who advances</strong> and the <strong>manner</strong> they
				qualify: <strong>Full time</strong>, <strong>Extra time</strong>, or <strong>Penalties</strong>.
				<ul style={{ paddingLeft: 18, marginTop: 12, marginBottom: 0, lineHeight: 1.8 }}>
					<li><strong>On mobile:</strong> tap a match to open a pop-up at the bottom of the screen to choose winner + manner, then confirm.</li>
					<li><strong>On web:</strong> click a match to open an inline panel below the card.</li>
				</ul>

				<div style={{ marginTop: 12 }}>
					Each round awards different points per correct match, and each manner (Full/Extra/Penalties)
					has its own bonus points. At the end, the top 10 on the leaderboard win prizes. Full details on
					the <strong>Scoring</strong> and <strong>Prizes</strong> tabs.
				</div>

				<div style={{ marginTop: 14 }}>
					<button className="btn btn-primary" onClick={() => nav("/bracket")}>Open the bracket →</button>
				</div>
			</GameCard>

			<GameCard tag="Game 2" tagColor="var(--r32Line)" title="Correct Score for Cash">
				Predict the <strong>exact scoreline</strong> of upcoming matches to win cash. Enter your scoreline on
				the <strong>Score for cash</strong> tab before a match kicks off.
				<div style={{ marginTop: 10 }}>
					This is a <strong>completely separate game</strong> from the bracket — it has nothing to do with who
					you sent through. Play it, skip it, or do both.
				</div>
			</GameCard>
		</div>
	);
}
