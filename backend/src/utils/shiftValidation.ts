// Validation rules for a single day's standing hours.
//
// These used to live ONLY in HoursEditor's handleSave on the frontend, which
// meant anything hitting the API directly could store a 09:30 shift that the
// grid would then silently misrender (it draws whole-hour blocks). Tracked as
// a known gap since 7/24; closed here in Phase 2 because the break fields
// needed their own rules anyway and two sets of half-enforced constraints is
// worse than one.
//
// Pure string/number work, no Mongoose and no dayjs - the route calls these
// before it writes anything, and the frontend mirrors the same rules for
// instant feedback. Each function returns an error message, or null when the
// input is fine, so callers can decide how to surface it.

// A day entry as it arrives on the PUT /:id/hours payload. Times are absent on
// off days, and the break pair is absent whenever no break is set.
export interface DayEntryInput {
  dayOfWeek: number;
  isOff: boolean;
  startTime?: string;
  endTime?: string;
  breakStart?: string;
  breakEnd?: string;
}

// Shift times must land on the hour; breaks may land on a quarter hour.
// The grid renders hour cells, but a break is drawn as a fractional carve-out
// INSIDE its cell, so it can be finer-grained than the cell without
// misrendering - which a shift boundary can't (see nextSteps.md Phase 2).
const BREAK_GRANULARITY_MINUTES = 15;

// "HH:mm" -> minutes since midnight, or null if it isn't that shape. Rejecting
// rather than coercing matters here: Number('9a') is NaN, and every comparison
// against NaN is silently false, so a malformed time would sail through the
// range checks below as if it were valid.
export function parseHHmm(time: unknown): number | null {
  if (typeof time !== 'string') return null;
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

const MINUTES_PER_DAY = 24 * 60;

/**
 * How long a window lasts, in minutes, measured FORWARD from start to end and
 * wrapping past midnight if it has to. This is what makes overnight shifts
 * work: 20:00-05:00 is 9 hours, not the -15 a plain subtraction gives.
 *
 * A start equal to its end yields 0, not 24 hours. Treating it as a full day
 * would silently turn an obvious typo into a valid all-day shift.
 */
export function durationMinutes(start: number, end: number): number {
  return (end - start + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/**
 * Where a time sits RELATIVE TO the start of a shift, in minutes forward. This
 * flattens the overnight case: inside a 20:00-05:00 shift, 23:00 is at offset
 * 180 and 02:00 is at offset 360, so "is it inside" and "is it before that
 * other time" become plain numeric comparisons again with no wrap special
 * cases scattered through the callers.
 */
function offsetFromShiftStart(time: number, shiftStart: number): number {
  return (time - shiftStart + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/**
 * The three shift rules, mirroring HoursEditor exactly: at least an hour long,
 * both times on the hour, and not zero-length.
 *
 * OVERNIGHT SHIFTS ARE ALLOWED (start > end, e.g. 20:00-05:00). An earlier
 * version rejected them, carried over from the old AddTeamMemberForm - but
 * the rendering side always supported them (getScheduleState treats them as a
 * union of two pieces, HourRange carries isOvernight, isHourInRange handles
 * the wrap, all tested), so the form was refusing to accept data the app
 * could display perfectly well. The README lists cross-midnight handling as a
 * design constraint, which made it a straight contradiction rather than a
 * deliberate limit.
 */
export function validateShiftTimes(startTime: unknown, endTime: unknown): string | null {
  const start = parseHHmm(startTime);
  const end = parseHHmm(endTime);

  if (start === null || end === null) return 'times must be HH:mm (e.g. 09:00)';
  if (start % 60 !== 0 || end % 60 !== 0) return 'times must be on the hour (e.g. 09:00)';

  const length = durationMinutes(start, end);
  if (length === 0) return 'start and end time cannot be the same';
  if (length < 60) return 'shift must be at least 1 hour long';

  return null;
}

/**
 * Break rules. The shift bounds are passed in as minutes because the caller
 * has already parsed and validated them - re-parsing here would let a caller
 * check a break against a shift that never passed validation.
 *
 * Both-or-neither is the first rule for a reason: a half-set break is the
 * likeliest bad payload (a form that cleared one input), and it needs a
 * clearer message than whatever the range checks would produce.
 */
export function validateBreakTimes(
  breakStart: unknown,
  breakEnd: unknown,
  shiftStartMinutes: number,
  shiftEndMinutes: number
): string | null {
  const hasStart = breakStart !== undefined && breakStart !== null && breakStart !== '';
  const hasEnd = breakEnd !== undefined && breakEnd !== null && breakEnd !== '';

  // No break at all is always valid - the fields are optional.
  if (!hasStart && !hasEnd) return null;
  if (hasStart !== hasEnd) return 'a break needs both a start and an end time';

  const start = parseHHmm(breakStart);
  const end = parseHHmm(breakEnd);

  if (start === null || end === null) return 'break times must be HH:mm (e.g. 12:00)';
  if (start % BREAK_GRANULARITY_MINUTES !== 0 || end % BREAK_GRANULARITY_MINUTES !== 0) {
    return 'break times must land on a quarter hour (e.g. 12:00, 12:15, 12:30)';
  }

  const shiftLength = durationMinutes(shiftStartMinutes, shiftEndMinutes);
  const shiftIsOvernight = shiftEndMinutes <= shiftStartMinutes;

  // On a same-day shift, a backwards break is almost always a typo, so say so
  // directly. On an OVERNIGHT shift the same comparison is meaningless - a
  // 23:45-00:15 lunch is legitimately "backwards" in clock terms - so that
  // case is left to the containment check below, which reasons in offsets
  // instead and can tell a wrapping break from an out-of-range one.
  if (!shiftIsOvernight && start >= end) return 'break start must be before break end';

  // Measured forward from the shift's own start, so the wrap disappears.
  const startOffset = offsetFromShiftStart(start, shiftStartMinutes);
  const endOffset = offsetFromShiftStart(end, shiftStartMinutes);

  if (startOffset === endOffset) return 'break start must be before break end';

  // Inside the shift, inclusive at the far edge: a break running right up to
  // the end of the shift is odd but not wrong, and rejecting it would be a
  // rule nobody asked for. endOffset <= startOffset means the break runs past
  // the shift's start again, i.e. straight out of the shift.
  if (startOffset >= shiftLength || endOffset > shiftLength || endOffset < startOffset) {
    return 'break must fall inside the shift hours';
  }

  return null;
}

/**
 * Whole-entry validation, which is what the route actually calls. Returns the
 * first problem found, prefixed with nothing - the route adds the weekday
 * label so the message reads the same way the frontend's does.
 */
export function validateDayEntry(day: DayEntryInput): string | null {
  if (typeof day.dayOfWeek !== 'number' || day.dayOfWeek < 0 || day.dayOfWeek > 6) {
    return 'needs a dayOfWeek 0-6';
  }

  // An off day carries no hours, so there's nothing further to check - and a
  // break on a day someone isn't working is incoherent rather than merely
  // unused, so it's rejected instead of ignored.
  if (day.isOff) {
    if (day.breakStart || day.breakEnd) return 'an off day cannot have a break';
    return null;
  }

  if (!day.startTime || !day.endTime) return 'working days need startTime and endTime';

  const shiftError = validateShiftTimes(day.startTime, day.endTime);
  if (shiftError) return shiftError;

  // Non-null after validateShiftTimes passed.
  const shiftStart = parseHHmm(day.startTime) as number;
  const shiftEnd = parseHHmm(day.endTime) as number;

  return validateBreakTimes(day.breakStart, day.breakEnd, shiftStart, shiftEnd);
}
