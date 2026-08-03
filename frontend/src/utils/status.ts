import type { TeamMemberStatus } from '../types';
import type { ScheduleState } from './scheduleTime';

// UI metadata for each presence state: the label text and the Tailwind
// classes for its pill. Kept in one place so the sidebar and the admin card
// render identical colors/labels instead of each hard-coding their own copy
// (same DRY reasoning as scheduleTime.ts).
// label = full text for the status pill; short = compact form for the small
// picker buttons where "Do Not Disturb" would wrap.
export const STATUS_META: Record<TeamMemberStatus, { label: string; short: string; pill: string }> = {
  active:  { label: 'Active',         short: 'Active',  pill: 'bg-green-500/15 text-green-400 border-green-500' },
  away:    { label: 'Away',           short: 'Away',    pill: 'bg-yellow-500/15 text-yellow-400 border-yellow-500' },
  dnd:     { label: 'Do Not Disturb', short: 'DND',     pill: 'bg-red-500/15 text-red-400 border-red-500' },
  offline: { label: 'Offline',        short: 'Offline', pill: 'bg-zinc-500/15 text-zinc-400 border-zinc-500' },
  // Derived from the standing lunch window, never stored. Amber rather than
  // reusing away's yellow so "at lunch, back shortly" and "stepped out,
  // who knows" don't read as the same state at a glance - the grid already
  // draws the lunch explicitly, and a sidebar that said only "Away" would be
  // telling a vaguer story about the same fact.
  break:   { label: 'At lunch',       short: 'Lunch',   pill: 'bg-amber-500/15 text-amber-400 border-amber-500' },
};

// The states a user can pick by hand, in the order the picker shows them.
// 'offline' and 'break' are omitted on purpose - both are schedule-derived,
// not manually settable, mirroring the backend's SETTABLE_STATUSES guard on
// /status (which is an allowlist, so it rejects them without needing to know
// they exist).
export const SETTABLE_STATUSES: TeamMemberStatus[] = ['active', 'away', 'dnd'];

/**
 * What a member ACTUALLY shows as, combining the schedule with what they set.
 * Precedence, highest first:
 *
 *   1. no recent heartbeat -> 'offline'  (derived; they are not here - Phase 1)
 *   2. off-shift            -> 'offline'  (derived; overrides whatever they set)
 *   3. in a standing break  -> 'break'    (derived - NEW, Phase 2)
 *   4. whatever they set    -> as-is      (on-shift, or schedule unknown)
 *   5. never set anything   -> 'away'
 *
 * Why the break sits BELOW the heartbeat at (3) rather than above it: a lunch
 * window is a plan, and the heartbeat is evidence. If someone's laptop has
 * been shut for an hour, "at lunch" would dress up an absence as a scheduled
 * one - offline is the more honest reading. The schedule only gets to speak
 * when nothing contradicts it.
 *
 * Why it still OVERRIDES a stored status at (3): same reasoning as off-shift
 * at (2), just narrower. Someone who set 'active' this morning and is now in
 * their standing lunch is not available, and the stored value is the stalest
 * thing in the stack.
 *
 * Why the schedule wins at (2): a stored status is a snapshot of a moment
 * someone clicked a button, and it goes stale the second they close the tab.
 * "They are outside their own working hours right now" is a harder fact, so
 * it takes precedence over a claim that may be hours old.
 *
 * Why 'unknown' does NOT derive offline: no hours on file means we know
 * nothing about their schedule, which is a different thing from knowing
 * they're off. Deriving offline there would assert something unearned - the
 * "Hours not set" label carries that story instead.
 *
 * Why the fallback is 'away' and not 'active': see the TeamMember model -
 * 'active' is a claim only the person can make, so an absent value means
 * "no signal yet," not "available."
 *
 * Why (1) and (2) don't conflict: off-shift-and-gone is offline either way.
 * (1) exists for the on-shift-but-actually-gone case, where a stored
 * 'active' is at its most misleading - the tab is open, the shift says
 * they should be here, but nothing has pinged the server in a while.
 *
 * Heartbeat staleness is passed in as plain millisecond numbers (not a
 * lastSeenAt string + a `now` object) so this file stays free of dayjs, same
 * as the rest of it - time math belongs in scheduleTime.ts, this file just
 * makes the display decision.
 *
 * `lastSeenAtMs` undefined means "never logged in," which is NOT the same as
 * "logged in once, a long time ago" - an absent heartbeat must fall through
 * to the stored-status layers below, not derive offline. Deriving offline
 * from silence would punish a member an admin just created for a fact they
 * never had a chance to establish.
 */
export function resolveDisplayStatus(
  storedStatus: TeamMemberStatus | undefined,
  scheduleState: ScheduleState,
  lastSeenAtMs: number | undefined,
  nowMs: number,
  staleThresholdMs: number
): TeamMemberStatus {
  const heartbeatStale =
    lastSeenAtMs !== undefined && nowMs - lastSeenAtMs > staleThresholdMs;
  if (heartbeatStale) return 'offline';

  if (scheduleState === 'off-shift') return 'offline';
  if (scheduleState === 'on-break') return 'break';
  return storedStatus ?? 'away';
}
