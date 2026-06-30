import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui";
import { showLegal } from "../lib/feedback";

function PrizeRow({
	rank,
	label,
	amount,
	highlight,
}: {
	rank: string;
	label: string;
	amount: string;
	highlight?: boolean;
}) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 14,
				padding: "13px 20px",
				borderTop: "1px solid var(--line)",
				background: highlight
					? "linear-gradient(100deg,#fff7e0,transparent)"
					: "transparent",
			}}>
			<span
				style={{
					display: "inline-grid",
					placeItems: "center",
					width: 32,
					height: 32,
					borderRadius: 10,
					flexShrink: 0,
					background: highlight
						? "linear-gradient(150deg,#ffd45f,#e8ab1f)"
						: "var(--surface2)",
					color: highlight ? "#1a1405" : "var(--muted)",
					fontWeight: 800,
					fontSize: 13,
				}}>
				{rank}
			</span>
			<span style={{ flex: 1, fontWeight: highlight ? 800 : 600 }}>
				{label}
			</span>
			<span
				className="tabular"
				style={{
					fontWeight: 800,
					fontSize: 18,
					color: highlight ? "var(--goldText)" : "var(--ink)",
				}}>
				{amount}
			</span>
		</div>
	);
}

export default function Prizes() {
	const nav = useNavigate();
	return (
		<div>
			<PageHeader
				title="Prizes"
				subtitle="What you can win and how to collect it"
			/>

			{/* HOW TO WIN */}
			<div
				className="card"
				style={{
					padding: 22,
					marginBottom: 20,
					background: "linear-gradient(160deg,#fff7e0,var(--surface))",
					borderColor: "var(--gold)",
				}}>
				<h3 style={{ margin: "0 0 10px", fontSize: 20 }}>How to win 🏆</h3>
				<div className="muted" style={{ fontSize: 15, lineHeight: 1.7 }}>
					<p style={{ margin: "0 0 10px" }}>
						<strong style={{ color: "var(--ink)" }}>
							1. Fill your bracket
						</strong>{" "}
						— call the final group games, then pick the winner of every knockout
						match from the Round of 32 to the Final. Include your predicted
						Final scoreline.
					</p>
					<p style={{ margin: "0 0 10px" }}>
						<strong style={{ color: "var(--ink)" }}>
							2. Earn points as matches finish
						</strong>{" "}
						— correct knockout winners earn main points (100–500 depending on
						the round). Tiebreaker bonuses reward the fine details: how teams
						advance, exact scores, early picks.
					</p>
					<p style={{ margin: "0 0 10px" }}>
						<strong style={{ color: "var(--ink)" }}>
							3. Top the leaderboard at the Final
						</strong>{" "}
						— the player with the most points when the Final finishes wins the
						grand prize.
					</p>
					<p style={{ margin: 0 }}>
						<strong style={{ color: "var(--ink)" }}>
							4. Verify your identity
						</strong>{" "}
						— winners must verify before the 3rd-place match deadline. Email{" "}
						<strong>verify@banglabracket.com</strong> with your verification
						code + ID photo.
					</p>
				</div>
				<button
					className="btn btn-primary"
					onClick={() => nav("/bracket")}
					style={{ marginTop: 16 }}>
					Open the bracket →
				</button>
			</div>

			{/* MAIN PRIZE */}
			<div className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
				<div
					style={{
						padding: "14px 20px",
						borderBottom: "1px solid var(--line)",
						background: "var(--surface2)",
						display: "flex",
						alignItems: "center",
						gap: 9,
					}}>
					<span
						style={{
							width: 10,
							height: 10,
							borderRadius: 3,
							background: "var(--gold)",
						}}
					/>
					<span
						style={{
							fontSize: 12,
							fontWeight: 800,
							textTransform: "uppercase",
							letterSpacing: ".06em",
						}}>
						Grand prize · leaderboard
					</span>
				</div>
				<PrizeRow
					rank="👑"
					label="Grand prize — leaderboard winner"
					amount="৳1,00,000"
					highlight
				/>
				<PrizeRow rank="2" label="Runner-up (if announced)" amount="TBA" />
				<PrizeRow rank="3" label="Third place (if announced)" amount="TBA" />
				<div
					className="muted"
					style={{
						padding: "12px 20px",
						fontSize: 13,
						borderTop: "1px solid var(--line)",
					}}>
					Runner-up and third-place prizes (if offered) will be announced before
					lock. The current confirmed prize is ৳1,00,000 for #1.
				</div>
			</div>

			{/* SIDE CASH */}
			<div className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
				<div
					style={{
						padding: "14px 20px",
						borderBottom: "1px solid var(--line)",
						background: "var(--surface2)",
						display: "flex",
						alignItems: "center",
						gap: 9,
					}}>
					<span
						style={{
							width: 10,
							height: 10,
							borderRadius: 3,
							background: "var(--bronze)",
						}}
					/>
					<span
						style={{
							fontSize: 12,
							fontWeight: 800,
							textTransform: "uppercase",
							letterSpacing: ".06em",
						}}>
						Side cash · exact knockout scores
					</span>
				</div>
				<div
					style={{ padding: "16px 20px", borderTop: "1px solid var(--line)" }}>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}>
						<div>
							<div style={{ fontWeight: 700 }}>Exact knockout scoreline</div>
							<div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
								Predict the correct score for any knockout match — per match you
								nail
							</div>
						</div>
						<span
							className="tabular"
							style={{
								fontWeight: 800,
								fontSize: 20,
								color: "var(--bronze)",
								marginLeft: 16,
							}}>
							100৳
						</span>
					</div>
				</div>
				<div
					className="muted"
					style={{
						padding: "12px 20px",
						fontSize: 13,
						borderTop: "1px solid var(--line)",
					}}>
					Cash prizes are paid after you verify your identity. Bangladeshi
					nationals only. Add your Bkash number in profile for fast payout.
				</div>
			</div>

			{/* ELIGIBILITY */}
			<div className="card" style={{ padding: 20 }}>
				<strong style={{ fontSize: 16 }}>Eligibility</strong>
				<ul
					className="muted"
					style={{
						marginTop: 10,
						paddingLeft: 20,
						lineHeight: 1.8,
						marginBottom: 0,
						fontSize: 14,
					}}>
					<li>
						Bangladeshi nationals only (by nationality, not residence). You can
						play and win from anywhere in the world.
					</li>
					<li>Must be 18 or older.</li>
					<li>
						One account per person. Multiple or fake accounts will be
						disqualified.
					</li>
					<li>
						Winners must verify identity before the 3rd-place match to collect
						prizes.
					</li>
					<li>
						All admin decisions are final. See our{" "}
						<button
							onClick={() => showLegal("terms")}
							style={{
								background: "none",
								border: "none",
								color: "var(--green)",
								fontWeight: 600,
								cursor: "pointer",
								padding: 0,
								fontFamily: "inherit",
								fontSize: "inherit",
							}}>
							Terms of Play
						</button>
						.
					</li>
				</ul>
				<div
					style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
					<button className="btn btn-primary" onClick={() => nav("/verify")}>
						Verify your ID →
					</button>
					<button className="btn" onClick={() => nav("/winners")}>
						View winners
					</button>
				</div>
			</div>
		</div>
	);
}
