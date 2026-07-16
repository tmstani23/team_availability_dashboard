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

/**
 * True if `hour` (0-23) falls inside a HourRange, accounting for overnight
 * wraparound. Extracted from ScheduleGrid's inline isHourActive ternary so
 * the overlap row can reuse the exact same "is this member active at this
 * hour" check instead of a second copy that could drift out of sync.
 */
export function isHourInRange(range: HourRange | null, hour: number): boolean {
  if (!range) return false;
  return range.isOvernight
    ? (hour >= range.startHour || hour < range.endHour)
    : (hour >= range.startHour && hour < range.endHour);
}

/**
 * Formats a 0-23 hour into a compact "9AM" / "5PM" style label. Exported on
 * its own (not just inlined in formatHourRange) so ScheduleGrid can label
 * its start-of-shift cell with the same viewer-tz-correct format instead of
 * printing the shift's raw, unconverted startTime/endTime strings.
 */
export function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}${period}`;
}

/**
 * Renders a HourRange as a compact "9AM–5PM" style label for list/summary
 * views (TeamHoursPanel, ScheduleGrid). Only formats whole hours - HourRange
 * doesn't carry minutes, so this matches the precision that's available.
 */
export function formatHourRange(range: HourRange | null): string {
  if (!range) return 'No shift';
  return `${formatHourLabel(range.startHour)}–${formatHourLabel(range.endHour)}`;
}