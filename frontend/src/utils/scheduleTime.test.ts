import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { RecurringShift } from '../types';
import {
  resolveHourRangeInViewerTz,
  getCurrentShiftForMember,
  isHourInRange,
  formatHourLabel,
  formatHourRange,
  type HourRange,
  type ShiftResolution,
} from './scheduleTime';

// scheduleTime.ts extends these on import, but do it here too so this file
// stands on its own if it ever runs in isolation. Extending twice is a no-op.
dayjs.extend(utc);
dayjs.extend(timezone);

// ---------------------------------------------------------------------------
// How these tests work (quick primer):
//   describe(...)  -> a labelled group of related tests
//   it('...')      -> ONE test; the text reads like a spec of the behavior
//   expect(x).toBe(y)    -> exact match (numbers, strings, booleans, same object)
//   expect(x).toEqual(y) -> same *contents* (use for objects like HourRange)
//   .toBeNull()          -> value is exactly null
//
// KEY IDEA for this file: both shift functions now take a `now` argument (a
// dayjs moment), which we pin to a fixed instant in each test. That's what
// makes "what weekday is it" and "what's the DST offset today" deterministic -
// otherwise these tests would pass or fail depending on the day they run.
// ---------------------------------------------------------------------------

// Pinned moments. The comment on each is the weekday it lands on, which is what
// getCurrentShiftForMember keys off. Verified against real dayjs output.
const MON_NOON_NY = dayjs.tz('2026-07-20 12:00', 'America/New_York');    // Monday (summer / EDT)
const THU_NOON_NY = dayjs.tz('2026-01-15 12:00', 'America/New_York');    // Thursday (winter / EST)
const MON_NOON_TOKYO = dayjs.tz('2026-07-20 12:00', 'Asia/Tokyo');       // Monday in Tokyo
// A single instant that is Friday in UTC/LA but already Saturday in Tokyo -
// used to prove we resolve by the MEMBER's weekday, not the viewer's.
const FRI_2300_UTC = dayjs.utc('2026-07-17 23:00');

// Weekday numbers (0=Sun..6=Sat), named for readability in the fixtures.
const MON = 1;
const TUE = 2;
const FRI = 5;
const SAT = 6;

// Factory: each test spells out only the fields it cares about; the rest get a
// sane default (m1, Monday, 9-5, not off). Pass overrides like
// makeRecurring({ isOff: true }) to tweak one field.
function makeRecurring(overrides: Partial<RecurringShift> = {}): RecurringShift {
  return {
    teamMemberId: 'm1',
    dayOfWeek: MON,
    startTime: '09:00',
    endTime: '17:00',
    isOff: false,
    ...overrides,
  };
}

// Shorthand for building a "working" resolution to feed resolveHourRangeInViewerTz.
function working(startTime = '09:00', endTime = '17:00'): ShiftResolution {
  return { state: 'working', startTime, endTime };
}

