import type { TeamMemberStatus } from '../types';
import type { ScheduleState } from './scheduleTime';

// UI metadata for each presence state: the label text and the Tailwind
// classes for its pill. Kept in one place so the sidebar and the admin card
// render identical colors/labels instead of each hard-coding their own copy
// (same DRY reasoning as scheduleTime.ts).
// label = full text for the status pill; short = compact form for the small
// picker buttons where "Do Not Disturb" would wrap.
export const STATUS_META: Record<TeamMemberStatus, { label: string; short: string; pill: string }> = {
  // active reuses the SHIFT colour (--color-ok is the same value as
  // --color-shift). The pill and the on-shift block in the grid describe one
  // fact, and they were previously two different greens.
  active:  { label: 'Active',         short: 'Active',  pill: 'bg-ok/15 text-ok border-ok' },
  away:    { label: 'Away',           short: 'Away',    pill: 'bg-away/15 text-away border-away' },
  // The one status that keeps a conventional colour over a palette-native one.
  // A "do not disturb" that blends into the surface isn't doing its job.
  dnd:     { label: 'Do Not Disturb', short: 'DND',     pill: 'bg-dnd/15 text-dnd border-dnd' },
  offline: { label: 'Offline',        short: 'Offline', pill: 'bg-idlepill/15 text-idlepill border-idlepill' },
  // Derived from the standing lunch window, never stored. Amber rather than
  // reusing away's yellow so "at lunch, back shortly" and "stepped out,
  // who knows" don't read as the same state at a glance - the grid already
  // draws the lunch explicitly, and a sidebar that said only "Away" would be
  // telling a vaguer story about the same fact.
  break:   { label: 'At lunch',       short: 'Lunch',   pill: 'bg-atbreak/15 text-atbreak border-atbreak' },
  // Derived from a booked meeting overlapping right now, never stored. Rose
  // deliberately matches the overlap row's colour: that row is where meetings
  // get found and booked, so the pill and the thing that produced it read as
  // the same feature rather than two unrelated states.
  // Was violet until the 8/7 design pass, which reserved violet for things you
  // can interact with - the overlap row and the primary button had ended up
  // the same hex.
  meeting: { label: 'In a meeting',   short: 'Meeting', pill: 'bg-booked/15 text-booked border-booked' },
};

// The states a user can pick by hand, in the order the picker shows them.
// 'offline', 'break' and 'meeting' are omitted on purpose - all three are
// schedule-derived, not manually settable, mirroring the backend's
// SETTABLE_STATUSES guard on /status (which is an allowlist, so it rejects
// them without needing to know they exist).
export const SETTABLE_STATUSES: TeamMemberStatus[] = ['active', 'away', 'dnd'];

/**
 * What a member ACTUALLY shows as, combining the schedule with what they set.
 * Precedence, highest first:
 *
 *   1. no recent heartbeat -> 'offline'  (derived; they are not here - Phase 1)
 *   2. off-shift            -> 'offline'  (derived; overrides whatever they set)
 *   3. in a booked meeting  -> 'meeting'  (derived - NEW, Phase 3)
 *   4. in a standing break  -> 'break'    (derived - Phase 2)
 *   5. whatever they set    -> as-is      (on-shift, or schedule unknown)
 *   6. never set anything   -> 'away'
 *
 * Why meeting sits ABOVE break at (3): both are plans, but one is specific and
 * dated while the other is a weekly default. Someone who booked a meeting
 * across their usual lunch hour has, by booking it, said which of the two is
 * actually happening.
 *
 * Why meeting sits BELOW the heartbeat and off-shift: same reason break does.
 * A booking is a plan and the heartbeat is evidence, so a laptop shut for an
 * hour shouldn't render as a meeting in progress. And a meeting booked outside
 * someone's working hours still DRAWS on the grid (that's worth seeing) while
 * the pill keeps saying offline - "booked" and "here" are different claims.
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
  // Whether a booked meeting overlaps right now. Passed in as a plain boolean
  // rather than folded into ScheduleState because ScheduleState describes a
  // member's STANDING hours, which meetings are not part of - they're separate
  // records on a different time model (instants, not wall clocks). Keeping
  // them separate here is what stops that distinction blurring.
  inMeeting: boolean,
  lastSeenAtMs: number | undefined,
  nowMs: number,
  staleThresholdMs: number
): TeamMemberStatus {
  const heartbeatStale =
    lastSeenAtMs !== undefined && nowMs - lastSeenAtMs > staleThresholdMs;
  if (heartbeatStale) return 'offline';

  if (scheduleState === 'off-shift') return 'offline';
  if (inMeeting) return 'meeting';
  if (scheduleState === 'on-break') return 'break';
  return storedStatus ?? 'away';
}
