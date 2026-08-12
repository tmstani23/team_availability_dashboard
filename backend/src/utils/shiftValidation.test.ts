import { describe, it, expect } from 'vitest';
import {
  parseHHmm,
  durationMinutes,
  validateShiftTimes,
  validateBreakTimes,
  validateDayEntry,
} from './shiftValidation';

// These cover the rules the API enforces before anything is written. Worth
// having for the same reason scheduleTime.ts is tested on the frontend: every
// failure mode here is a SILENT WRONG ANSWER rather than a crash. A malformed
// time that parses to NaN compares false against every bound and sails through
// as valid; an overnight shift measured by subtraction comes out negative and
// looks like a zero-length day. Neither throws, and both end up stored.
//
// Shift bounds are passed to validateBreakTimes as minutes-since-midnight,
// because the route has already parsed them by that point. Named here rather
// than computed through parseHHmm so a bug in the parser can't quietly rewrite
// what the break tests are actually asserting against.
const NINE_AM = 9 * 60;    // 540
const FIVE_PM = 17 * 60;   // 1020
const EIGHT_PM = 20 * 60;  // 1200
const FIVE_AM = 5 * 60;    // 300

describe('parseHHmm', () => {
  it('converts a valid HH:mm string to minutes since midnight', () => {
    expect(parseHHmm('09:00')).toBe(540);
    expect(parseHHmm('12:30')).toBe(750);
  });

  it('handles both ends of the day', () => {
    expect(parseHHmm('00:00')).toBe(0);
    expect(parseHHmm('23:59')).toBe(1439);
  });

  it('rejects out-of-range hours and minutes', () => {
    expect(parseHHmm('24:00')).toBeNull();
    expect(parseHHmm('23:60')).toBeNull();
  });

  // The case that motivates rejecting rather than coercing. '99:99' is the
  // shape the regex accepts and the range check has to catch - the same class
  // of value that slipped past dayjs on 8/8, where it reported isValid() true
  // and silently rolled the date forward four days.
  it('rejects a well-shaped but impossible time', () => {
    expect(parseHHmm('99:99')).toBeNull();
  });

  it('requires two digits in both halves', () => {
    expect(parseHHmm('9:00')).toBeNull();
    expect(parseHHmm('09:0')).toBeNull();
  });

  it('rejects anything with extra characters, including whitespace', () => {
    expect(parseHHmm('09:00:00')).toBeNull();
    expect(parseHHmm(' 09:00')).toBeNull();
    expect(parseHHmm('09:00 ')).toBeNull();
    expect(parseHHmm('')).toBeNull();
    expect(parseHHmm('9a')).toBeNull();
  });

  // The signature takes `unknown` because this parses straight off the wire.
  it('rejects non-strings', () => {
    expect(parseHHmm(null)).toBeNull();
    expect(parseHHmm(undefined)).toBeNull();
    expect(parseHHmm(540)).toBeNull();
    expect(parseHHmm({})).toBeNull();
    expect(parseHHmm(['09:00'])).toBeNull();
  });
});

describe('durationMinutes', () => {
  it('measures a same-day window', () => {
    expect(durationMinutes(NINE_AM, FIVE_PM)).toBe(480);
  });

  // The whole reason this function exists. Plain subtraction gives -900 here.
  it('wraps past midnight instead of going negative', () => {
    expect(durationMinutes(EIGHT_PM, FIVE_AM)).toBe(540);
    expect(durationMinutes(23 * 60, 1 * 60)).toBe(120);
  });

  // Documented behaviour, and the more useful of the two options: treating it
  // as a full 24 hours would turn an obvious typo into a valid all-day shift.
  it('treats an identical start and end as zero, not a full day', () => {
    expect(durationMinutes(NINE_AM, NINE_AM)).toBe(0);
  });

  it('handles a window starting at midnight', () => {
    expect(durationMinutes(0, 23 * 60)).toBe(1380);
  });
});