describe('getCurrentShiftForMember', () => {
  it('returns the working shift for the member\'s current weekday', () => {
    // now is Monday, member has Monday hours -> working with those times.
    const shifts = [makeRecurring({ dayOfWeek: MON })];
    expect(getCurrentShiftForMember('m1', shifts, 'America/New_York', MON_NOON_NY))
      .toEqual({ state: 'working', startTime: '09:00', endTime: '17:00' });
  });

  it('returns off when the weekday\'s record is marked off', () => {
    // A record exists for today, but isOff -> 'off', distinct from 'unset'.
    const shifts = [makeRecurring({ dayOfWeek: MON, isOff: true })];
    expect(getCurrentShiftForMember('m1', shifts, 'America/New_York', MON_NOON_NY))
      .toEqual({ state: 'off' });
  });

  it('returns unset when there is no record for today\'s weekday', () => {
    // Member only has Tuesday hours; today is Monday -> nothing set for today.
    const shifts = [makeRecurring({ dayOfWeek: TUE })];
    expect(getCurrentShiftForMember('m1', shifts, 'America/New_York', MON_NOON_NY))
      .toEqual({ state: 'unset' });
  });

  it('returns unset when the member owns no records at all', () => {
    const shifts = [makeRecurring({ teamMemberId: 'm2', dayOfWeek: MON })];
    expect(getCurrentShiftForMember('m1', shifts, 'America/New_York', MON_NOON_NY))
      .toEqual({ state: 'unset' });
  });

  it('returns unset when the member timezone is missing', () => {
    // No timezone -> we can't know what weekday it is for them -> unset.
    const shifts = [makeRecurring({ dayOfWeek: MON })];
    expect(getCurrentShiftForMember('m1', shifts, undefined, MON_NOON_NY))
      .toEqual({ state: 'unset' });
  });

  it('resolves by the MEMBER\'s own local weekday, not the viewer\'s', () => {
    // This is the whole point of the presence-tool decision. At this instant
    // it's Friday in UTC but already Saturday in Tokyo. The member has Friday
    // hours and Saturday off. A Tokyo member should resolve to their Saturday
    // (off) - NOT Friday - because we use their local weekday.
    const shifts = [
      makeRecurring({ dayOfWeek: FRI, startTime: '09:00', endTime: '17:00' }),
      makeRecurring({ dayOfWeek: SAT, isOff: true }),
    ];
    expect(getCurrentShiftForMember('m1', shifts, 'Asia/Tokyo', FRI_2300_UTC))
      .toEqual({ state: 'off' });
    // Sanity check the flip side: a UTC member at the same instant is still on
    // Friday, so they resolve to the working Friday record.
    expect(getCurrentShiftForMember('m1', shifts, 'UTC', FRI_2300_UTC))
      .toEqual({ state: 'working', startTime: '09:00', endTime: '17:00' });
  });

  it('matches when teamMemberId is a populated object, not a string', () => {
    // The API can send teamMemberId as a raw id or a populated { _id } object.
    // The cast keeps the fixture small without building a whole TeamMember.
    const populated = makeRecurring({
      teamMemberId: { _id: 'm1' } as unknown as RecurringShift['teamMemberId'],
    });
    expect(getCurrentShiftForMember('m1', [populated], 'America/New_York', MON_NOON_NY))
      .toEqual({ state: 'working', startTime: '09:00', endTime: '17:00' });
  });

  it('treats a working record with missing times as unset', () => {
    // isOff false but no endTime is malformed data the save route shouldn't
    // allow. Rather than hand back half a shift, we report unset.
    const shifts = [makeRecurring({ dayOfWeek: MON, endTime: '' })];
    expect(getCurrentShiftForMember('m1', shifts, 'America/New_York', MON_NOON_NY))
      .toEqual({ state: 'unset' });
  });
});

