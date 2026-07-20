import { describe, it, expect } from 'vitest';
import type { WorkShift } from '../types';
import {
  resolveHourRangeInViewerTz,
  getCurrentShiftForMember,
  isHourInRange,
  formatHourLabel,
  formatHourRange,
  type HourRange,
} from './scheduleTime';

// ---------------------------------------------------------------------------
// How these tests work (quick primer, since this is your first test file):
//   describe(...)  -> just a labelled folder that groups related tests
//   it('...')      -> ONE test. The text is a sentence describing what should
//                     happen, so a run reads like a spec of the function.
//   expect(x).toBe(y) -> the actual check. If x doesn't equal y, the test
//                        fails and Vitest prints what it got vs. what it wanted.
// Matchers you'll see below:
//   .toBe(v)       -> exact match. Use for numbers, strings, booleans, or
//                     "the very same object".
//   .toEqual(v)    -> same *contents*. Use for objects like HourRange, where
//                     you care that the fields match, not that it's the same
//                     object in memory.
//   .toBeNull()    -> value is exactly null.
//   .toBeUndefined() -> value is exactly undefined.
// Every test follows the same rhythm: build some input, call the function,
// then assert what came back.
// ---------------------------------------------------------------------------

// Factory so each test only spells out the fields it cares about; everything
// else gets a sane default. Call makeShift() for a normal shift, or pass
// overrides like makeShift({ date: '' }) to tweak one field.
function makeShift(overrides: Partial<WorkShift> = {}): WorkShift {
  return {
    teamMemberId: 'm1',
    date: '2026-07-20',
    startTime: '09:00',
    endTime: '17:00',
    ...overrides,
  };
}

describe('resolveHourRangeInViewerTz', () => {
  // The function bails out (returns null) on bad input. These first three
  // tests each feed it one kind of bad input and check we get null back.

  it('returns null when shift is undefined', () => {
    // No shift at all -> nothing to convert -> null.
    expect(resolveHourRangeInViewerTz(undefined, 'UTC', 'UTC')).toBeNull();
  });

  it('returns null when a required shift field is missing', () => {
    // A shift with a blank date can't be pinned to a real moment in time,
    // so the function should refuse it and return null.
    const bad = makeShift({ date: '' });
    expect(resolveHourRangeInViewerTz(bad, 'UTC', 'UTC')).toBeNull();
  });

  it('returns null when either timezone is missing', () => {
    // Two checks in one test: no member tz, then no viewer tz. Either gap
    // makes the conversion impossible, so both should return null.
    expect(resolveHourRangeInViewerTz(makeShift(), undefined, 'UTC')).toBeNull();
    expect(resolveHourRangeInViewerTz(makeShift(), 'UTC', undefined)).toBeNull();
  });

  it('passes hours through unchanged when member and viewer share a timezone', () => {
    // Same timezone on both sides means no shift in the clock, so a 9-5
    // shift should come back as exactly 9-5. toEqual compares all three
    // fields of the returned object at once.
    const r = resolveHourRangeInViewerTz(makeShift(), 'America/New_York', 'America/New_York');
    expect(r).toEqual({ startHour: 9, endHour: 17, isOvernight: false });
  });

  it('shifts hours back when the viewer is west of the member (NY -> LA)', () => {
    // LA is 3 hours behind New York, so a 9-5 NY shift looks like 6-2 to a
    // viewer in LA. We assert the exact converted hours (6 and 14).
    const r = resolveHourRangeInViewerTz(makeShift(), 'America/New_York', 'America/Los_Angeles');
    expect(r).toEqual({ startHour: 6, endHour: 14, isOvernight: false });
  });

  it('flags overnight when conversion pushes the end past midnight (Tokyo -> LA)', () => {
    // A normal daytime Tokyo shift lands on the PREVIOUS evening in LA and
    // crosses midnight there: it starts at 17 (5pm) and ends at 1 (1am).
    // Because the end hour (1) is smaller than the start hour (17), the
    // function marks it isOvernight: true. This is the case we most want to
    // pin down, since off-by-one overnight bugs are easy to introduce.
    const r = resolveHourRangeInViewerTz(makeShift(), 'Asia/Tokyo', 'America/Los_Angeles');
    expect(r).toEqual({ startHour: 17, endHour: 1, isOvernight: true });
  });

  // These next two are a matched pair that prove the conversion actually
  // looks at the calendar date. New York is UTC-4 in summer but UTC-5 in
  // winter (daylight saving). So the SAME 9am shift converts to a different
  // UTC hour depending on the month. If someone ever broke the timezone
  // handling so it ignored the date, one of these two would fail.

  it('respects daylight saving in summer (NY -> UTC, July)', () => {
    // July: NY is 4 hours behind UTC, so 9am NY = 1pm (13:00) UTC.
    const r = resolveHourRangeInViewerTz(makeShift({ date: '2026-07-20' }), 'America/New_York', 'UTC');
    expect(r).toEqual({ startHour: 13, endHour: 21, isOvernight: false });
  });

  it('respects standard time in winter (NY -> UTC, January)', () => {
    // January: NY is 5 hours behind UTC, so the same 9am NY = 2pm (14:00) UTC.
    // Note the hour differs from the July test above by exactly 1.
    const r = resolveHourRangeInViewerTz(makeShift({ date: '2026-01-15' }), 'America/New_York', 'UTC');
    expect(r).toEqual({ startHour: 14, endHour: 22, isOvernight: false });
  });
});