describe('validateShiftTimes', () => {
  it('accepts a normal same-day shift', () => {
    expect(validateShiftTimes('09:00', '17:00')).toBeNull();
  });

  // Overnight shifts were rejected by an earlier version, which contradicted
  // both the renderer and the README's cross-midnight design constraint.
  it('accepts an overnight shift', () => {
    expect(validateShiftTimes('20:00', '05:00')).toBeNull();
    expect(validateShiftTimes('23:00', '00:00')).toBeNull();
  });

  it('rejects malformed times', () => {
    expect(validateShiftTimes('9:00', '17:00')).toBe('times must be HH:mm (e.g. 09:00)');
    expect(validateShiftTimes(null, '17:00')).toBe('times must be HH:mm (e.g. 09:00)');
    expect(validateShiftTimes('09:00', undefined)).toBe('times must be HH:mm (e.g. 09:00)');
  });

  // Hour-only is enforced here, in HoursEditor, and in TimeSelect's
  // granularity prop. The grid lights whole hour cells, so a boundary at 09:30
  // has nothing to half-light.
  it('rejects times that are not on the hour', () => {
    expect(validateShiftTimes('09:30', '17:00')).toBe('times must be on the hour (e.g. 09:00)');
    expect(validateShiftTimes('09:00', '17:15')).toBe('times must be on the hour (e.g. 09:00)');
  });

  it('rejects a zero-length shift', () => {
    expect(validateShiftTimes('09:00', '09:00')).toBe('start and end time cannot be the same');
  });

  // NOTE: the 'shift must be at least 1 hour long' branch is unreachable given
  // the checks above it - once both times are on the hour, the duration is a
  // multiple of 60, so it is either 0 (caught already) or at least 60. It is
  // left in as a guard in case the hour-only rule is ever relaxed, which is why
  // there is no test for it: no input can currently produce it.
  it('accepts the shortest legal shift', () => {
    expect(validateShiftTimes('09:00', '10:00')).toBeNull();
  });
});

describe('validateBreakTimes', () => {
  it('accepts no break at all, however the absence is expressed', () => {
    expect(validateBreakTimes(undefined, undefined, NINE_AM, FIVE_PM)).toBeNull();
    expect(validateBreakTimes(null, null, NINE_AM, FIVE_PM)).toBeNull();
    expect(validateBreakTimes('', '', NINE_AM, FIVE_PM)).toBeNull();
  });

  // Called out as the likeliest bad payload - a form that cleared one input.
  it('rejects a half-set break from either side', () => {
    expect(validateBreakTimes('12:00', undefined, NINE_AM, FIVE_PM))
      .toBe('a break needs both a start and an end time');
    expect(validateBreakTimes(undefined, '12:30', NINE_AM, FIVE_PM))
      .toBe('a break needs both a start and an end time');
    expect(validateBreakTimes('12:00', '', NINE_AM, FIVE_PM))
      .toBe('a break needs both a start and an end time');
  });

  it('accepts a normal lunch inside the shift', () => {
    expect(validateBreakTimes('12:00', '12:30', NINE_AM, FIVE_PM)).toBeNull();
  });

  it('rejects malformed break times', () => {
    expect(validateBreakTimes('9a', '12:30', NINE_AM, FIVE_PM))
      .toBe('break times must be HH:mm (e.g. 12:00)');
  });

  // Breaks may be finer than shifts - they are drawn as a fractional carve-out
  // inside an hour cell - but only down to a quarter hour.
  it('rejects break times off the quarter hour', () => {
    expect(validateBreakTimes('12:10', '12:30', NINE_AM, FIVE_PM))
      .toBe('break times must land on a quarter hour (e.g. 12:00, 12:15, 12:30)');
    expect(validateBreakTimes('12:00', '12:20', NINE_AM, FIVE_PM))
      .toBe('break times must land on a quarter hour (e.g. 12:00, 12:15, 12:30)');
  });

  it('accepts every quarter-hour boundary', () => {
    expect(validateBreakTimes('12:00', '12:15', NINE_AM, FIVE_PM)).toBeNull();
    expect(validateBreakTimes('12:15', '12:45', NINE_AM, FIVE_PM)).toBeNull();
  });

  it('rejects a backwards or zero-length break on a same-day shift', () => {
    expect(validateBreakTimes('13:00', '12:00', NINE_AM, FIVE_PM))
      .toBe('break start must be before break end');
    expect(validateBreakTimes('12:00', '12:00', NINE_AM, FIVE_PM))
      .toBe('break start must be before break end');
  });

  // NOTE on the containment check these exercise: its first clause
  // (startOffset >= shiftLength) is redundant. Reaching it requires
  // endOffset > startOffset >= shiftLength, which the second clause
  // (endOffset > shiftLength) already catches - brute-forcing every
  // quarter-hour pair against both a same-day and an overnight shift finds no
  // input that trips clause one alone. Harmless, but don't go looking for a
  // test that isolates it, and don't assume deleting it would change
  // behaviour.
  it('rejects a break outside the shift', () => {
    // After the shift ends.
    expect(validateBreakTimes('18:00', '18:30', NINE_AM, FIVE_PM))
      .toBe('break must fall inside the shift hours');
    // Before it starts.
    expect(validateBreakTimes('08:00', '08:30', NINE_AM, FIVE_PM))
      .toBe('break must fall inside the shift hours');
  });

  // Inclusive at the far edge on purpose: a break running right up to the end
  // of a shift is odd but not wrong, and rejecting it invents a rule.
  it('allows a break that ends exactly when the shift does', () => {
    expect(validateBreakTimes('16:00', '17:00', NINE_AM, FIVE_PM)).toBeNull();
  });

  it('allows a break that starts exactly when the shift does', () => {
    expect(validateBreakTimes('09:00', '09:30', NINE_AM, FIVE_PM)).toBeNull();
  });

  // The offset-from-shift-start reasoning earns its keep here. A 23:45-00:15
  // lunch is "backwards" by clock comparison and perfectly legal inside a
  // 20:00-05:00 shift, which is why the plain start >= end check is skipped
  // for overnight shifts.
  describe('on an overnight shift', () => {
    it('allows a break that crosses midnight', () => {
      expect(validateBreakTimes('23:45', '00:15', EIGHT_PM, FIVE_AM)).toBeNull();
    });

    it('allows breaks at either edge', () => {
      expect(validateBreakTimes('20:00', '20:30', EIGHT_PM, FIVE_AM)).toBeNull();
      expect(validateBreakTimes('04:00', '05:00', EIGHT_PM, FIVE_AM)).toBeNull();
    });

    it('still rejects a break outside the shift', () => {
      expect(validateBreakTimes('12:00', '12:30', EIGHT_PM, FIVE_AM))
        .toBe('break must fall inside the shift hours');
    });

    it('still rejects a zero-length break', () => {
      expect(validateBreakTimes('23:45', '23:45', EIGHT_PM, FIVE_AM))
        .toBe('break start must be before break end');
    });
  });
});