describe('resolveHourRangeInViewerTz', () => {
  // The function only converts a WORKING resolution; everything else is null.

  it('returns null for a null resolution', () => {
    expect(resolveHourRangeInViewerTz(null, 'UTC', 'UTC', MON_NOON_NY)).toBeNull();
  });

  it('returns null for an off resolution', () => {
    expect(resolveHourRangeInViewerTz({ state: 'off' }, 'UTC', 'UTC', MON_NOON_NY)).toBeNull();
  });

  it('returns null for an unset resolution', () => {
    expect(resolveHourRangeInViewerTz({ state: 'unset' }, 'UTC', 'UTC', MON_NOON_NY)).toBeNull();
  });

  it('returns null when either timezone is missing', () => {
    expect(resolveHourRangeInViewerTz(working(), undefined, 'UTC', MON_NOON_NY)).toBeNull();
    expect(resolveHourRangeInViewerTz(working(), 'UTC', undefined, MON_NOON_NY)).toBeNull();
  });

  it('passes hours through unchanged when member and viewer share a timezone', () => {
    // Same timezone -> no shift in the clock, so 9-5 stays 9-5.
    const r = resolveHourRangeInViewerTz(working(), 'America/New_York', 'America/New_York', MON_NOON_NY);
    expect(r).toEqual({ startHour: 9, endHour: 17, isOvernight: false });
  });

  it('shifts hours back when the viewer is west of the member (NY -> LA)', () => {
    // LA is 3 hours behind NY, so a 9-5 NY shift reads as 6-2 in LA.
    const r = resolveHourRangeInViewerTz(working(), 'America/New_York', 'America/Los_Angeles', MON_NOON_NY);
    expect(r).toEqual({ startHour: 6, endHour: 14, isOvernight: false });
  });

  it('flags overnight when conversion pushes the end past midnight (Tokyo -> LA)', () => {
    // A daytime Tokyo shift lands on the previous evening in LA and crosses
    // midnight: starts 17 (5pm), ends 1 (1am), so isOvernight is true. Anchor
    // date comes from `now` in Tokyo (2026-07-20).
    const r = resolveHourRangeInViewerTz(working(), 'Asia/Tokyo', 'America/Los_Angeles', MON_NOON_TOKYO);
    expect(r).toEqual({ startHour: 17, endHour: 1, isOvernight: true });
  });

  // Matched DST pair: NY is UTC-4 in summer but UTC-5 in winter, so the SAME
  // 9am shift converts to a different UTC hour depending on the date. The date
  // now comes from `now` (recurring records carry none), so these prove the
  // anchoring still respects the calendar.

  it('respects daylight saving in summer (NY -> UTC, July)', () => {
    // July: NY is 4 behind UTC, so 9am NY = 13:00 UTC.
    const r = resolveHourRangeInViewerTz(working(), 'America/New_York', 'UTC', MON_NOON_NY);
    expect(r).toEqual({ startHour: 13, endHour: 21, isOvernight: false });
  });

  it('respects standard time in winter (NY -> UTC, January)', () => {
    // January: NY is 5 behind UTC, so the same 9am NY = 14:00 UTC (one hour
    // later than July - that difference is the whole point).
    const r = resolveHourRangeInViewerTz(working(), 'America/New_York', 'UTC', THU_NOON_NY);
    expect(r).toEqual({ startHour: 14, endHour: 22, isOvernight: false });
  });
});

describe('isHourInRange', () => {
  const normal: HourRange = { startHour: 9, endHour: 17, isOvernight: false };
  const overnight: HourRange = { startHour: 22, endHour: 6, isOvernight: true };

  it('returns false for a null range', () => {
    expect(isHourInRange(null, 10)).toBe(false);
  });

  it('normal range: inside is true, boundaries are half-open [start, end)', () => {
    // Start hour counts as inside; end hour does NOT (avoids double-counting
    // the boundary hour if it also starts a later block).
    expect(isHourInRange(normal, 12)).toBe(true);  // clearly inside
    expect(isHourInRange(normal, 9)).toBe(true);   // start hour: included
    expect(isHourInRange(normal, 17)).toBe(false); // end hour: excluded
    expect(isHourInRange(normal, 8)).toBe(false);  // before it starts
  });

  it('overnight range: hours after start OR before end are inside', () => {
    expect(isHourInRange(overnight, 23)).toBe(true);  // late night, after start
    expect(isHourInRange(overnight, 2)).toBe(true);   // early morning, before end
    expect(isHourInRange(overnight, 6)).toBe(false);  // end hour still excluded
    expect(isHourInRange(overnight, 12)).toBe(false); // midday, off shift
  });
});

describe('formatHourLabel / formatHourRange', () => {
  it('formats 12-hour labels with correct AM/PM and midnight/noon', () => {
    // The two easy ones to get wrong: midnight (0 -> 12AM) and noon (12 -> 12PM).
    expect(formatHourLabel(0)).toBe('12AM');
    expect(formatHourLabel(12)).toBe('12PM');
    expect(formatHourLabel(13)).toBe('1PM');
    expect(formatHourLabel(9)).toBe('9AM');
  });

  it('formats a range, and returns a placeholder for null', () => {
    // The dash is an en-dash, matching the source exactly - a plain hyphen
    // here would make the test fail.
    expect(formatHourRange({ startHour: 9, endHour: 17, isOvernight: false })).toBe('9AM–5PM');
    expect(formatHourRange(null)).toBe('No shift');
  });
});
