import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 22, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div className="muted" style={{ fontSize: 15, lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

export default function HowToPlay() {
  const nav = useNavigate();
  return (
    <div>
      <PageHeader title="How to win" subtitle="The rules, the scoring, and the prizes — all in one place" />

      <Section title="How to play">
        Sign in free, predict the final group games, then send teams through every knockout from the Round of 32 to the Final. Lock your bracket before the first kick-off. As real matches finish, your points update automatically.
        <div style={{ marginTop: 12 }}><button className="btn btn-primary" onClick={() => nav('/bracket')}>Open the bracket →</button></div>
      </Section>

      <Section title="Scoring (placeholder)">
        Main points grow each round: Round of 16 = 100, Quarter-final = 200, Semi-final = 300, Third place = 400, Final = 500. Bonus tiebreakers: manner of advance (+10), exact final score (+50), early Round-of-32 picks (+5 each). <em>Full worked examples coming here.</em>
      </Section>

      <Section title="Prizes (placeholder)">
        Grand prize: <strong>৳1,00,000</strong> for the top of the points leaderboard. Side cash: <strong>100৳</strong> for each exact knockout scoreline you predict, paid after verification. <em>Full prize breakdown and runner-up tiers will be listed here.</em>
      </Section>

      <Section title="Eligibility & verifying">
        Prizes are for Bangladeshi nationals (by nationality, not residence), 18+. You can play and win from anywhere. Winners verify by emailing <strong>admin@banglabracket.com</strong> — we store only your status, never your ID images.
        <div style={{ marginTop: 12 }}><button className="btn" onClick={() => nav('/verify')}>Go to verify →</button></div>
      </Section>

      <Section title="FAQ (placeholder)">
        <strong>Is it really free?</strong> Yes — no entry fee, no card.<br />
        <strong>When does it lock?</strong> At the first Round-of-32 kick-off, 28 June 2026.<br />
        <strong>How do I get paid?</strong> Verified winners are paid via Bkash (or arranged for overseas winners). <em>More questions will be added here.</em>
      </Section>
    </div>
  );
}
