import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { WorkShift } from '../types';

// Registering these here too — dayjs plugins are global, but a util file
// shouldn't assume some component already ran this setup before it's called.
dayjs.extend(utc);
dayjs.extend(timezone);

export interface HourRange {
  startHour: number;   // 0-23, in the viewer's timezone
  endHour: number;     // 0-23, in the viewer's timezone
  isOvernight: boolean; // true if the shift crosses midnight (viewer's clock)
}

/**
 * Takes a shift (anchored to the member's home timezone) and converts its
 * start/end hours into the viewer's timezone.
 *
 * Returns null if there's no valid shift or either timezone is missing —
 * callers should treat null as "nothing to render," same as the -1 sentinel
 * did before, but without a magic number to remember.
 */
export function resolveHourRangeInViewerTz(
  shift: WorkShift | undefined,
  memberTimezone: string | undefined,
  viewerTimezone: string | undefined
): HourRange | null {
  if (!shift || !shift.date || !shift.startTime || !shift.endTime) return null;
  if (!memberTimezone || !viewerTimezone) return null;

  // Anchor the shift's wall-clock time to the member's home timezone
  const startInMemberTz = dayjs.tz(`${shift.date} ${shift.startTime}`, memberTimezone);
  const endInMemberTz = dayjs.tz(`${shift.date} ${shift.endTime}`, memberTimezone);

  // Convert that same instant into the viewer's timezone
  const startInViewerTz = startInMemberTz.tz(viewerTimezone);
  const endInViewerTz = endInMemberTz.tz(viewerTimezone);

  const startHour = startInViewerTz.hour();
  const endHour = endInViewerTz.hour();

  // If end hour is "before" start hour on the clock, the shift wraps past midnight
  const isOvernight = endHour < startHour;

  return { startHour, endHour, isOvernight };
}

/**
 * Finds the shift that applies to a member right now.
 *
 * Today this is naive: it just grabs the first shift record that has a
 * date/startTime/endTime. Once shifts move to day-of-week recurrence (see
 * nextSteps.md), this function is the ONLY place that needs to change —
 * it'll instead resolve "today's day-of-week" and find the matching
 * recurring shift, then layer any break record on top. Every caller stays
 * the same.
 */
export function getCurrentShiftForMember(
  memberId: string,
  shifts: WorkShift[]
): WorkShift | undefined {
  const memberShifts = shifts.filter(s => {
    const shiftMemberId = typeof s.teamMemberId === 'string' ? s.teamMemberId : s.teamMemberId?._id;
    return String(shiftMemberId) === String(memberId);
  });

  return memberShifts.find(s => s.date && s.startTime && s.endTime);
}