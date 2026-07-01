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
		<div style={{ paddingBottom: 48 }}>
			<PageHeader title="How to play" subtitle="Two games, one tournament" />

			<div className="card" style={{ padding: 18, marginBottom: 16, background: "var(--greenSoft)", borderColor: "transparent" }}>
				<div style={{ fontSize: 15, lineHeight: 1.6 }}>
					BanglaBracket has <strong>two separate games</strong>. Play one or both — they don't affect each other.
				</div>
				<div style={{ marginTop: 12 }}>
					<button className="btn btn-primary" onClick={() => nav("/bracket")}>Open the bracket →</button>
				</div>
			</div>

			<GameCard tag="Game 1" tagColor="var(--gold)" title="The Bracket">
				Send teams through every knockout round — Round of 32 → Round of 16 → Quarter-finals →
				Semi-finals → Final. For each knockout match you pick <strong>who advances</strong> and the{" "}
				<strong>manner</strong> they qualify: <strong>Full time</strong>, <strong>Extra time</strong>, or{" "}
				<strong>Penalties</strong>.
				<ul style={{ paddingLeft: 18, marginTop: 12, marginBottom: 0, lineHeight: 1.8 }}>
					<li><strong>On mobile:</strong> tap a match to open a pop-up and choose the winner + manner, then confirm.</li>
					<li><strong>On web:</strong> click a match to open an inline panel below the card with the same winner + manner choice.</li>
					<li>
						<strong>Round of 32 is structural.</strong> You pick R32 only to set up your Round of 16.
						Guessed wrong? No problem — reality flows the real winners in and you can re-pick. R32 gives{" "}
						<strong>no bracket points</strong>.
					</li>
				</ul>
			</GameCard>

			<GameCard tag="Game 2" tagColor="var(--r32Line)" title="Correct Score for Cash">
				Predict the <strong>exact scoreline</strong> of upcoming matches to win cash. Enter your scoreline on
				the <strong>Score for cash</strong> tab before a match kicks off.
				<div style={{ marginTop: 10 }}>
					This is a <strong>completely separate game</strong> from the bracket — it has nothing to do with who
					you sent through. Play it, skip it, or do both.
				</div>
			</GameCard>

			<div className="card" style={{ padding: 18, marginTop: 4 }}>
				<div className="muted" style={{ fontSize: 14, lineHeight: 1.7 }}>
					Looking for <strong>scoring</strong>, <strong>prizes</strong>, or <strong>how to verify</strong>?
					Those are covered on their own pages.
				</div>
				<div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
					<button className="btn" onClick={() => nav("/scoring")}>Scoring →</button>
					<button className="btn" onClick={() => nav("/prizes")}>Prizes →</button>
					<button className="btn" onClick={() => nav("/verify")}>Verify →</button>
				</div>
			</div>
		</div>
	);
}
