import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { RecurringShift } from '../types';
import {
  resolveHourRangeInViewerTz,
  getCurrentShiftForMember,
  getScheduleState,
  isHourInRange,
  formatHourLabel,
  formatHourRange,
  type HourRange,
  type ShiftResolution,
} from './scheduleTime';
import { resolveDisplayStatus } from './status';

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

// ---------------------------------------------------------------------------
// getScheduleState - the signal the derived-offline status layer runs on.
// The important distinction under test: 'off-shift' is a POSITIVE claim that
// someone isn't working, while 'unknown' means we have no hours on file and
// can't say either way. Only the former is allowed to override what a member
// set for themselves (see resolveDisplayStatus).
// Note this is minute-accurate, unlike the hour-bucketed grid: finishing at
// 17:00 means 17:30 is off shift, not still working.
// ---------------------------------------------------------------------------
describe('getScheduleState', () => {
  // Reuses the module-level working() helper defined above.

  it('is on-shift inside the hours, judged on the MEMBER own clock', () => {
    // Noon in NY, working 09:00-17:00 NY time -> inside.
    expect(getScheduleState(working('09:00', '17:00'), 'America/New_York', MON_NOON_NY))
      .toBe('on-shift');
  });

  it('is off-shift before start and at/after end on a working day', () => {
    // Same pinned noon, but hours that do not contain it.
    expect(getScheduleState(working('13:00', '17:00'), 'America/New_York', MON_NOON_NY))
      .toBe('off-shift');
    expect(getScheduleState(working('06:00', '11:00'), 'America/New_York', MON_NOON_NY))
      .toBe('off-shift');
  });

  it('treats the end time as exclusive, matching isHourInRange', () => {
    // Finishing at 12:00 means 12:00 itself is already off - half-open
    // [start, end). Starting at 12:00 is inside.
    expect(getScheduleState(working('09:00', '12:00'), 'America/New_York', MON_NOON_NY))
      .toBe('off-shift');
    expect(getScheduleState(working('12:00', '17:00'), 'America/New_York', MON_NOON_NY))
      .toBe('on-shift');
  });

  it('handles an overnight shift as the union of both pieces', () => {
    // 22:00-06:00 wraps midnight. Noon is squarely outside it; the wrap
    // itself is covered by the Tokyo case below.
    expect(getScheduleState(working('22:00', '06:00'), 'America/New_York', MON_NOON_NY))
      .toBe('off-shift');
    // Midnight in Tokyo, working 22:00-06:00 -> inside the after-midnight half.
    const TOKYO_MIDNIGHT = dayjs.tz('2026-07-21 00:30', 'Asia/Tokyo');
    expect(getScheduleState(working('22:00', '06:00'), 'Asia/Tokyo', TOKYO_MIDNIGHT))
      .toBe('on-shift');
  });

  it('uses the MEMBER timezone, not the pinned moment own zone', () => {
    // One instant: noon Monday in NY is 01:00 Tuesday in Tokyo. A Tokyo
    // member working 09:00-17:00 is asleep, not at work - this is the case
    // that breaks if the conversion is dropped.
    expect(getScheduleState(working('09:00', '17:00'), 'Asia/Tokyo', MON_NOON_NY))
      .toBe('off-shift');
  });

  it('maps an explicit off day to off-shift, and no record to unknown', () => {
    // The whole point of the split: off is a fact, unset is an absence of one.
    expect(getScheduleState({ state: 'off' }, 'America/New_York', MON_NOON_NY))
      .toBe('off-shift');
    expect(getScheduleState({ state: 'unset' }, 'America/New_York', MON_NOON_NY))
      .toBe('unknown');
  });

  it('falls back to unknown rather than off-shift when data is unusable', () => {
    // No timezone means we cannot place them on a clock, and a malformed time
    // must not compare against NaN (silently false -> would read as off-shift).
    expect(getScheduleState(working('09:00', '17:00'), undefined, MON_NOON_NY))
      .toBe('unknown');
    expect(getScheduleState(working('oops', '17:00'), 'America/New_York', MON_NOON_NY))
      .toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// resolveDisplayStatus - the precedence rule (Phase 1 adds the heartbeat
// layer on top):
//   no recent heartbeat -> offline (wins) -> off-shift -> offline (wins) ->
//   otherwise stored -> otherwise away
//
// Heartbeat args are plain millisecond numbers (see status.ts for why - it
// stays free of dayjs). NOW is an arbitrary fixed instant; STALE mirrors
// HEARTBEAT_STALE_MS. Existing off-shift/stored/fallback tests pass
// lastSeenAtMs: undefined - "no heartbeat info at all" - so they exercise
// exactly the same precedence as before this layer existed.
// ---------------------------------------------------------------------------
describe('resolveDisplayStatus', () => {
  const NOW = 1_700_000_000_000;
  const STALE = 45 * 1000;

  it('derives offline when off shift, overriding whatever was set', () => {
    // The stale-claim case: they clicked Active this morning and left.
    expect(resolveDisplayStatus('active', 'off-shift', undefined, NOW, STALE)).toBe('offline');
    expect(resolveDisplayStatus('dnd', 'off-shift', undefined, NOW, STALE)).toBe('offline');
  });

  it('respects the stored status while on shift', () => {
    expect(resolveDisplayStatus('active', 'on-shift', undefined, NOW, STALE)).toBe('active');
    expect(resolveDisplayStatus('dnd', 'on-shift', undefined, NOW, STALE)).toBe('dnd');
    expect(resolveDisplayStatus('away', 'on-shift', undefined, NOW, STALE)).toBe('away');
  });

  it('does NOT derive offline when the schedule is unknown', () => {
    // No hours on file is not evidence they are off - asserting offline here
    // would be an unearned claim. The "Hours not set" label carries this.
    expect(resolveDisplayStatus('active', 'unknown', undefined, NOW, STALE)).toBe('active');
  });

  it('falls back to away when nothing was ever set', () => {
    // 'active' is a claim only the person can make, so an absent value means
    // "no signal yet" - matching the TeamMember schema default.
    expect(resolveDisplayStatus(undefined, 'unknown', undefined, NOW, STALE)).toBe('away');
    expect(resolveDisplayStatus(undefined, 'on-shift', undefined, NOW, STALE)).toBe('away');
    // ...but a known off-shift still wins over the fallback.
    expect(resolveDisplayStatus(undefined, 'off-shift', undefined, NOW, STALE)).toBe('offline');
  });

  describe('heartbeat layer (Phase 1)', () => {
    it('derives offline when the heartbeat is stale, even on-shift with active set', () => {
      // The case the layer exists for: shift says they should be here, they
      // last claimed 'active', but nothing has pinged the server in a while.
      const staleSeen = NOW - STALE - 1;
      expect(resolveDisplayStatus('active', 'on-shift', staleSeen, NOW, STALE)).toBe('offline');
    });

    it('does NOT derive offline right at the threshold, only once past it', () => {
      // Exactly STALE ms old is still within grace (comparison is strictly
      // greater-than) - avoids flapping someone offline on a borderline poll.
      const atThreshold = NOW - STALE;
      expect(resolveDisplayStatus('active', 'on-shift', atThreshold, NOW, STALE)).toBe('active');

      const pastThreshold = NOW - STALE - 1;
      expect(resolveDisplayStatus('active', 'on-shift', pastThreshold, NOW, STALE)).toBe('offline');
    });

    it('a fresh heartbeat does not override off-shift or the stored status', () => {
      const freshSeen = NOW - 5000;
      expect(resolveDisplayStatus('active', 'off-shift', freshSeen, NOW, STALE)).toBe('offline');
      expect(resolveDisplayStatus('dnd', 'on-shift', freshSeen, NOW, STALE)).toBe('dnd');
    });

    it('never-logged-in (no lastSeenAt at all) falls through instead of deriving offline', () => {
      // This is the critical distinction from "stale": undefined is an
      // ABSENCE of information, not evidence of one. A member an admin just
      // created, who has never logged in, should read as their stored
      // status (defaulting to away), not offline.
      expect(resolveDisplayStatus('active', 'on-shift', undefined, NOW, STALE)).toBe('active');
      expect(resolveDisplayStatus(undefined, 'unknown', undefined, NOW, STALE)).toBe('away');
    });
  });
});
