import { PageHeader } from '../components/ui';

function Row({ label, pts, sub }: { label: string; pts: string; sub?: string }) {
  return (
    <tr style={{ borderTop: '1px solid var(--line)' }}>
      <td style={{ padding: '11px 0' }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        {sub && <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>}
      </td>
      <td className="tabular" style={{ textAlign: 'right', fontWeight: 800, fontSize: 20, paddingLeft: 16 }}>{pts}</td>
    </tr>
  );
}

function Table({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--surface2)' }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: accent }} />
        <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{title}</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', padding: '0 20px' }}>
        <tbody style={{ display: 'table', width: '100%', padding: '0 20px' }}>
          {children}
        </tbody>
      </table>
    </div>
  );
}

export default function Scoring() {
  return (
    <div>
      <PageHeader title="Scoring" subtitle="How points are awarded — and how the leaderboard is decided" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20, background: 'var(--greenSoft)', borderColor: 'transparent' }}>
          <div className="faint" style={{ fontSize: 11, fontWeight: 700 }}>MAXIMUM POSSIBLE</div>
          <div className="tabular" style={{ fontSize: 36, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>3,290+</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Main + bonus + cash</div>
        </div>
        <div className="card" style={{ padding: 20, background: 'linear-gradient(160deg,#fff7e0,var(--surface))', borderColor: 'var(--gold)' }}>
          <div className="faint" style={{ fontSize: 11, fontWeight: 700 }}>FINAL WINNER POINTS</div>
          <div className="tabular" style={{ fontSize: 36, fontWeight: 800, color: 'var(--goldText)', marginTop: 4 }}>500</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Biggest single pick</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="faint" style={{ fontSize: 11, fontWeight: 700 }}>EXACT FINAL SCORE BONUS</div>
          <div className="tabular" style={{ fontSize: 36, fontWeight: 800, marginTop: 4 }}>+50</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Tiebreaker bonus</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
        <Table title="Main points · correct knockout winner" accent="var(--green)">
          <Row label="Round of 16" pts="100" />
          <Row label="Quarter-final" pts="200" />
          <Row label="Semi-final" pts="300" />
          <Row label="Third place" pts="400" />
          <Row label="Final" pts="500" />
        </Table>

        <Table title="Tiebreaker bonus points" accent="var(--gold)">
          <Row label="Manner of advance" pts="+10" sub="Full-time, extra-time or penalties — per tie" />
          <Row label="Exact final score" pts="+50" sub="Nail the Final scoreline exactly" />
          <Row label="Early Round-of-32 pick" pts="+5" sub="Credit for calling the R32 team — per pick" />
          <Row label="Exact knockout score 💵" pts="100৳" sub="Cash — paid to verified winners" />
        </Table>
      </div>

      <div className="card" style={{ padding: 20, marginTop: 16 }}>
        <strong style={{ fontSize: 16 }}>How ties are broken</strong>
        <p className="muted" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.7, marginBottom: 0 }}>
          If two players have equal main points, the tiebreakers are applied in order: (1) exact Final score, (2) manner-of-advance points, (3) early R32 picks. The player with more tiebreaker bonus points is ranked higher. If still equal, the admin decides.
        </p>
      </div>

      <div className="card" style={{ padding: 20, marginTop: 16 }}>
        <strong style={{ fontSize: 16 }}>Deep runs win</strong>
        <p className="muted" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.7, marginBottom: 0 }}>
          Points are weighted heavily toward the later rounds. Getting the champion right (500 pts) is worth more than five correct Round-of-16 picks (500 pts total). Focus on your knockout path — that's where the leaderboard is made and broken.
        </p>
      </div>
    </div>
  );
}
