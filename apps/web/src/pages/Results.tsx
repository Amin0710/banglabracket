import { useEffect, useMemo, useState } from 'react';
import { GROUP_KEYS, rankGroup, formatCompletedMatch } from '@banglabracket/shared';
import { api } from '../lib/api';
import { useTournament } from '../lib/tournament';
import { PageHeader, Flag, SubTabs } from '../components/ui';

const RL: Record<string, string> = { R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', THIRD: 'Third place', FINAL: 'Final' };

function PlayerStatRow({ p }: { p: any }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: '1px solid var(--line)' }}>
      <span className="tabular faint" style={{ width: 20, textAlign: 'right', flex: '0 0 auto' }}>{p.rank}</span>
      {p.photo
        ? <img src={p.photo} alt="" width={30} height={30} style={{ borderRadius: '50%', objectFit: 'cover', flex: '0 0 auto', background: 'var(--surface2)' }} referrerPolicy="no-referrer" />
        : <Flag name={p.flag || p.country} size={26} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
        <div className="faint" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><Flag name={p.flag || p.country} size={14} />{p.team || p.country}</div>
      </div>
      <span className="tabular" style={{ fontWeight: 800, fontSize: 18 }}>{p.value ?? 0}</span>
    </div>
  );
}

// Clean sportsbook line: "France 3–0 Sweden" · FT / AET / AET (P) + (pens x–y).
function CompletedMatchRow({ fx }: { fx: any }) {
  const f = formatCompletedMatch({ manner: fx.manner, scoreA: fx.scoreA, scoreB: fx.scoreB, penA: fx.penA, penB: fx.penB });
  const roundLabel = RL[fx.round] || (fx.round === 'GROUP' ? 'Group stage' : '');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto 1fr 78px', alignItems: 'center', gap: 8, padding: '11px 0', borderTop: '1px solid var(--line)', fontSize: 13.5 }}>
      <span className="bb-decided" style={{ fontSize: 11, letterSpacing: '.03em', lineHeight: 1.15 }}>
        {f.statusLabel}{roundLabel && <span className="faint" style={{ display: 'block', fontSize: 9, fontWeight: 600 }}>{roundLabel}</span>}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', fontWeight: fx.winner === fx.teamA ? 800 : 600, minWidth: 0 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fx.teamA}</span><Flag name={fx.teamA} size={20} />
      </span>
      <span className="tabular bb-decided" style={{ minWidth: 52, textAlign: 'center', fontSize: 16 }}>{f.scoreA}–{f.scoreB}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: fx.winner === fx.teamB ? 800 : 600, minWidth: 0 }}>
        <Flag name={fx.teamB} size={20} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fx.teamB}</span>
      </span>
      <span className="bb-decided" style={{ fontSize: 11, textAlign: 'right' }}>{f.pens ? `pens ${f.pens}` : ''}</span>
    </div>
  );
}

type ResultsSub = 'matches' | 'groups' | 'scorers' | 'assists';

// Results lives under the Leaderboard hub now. It reads fixtures/groups from the
// shared (cached) tournament, and fetches the player-stat tables lazily on open.
export default function Results() {
  const t = useTournament();
  const [sub, setSub] = useState<ResultsSub>('matches');
  const [stats, setStats] = useState<{ topScorers: any[]; topAssists: any[] } | null>(null);
  useEffect(() => { api.get('/api/stats').then(setStats).catch(() => setStats({ topScorers: [], topAssists: [] })); }, []);

  const completed = useMemo(() => (t?.fixtures || [])
    .filter((f: any) => f?.status === 'finished')
    .sort((a: any, b: any) => +new Date(b.kickoff) - +new Date(a.kickoff)), [t]);
  const scorers = stats?.topScorers || [];
  const assists = stats?.topAssists || [];

  if (!t) return <div className="muted">Loading results…</div>;

  return (
    <div>
      <PageHeader title="Results" subtitle="Completed matches, groups & top players" />
      <SubTabs<ResultsSub> active={sub} onChange={setSub}
        tabs={[{ key: 'matches', label: 'Matches' }, { key: 'groups', label: 'Groups' }, { key: 'scorers', label: 'Top scorers' }, { key: 'assists', label: 'Top assists' }]} />

      {sub === 'matches' && (
        <div className="card" style={{ padding: 16 }}>
          <strong style={{ fontSize: 15 }}>Completed matches</strong>
          {completed.length
            ? completed.map((fx: any, i: number) => <CompletedMatchRow key={fx.providerId ?? i} fx={fx} />)
            : <div className="faint" style={{ marginTop: 8 }}>No completed matches yet.</div>}
        </div>
      )}

      {sub === 'groups' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 14 }}>
          {GROUP_KEYS.map((g) => {
            const table = rankGroup(g, t.base || {}, {}, {});
            return (
              <div key={g} className="card" style={{ padding: 14 }}>
                <strong>Group {g}</strong>
                <table style={{ width: '100%', fontSize: 13, marginTop: 8 }}><tbody>
                  {table.map((row, i) => (
                    <tr key={row.abbr} style={{ color: i < 2 ? 'var(--ink)' : i === 2 ? 'var(--bronze)' : 'var(--faint)' }}>
                      <td style={{ width: 16 }}>{i + 1}</td>
                      <td style={{ padding: '3px 0' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Flag name={row.name} size={20} />{row.name}</span></td>
                      <td className="tabular faint" style={{ textAlign: 'right' }}>{row.P}</td>
                      <td className="tabular" style={{ textAlign: 'right', fontWeight: 700, paddingLeft: 10 }}>{row.W * 3 + row.D}</td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            );
          })}
        </div>
      )}

      {(sub === 'scorers' || sub === 'assists') && (
        <div className="card" style={{ padding: 16 }}>
          <strong style={{ fontSize: 15 }}>{sub === 'scorers' ? '⚽ Top scorers' : '🅰️ Top assists'}</strong>
          {!stats
            ? <div className="faint" style={{ marginTop: 8 }}>Loading…</div>
            : (sub === 'scorers' ? scorers : assists).length
              ? (sub === 'scorers' ? scorers : assists).slice(0, 20).map((p, i) => <PlayerStatRow key={i} p={p} />)
              : <div className="faint" style={{ marginTop: 8 }}>No data yet.</div>}
        </div>
      )}
    </div>
  );
}