describe('validateDayEntry', () => {
  it('rejects a missing or out-of-range dayOfWeek', () => {
    expect(validateDayEntry({ dayOfWeek: -1, isOff: true })).toBe('needs a dayOfWeek 0-6');
    expect(validateDayEntry({ dayOfWeek: 7, isOff: true })).toBe('needs a dayOfWeek 0-6');
    expect(validateDayEntry({ dayOfWeek: '1' as unknown as number, isOff: true }))
      .toBe('needs a dayOfWeek 0-6');
  });

  it('accepts both ends of the weekday range', () => {
    expect(validateDayEntry({ dayOfWeek: 0, isOff: true })).toBeNull();
    expect(validateDayEntry({ dayOfWeek: 6, isOff: true })).toBeNull();
  });

  it('accepts an off day with no hours', () => {
    expect(validateDayEntry({ dayOfWeek: 3, isOff: true })).toBeNull();
  });

  // Rejected rather than ignored: a break on a day someone is not working is
  // incoherent, not merely unused.
  it('rejects a break on an off day', () => {
    expect(validateDayEntry({ dayOfWeek: 3, isOff: true, breakStart: '12:00' }))
      .toBe('an off day cannot have a break');
    expect(validateDayEntry({ dayOfWeek: 3, isOff: true, breakEnd: '12:30' }))
      .toBe('an off day cannot have a break');
  });

  it('requires both times on a working day', () => {
    expect(validateDayEntry({ dayOfWeek: 1, isOff: false, startTime: '09:00' }))
      .toBe('working days need startTime and endTime');
    expect(validateDayEntry({ dayOfWeek: 1, isOff: false, endTime: '17:00' }))
      .toBe('working days need startTime and endTime');
    expect(validateDayEntry({ dayOfWeek: 1, isOff: false }))
      .toBe('working days need startTime and endTime');
  });

  it('accepts a full working day, with and without a break', () => {
    expect(validateDayEntry({
      dayOfWeek: 1, isOff: false, startTime: '09:00', endTime: '17:00',
    })).toBeNull();
    expect(validateDayEntry({
      dayOfWeek: 1, isOff: false, startTime: '09:00', endTime: '17:00',
      breakStart: '12:00', breakEnd: '12:30',
    })).toBeNull();
  });

  it('accepts a full overnight working day with a midnight-crossing break', () => {
    expect(validateDayEntry({
      dayOfWeek: 5, isOff: false, startTime: '20:00', endTime: '05:00',
      breakStart: '23:45', breakEnd: '00:15',
    })).toBeNull();
  });

  it('passes through the shift error', () => {
    expect(validateDayEntry({
      dayOfWeek: 1, isOff: false, startTime: '09:30', endTime: '17:00',
    })).toBe('times must be on the hour (e.g. 09:00)');
  });

  it('passes through the break error', () => {
    expect(validateDayEntry({
      dayOfWeek: 1, isOff: false, startTime: '09:00', endTime: '17:00',
      breakStart: '12:10', breakEnd: '12:30',
    })).toBe('break times must land on a quarter hour (e.g. 12:00, 12:15, 12:30)');
  });

  // Ordering matters: a payload wrong in two ways should report the shift
  // problem, since checking a break against a shift that never validated is
  // what the parsed-bounds signature exists to prevent.
  it('reports the shift problem before the break problem', () => {
    expect(validateDayEntry({
      dayOfWeek: 1, isOff: false, startTime: '09:30', endTime: '17:00',
      breakStart: '12:10', breakEnd: '12:30',
    })).toBe('times must be on the hour (e.g. 09:00)');
  });
});
