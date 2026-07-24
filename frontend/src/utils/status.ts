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
};

// The states a user can pick by hand, in the order the picker shows them.
// 'offline' is omitted on purpose - it's schedule-derived, not manually
// settable, mirroring the backend's SETTABLE_STATUSES guard on /status.
export const SETTABLE_STATUSES: TeamMemberStatus[] = ['active', 'away', 'dnd'];

/**
 * What a member ACTUALLY shows as, combining the schedule with what they set.
 * Precedence, highest first:
 *
 *   1. off-shift          -> 'offline'  (derived; overrides whatever they set)
 *   2. whatever they set  -> as-is      (on-shift, or schedule unknown)
 *   3. never set anything -> 'away'
 *
 * Why the schedule wins at (1): a stored status is a snapshot of a moment
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
 */
export function resolveDisplayStatus(
  storedStatus: TeamMemberStatus | undefined,
  scheduleState: ScheduleState
): TeamMemberStatus {
  if (scheduleState === 'off-shift') return 'offline';
  return storedStatus ?? 'away';
}