describe('isHourInRange', () => {
  // Two fixed ranges to test against. No timezones here - this function just
  // answers "is this hour inside this range?", including the tricky overnight
  // case where the range wraps past midnight.
  const normal: HourRange = { startHour: 9, endHour: 17, isOvernight: false };
  const overnight: HourRange = { startHour: 22, endHour: 6, isOvernight: true };

  it('returns false for a null range', () => {
    // No range means "no shift", so no hour can be inside it.
    expect(isHourInRange(null, 10)).toBe(false);
  });

  it('normal range: inside is true, boundaries are half-open [start, end)', () => {
    // "Half-open" means the start hour counts as inside but the end hour does
    // NOT - so a 9-17 shift includes 9 but stops just before 17. That avoids
    // double-counting hour 17 if it were also the start of a later block.
    expect(isHourInRange(normal, 12)).toBe(true);  // clearly inside
    expect(isHourInRange(normal, 9)).toBe(true);   // start hour: included
    expect(isHourInRange(normal, 17)).toBe(false); // end hour: excluded
    expect(isHourInRange(normal, 8)).toBe(false);  // before it starts
  });

  it('overnight range: hours after start OR before end are inside', () => {
    // A 22-6 shift is "inside" if the hour is late enough (>= 22) OR early
    // enough (< 6). The midday hours in between are off shift.
    expect(isHourInRange(overnight, 23)).toBe(true);  // late night, after start
    expect(isHourInRange(overnight, 2)).toBe(true);   // early morning, before end
    expect(isHourInRange(overnight, 6)).toBe(false);  // end hour still excluded
    expect(isHourInRange(overnight, 12)).toBe(false); // midday, clearly off shift
  });
});

describe('getCurrentShiftForMember', () => {
  it('returns the matching shift when teamMemberId is a raw string', () => {
    // Give it two shifts for two different people and ask for m1's. It should
    // hand back the one whose teamMemberId is 'm1'.
    const shifts = [makeShift({ teamMemberId: 'm1' }), makeShift({ teamMemberId: 'm2' })];
    expect(getCurrentShiftForMember('m1', shifts)?.teamMemberId).toBe('m1');
  });

  it('matches when teamMemberId is a populated object, not a string', () => {
    // The backend sometimes sends teamMemberId as just an id string, and
    // sometimes as a full object like { _id: 'm1', ...name etc }. This checks
    // the function still finds the member in the object case. (The cast is
    // just to keep the fake shift small without building a whole member.)
    const populated = makeShift({
      teamMemberId: { _id: 'm1' } as unknown as WorkShift['teamMemberId'],
    });
    // toBe here checks we got back that exact same shift object we passed in.
    expect(getCurrentShiftForMember('m1', [populated])).toBe(populated);
  });

  it('returns undefined when the member has no shift', () => {
    // Asking for someone who owns none of the shifts should return undefined
    // (the function's way of saying "found nothing").
    expect(getCurrentShiftForMember('nobody', [makeShift({ teamMemberId: 'm1' })])).toBeUndefined();
  });

  it('ignores records missing date/startTime/endTime', () => {
    // A shift with a blank endTime is incomplete, so even though it belongs
    // to m1 the function skips it and returns undefined.
    const incomplete = makeShift({ teamMemberId: 'm1', endTime: '' });
    expect(getCurrentShiftForMember('m1', [incomplete])).toBeUndefined();
  });
});

describe('formatHourLabel / formatHourRange', () => {
  it('formats 12-hour labels with correct AM/PM and midnight/noon', () => {
    // These turn a 0-23 hour number into a friendly label. The two easy ones
    // to get wrong are midnight (0 -> 12AM, not 0AM) and noon (12 -> 12PM).
    expect(formatHourLabel(0)).toBe('12AM');
    expect(formatHourLabel(12)).toBe('12PM');
    expect(formatHourLabel(13)).toBe('1PM');
    expect(formatHourLabel(9)).toBe('9AM');
  });

  it('formats a range, and returns a placeholder for null', () => {
    // A real range becomes "9AM-5PM" (note: the dash is an en-dash, matching
    // the source exactly - a plain hyphen here would make the test fail).
    // A null range becomes the friendly "No shift" text instead.
    expect(formatHourRange({ startHour: 9, endHour: 17, isOvernight: false })).toBe('9AM–5PM');
    expect(formatHourRange(null)).toBe('No shift');
  });
});
