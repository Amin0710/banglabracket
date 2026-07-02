import { useEffect, useState } from 'react';
import { api } from './api';

// ── Shared tournament cache ──────────────────────────────────────────────────
// The tournament doc is the heavy fetch. Routing remounts each tab, so without a
// cache every visit to /bracket (or any tab) re-downloaded the whole doc. This
// module-level cache makes the first load fetch once, then hands every later
// mount the in-memory copy instantly (stale-while-revalidate on demand).

let cache: any = null;
let cachedAt = 0;
let inflight: Promise<any> | null = null;
const TTL = 45_000;   // stale-while-revalidate window (live results still refresh)

function fetchTournament(): Promise<any> {
  if (inflight) return inflight;
  inflight = api.get('/api/tournament?lite=1')
    .then((t) => { cache = t; cachedAt = Date.now(); inflight = null; return t; })
    .catch((e) => { inflight = null; throw e; });
  return inflight;
}

// Bracket paint doesn't need the player-stat tables → fetch the lite payload.
// Stale-while-revalidate: a warm cache returns instantly (no refetch on tab switch);
// if it's older than the TTL we return it AND refresh in the background so the next
// visit is fresh, keeping live results reasonably up to date without blocking paint.
export async function loadTournament(force = false): Promise<any> {
  if (cache && !force) {
    if (Date.now() - cachedAt > TTL) fetchTournament().catch(() => {});   // background refresh
    return cache;
  }
  return fetchTournament();
}

export function getCachedTournament(): any { return cache; }

// Returns the cached tournament immediately if present (no flash / no refetch on
// tab switches), and kicks off a load when the cache is cold.
export function useTournament(): any {
  const [t, setT] = useState<any>(cache);
  useEffect(() => {
    let alive = true;
    if (!cache) loadTournament().then((v) => { if (alive) setT(v); }).catch(() => {});
    else setT(cache);
    return () => { alive = false; };
  }, []);
  return t;
}

// ── Lazy-tab prefetch ─────────────────────────────────────────────────────────
// After the Bracket is loaded/idle, quietly warm the heavier tab chunks so the
// first switch to Results / Cash / Fantasy is instant on slow connections.
type Importer = () => Promise<unknown>;
export function prefetchOnIdle(importers: Importer[]): void {
  const run = () => importers.forEach((imp) => { try { imp(); } catch {} });
  const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: any) => number);
  if (ric) ric(run, { timeout: 2500 });
  else setTimeout(run, 1200);
}
