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

/**
 * The three shift rules, mirroring HoursEditor exactly:
 * start before end, both on the hour, at least an hour long.
 *
 * Note this rejects overnight shifts (start >= end), which the RENDERING side
 * actually supports - scheduleTime.ts handles wraparound fine. That's a
 * deliberate carry-over of the existing frontend rule rather than a new
 * restriction: no UI can currently produce an overnight standing shift, so
 * allowing one through the API would create data no form could edit back.
 */
export function validateShiftTimes(startTime: unknown, endTime: unknown): string | null {
  const start = parseHHmm(startTime);
  const end = parseHHmm(endTime);

  if (start === null || end === null) return 'times must be HH:mm (e.g. 09:00)';
  if (start >= end) return 'start time must be before end time';
  if (start % 60 !== 0 || end % 60 !== 0) return 'times must be on the hour (e.g. 09:00)';
  if (end - start < 60) return 'shift must be at least 1 hour long';

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
  if (start >= end) return 'break start must be before break end';
  if (start % BREAK_GRANULARITY_MINUTES !== 0 || end % BREAK_GRANULARITY_MINUTES !== 0) {
    return 'break times must land on a quarter hour (e.g. 12:00, 12:15, 12:30)';
  }
  // Inside the shift, inclusive at both edges: a break running right up to the
  // end of the shift is odd but not wrong, and rejecting it would be a rule
  // nobody asked for.
  if (start < shiftStartMinutes || end > shiftEndMinutes) {
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
