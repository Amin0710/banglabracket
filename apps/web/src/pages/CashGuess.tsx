import { useMemo } from 'react';
import { ALL_MATCHES, R32_MATCHES, ROUND_OF, resolveActualParticipants } from '@banglabracket/shared';
import { Flag } from '../components/ui';

const RL: Record<string, string> = { R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', THIRD: 'Third place', FINAL: 'Final' };

// "Cash the Guess" — exact-scoreline side game. Split into its own lazily-loaded
// chunk so the Bracket paint never bundles or computes it. Participant/kickoff
// resolution runs here, only when this tab is actually open.
export default function CashGuess({ t, scorePred, onCell }: {
  t: any;
  scorePred: Record<number, { a: number | ''; b: number | '' }>;
  onCell: (m: number, side: 'a' | 'b', raw: string) => void;
}) {
  const fixturesByMatch = useMemo(() => {
    const map: Record<number, any> = {};
    for (const f of (t?.fixtures || [])) if (f?.matchNumber != null) map[f.matchNumber] = f;
    return map;
  }, [t]);

  const actualParticipants = useMemo(() => {
    const realR32: any = {};
    for (const m of R32_MATCHES) realR32[m] = { A: t?.r32?.[m]?.A?.team ?? null, B: t?.r32?.[m]?.B?.team ?? null };
    return resolveActualParticipants(realR32, t?.results || {});
  }, [t]);

  const cashMatches = useMemo(() => {
    const now = Date.now();
    return ALL_MATCHES.filter((m) => {
      const ap = actualParticipants[m]; if (!ap?.A || !ap?.B) return false;
      const fx = fixturesByMatch[m];
      if (fx?.status === 'live' || t?.results?.[m]?.winner) return false;   // exclude decided + live
      const k = fx?.kickoff;                                                // kickoff must be in the future
      return !!k && new Date(k).getTime() > now;
    });
  }, [actualParticipants, fixturesByMatch, t]);

  return (
    <div className="card" style={{ padding: 16 }}>
      <strong style={{ fontSize: 15 }}>Cash the Guess 💵</strong>
      <p className="muted" style={{ fontSize: 13, margin: '4px 0 12px' }}>
        Predict the EXACT scoreline of the current round's upcoming matches — 100৳ each. Only matches whose teams are set and haven't kicked off appear here.
      </p>
      {cashMatches.length ? cashMatches.map((m) => {
        const ap = actualParticipants[m];
        return (
          <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <span className="faint" style={{ fontSize: 10, fontWeight: 700, width: 66 }}>{RL[ROUND_OF(m)]}</span>
            <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', fontWeight: 700, minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ap.A}</span><Flag name={ap.A} size={20} /></span>
            <input className="input tabular" style={{ width: 40, padding: 6, textAlign: 'center' }} inputMode="numeric" value={scorePred[m]?.a ?? ''} onChange={(e) => onCell(m, 'a', e.target.value)} />
            <span className="faint">–</span>
            <input className="input tabular" style={{ width: 40, padding: 6, textAlign: 'center' }} inputMode="numeric" value={scorePred[m]?.b ?? ''} onChange={(e) => onCell(m, 'b', e.target.value)} />
            <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, minWidth: 0 }}><Flag name={ap.B} size={20} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ap.B}</span></span>
            <span className="pill pill-gold" style={{ fontSize: 9, flex: '0 0 auto' }}>100৳</span>
          </div>
        );
      }) : <div className="faint">No current-round matches open right now — check back when the next round's teams are set.</div>}
    </div>
  );
}
