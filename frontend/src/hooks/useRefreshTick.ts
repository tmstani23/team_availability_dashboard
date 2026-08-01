import { useEffect, useRef, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';

// How often clients poll for fresh data. Piggybacks on GET /api/team-members,
// which also doubles as the heartbeat stamp on the backend (see
// teamMembersRoutes.ts) - one request, two jobs.
export const POLL_INTERVAL_MS = 15 * 1000;

// A member counts as "here" if their heartbeat is within this window - two
// to three poll intervals of grace so one dropped request doesn't flap
// someone offline. Consumed by resolveDisplayStatus's heartbeat layer.
export const HEARTBEAT_STALE_MS = 45 * 1000;

/**
 * The single seam for "when do we refresh." Owns one interval that calls
 * `refresh` on POLL_INTERVAL_MS, and returns a `now` value that ticks in
 * step. Components computing anything time-sensitive (schedule state,
 * heartbeat staleness) should take `now` from here instead of calling
 * dayjs() themselves at render time - that's what makes the tick actually
 * cause a re-render instead of silently going stale in an open tab.
 *
 * If polling is ever swapped for a socket push, this hook is the only thing
 * that changes - consumers only know "now" ticks and refreshes happen, not
 * where they come from.
 */
export function useRefreshTick(refresh: () => void | Promise<void>): Dayjs {
  const [now, setNow] = useState<Dayjs>(() => dayjs());

  // Route calls through a ref so the interval effect below can mount once
  // (empty deps) instead of tearing down and rebuilding on every render that
  // hands us a new `refresh` function reference.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshRef.current();
      setNow(dayjs());
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return now;
}
