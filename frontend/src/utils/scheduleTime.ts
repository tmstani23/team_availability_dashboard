import dayjs, { type Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { RecurringShift, DayOfWeek } from '../types';

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
 * The outcome of resolving a member's standing hours for right now:
 *   - working: hours set for today's weekday, on shift
 *   - off:     a record for today's weekday, explicitly marked off
 *   - unset:   no record for today's weekday (hours never set up)
 * Keeping off and unset distinct (the old WorkShift|undefined couldn't) is what
 * lets the UI show "off today" vs. a "set your hours" prompt, and feeds the
 * derived-offline status layer (see nextSteps.md).
 */
export type ShiftResolution =
  | { state: 'working'; startTime: string; endTime: string }
  | { state: 'off' }
  | { state: 'unset' };

// Pull a member id out of a RecurringShift whether teamMemberId came back as a
// raw id string or a populated { _id } object. GET /api/recurring-shifts sends
// it unpopulated (a string) today, but this keeps us safe if that changes.
function shiftMemberId(shift: RecurringShift): string {
  const ref = shift.teamMemberId;
  return typeof ref === 'string' ? ref : String(ref?._id);
}

/**
 * Resolves which standing shift applies to a member RIGHT NOW, keyed to the
 * MEMBER's own weekday, not the viewer's. This is a presence tool, so each row
 * answers "is this person on shift where they are" - near midnight a teammate
 * can be on a different weekday than the viewer, and we use their day. The
 * viewer-tz conversion is a separate later step (resolveHourRangeInViewerTz).
 *
 * `now` is injectable so tests can pin a moment; defaults to the current time.
 */
export function getCurrentShiftForMember(
  memberId: string,
  recurringShifts: RecurringShift[],
  memberTimezone: string | undefined,
  now: Dayjs = dayjs()
): ShiftResolution {
  // Without the member's timezone we can't know what weekday it is for them,
  // so we can't pick a record. Treat as unset (nothing to render).
  if (!memberTimezone) return { state: 'unset' };

  // dayjs .day() returns 0=Sun..6=Sat, which is exactly our DayOfWeek convention.
  const memberWeekday = now.tz(memberTimezone).day() as DayOfWeek;

  const record = recurringShifts.find(
    s => shiftMemberId(s) === String(memberId) && s.dayOfWeek === memberWeekday
  );

  if (!record) return { state: 'unset' };
  if (record.isOff) return { state: 'off' };
  // isOff false but no times = malformed (the save route shouldn't allow it).
  // Nothing to render, so fall back to unset rather than crash on undefined.
  if (!record.startTime || !record.endTime) return { state: 'unset' };

  return { state: 'working', startTime: record.startTime, endTime: record.endTime };
}

/**
 * Converts a working shift's start/end hours (in the member's home timezone)
 * into the viewer's timezone. Returns null for anything that isn't a working
 * shift, or if either timezone is missing - callers treat null as "nothing to
 * render."
 *
 * Anchored to TODAY's date in the member's timezone: recurring records carry no
 * date, but the offset between two zones depends on the calendar day (DST), so
 * dropping the date would shift hours by an hour half the year. `now` is
 * injectable for tests.
 */
export function resolveHourRangeInViewerTz(
  resolution: ShiftResolution | null | undefined,
  memberTimezone: string | undefined,
  viewerTimezone: string | undefined,
  now: Dayjs = dayjs()
): HourRange | null {
  if (!resolution || resolution.state !== 'working') return null;
  if (!memberTimezone || !viewerTimezone) return null;

  const { startTime, endTime } = resolution;

  // Anchor to the member's current local date so the DST offset is correct.
  const anchorDate = now.tz(memberTimezone).format('YYYY-MM-DD');

  // Pin the wall-clock times to that date in the member's timezone...
  const startInMemberTz = dayjs.tz(`${anchorDate} ${startTime}`, memberTimezone);
  const endInMemberTz = dayjs.tz(`${anchorDate} ${endTime}`, memberTimezone);

  // ...then read the same instants on the viewer's clock.
  const startInViewerTz = startInMemberTz.tz(viewerTimezone);
  const endInViewerTz = endInMemberTz.tz(viewerTimezone);

  const startHour = startInViewerTz.hour();
  const endHour = endInViewerTz.hour();

  // If end hour is "before" start hour on the clock, the shift wraps past midnight
  const isOvernight = endHour < startHour;

  return { startHour, endHour, isOvernight };
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
