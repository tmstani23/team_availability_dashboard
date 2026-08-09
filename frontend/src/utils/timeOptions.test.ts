import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
  hourOptions,
  groupedHourOptions,
  hourGroupLabel,
  minuteOptions,
  splitWallClock,
  joinWallClock,
  dayOptions,
} from './timeOptions';

dayjs.extend(utc);
dayjs.extend(timezone);

describe('hourOptions', () => {
  it('covers all 24 hours with 12-hour labels', () => {
    const options = hourOptions();
    expect(options).toHaveLength(24);
    expect(options[0]).toEqual({ value: '00', label: '12AM' });
    expect(options[9]).toEqual({ value: '09', label: '9AM' });
    expect(options[12]).toEqual({ value: '12', label: '12PM' });
    expect(options[23]).toEqual({ value: '23', label: '11PM' });
  });

  // The VALUES stay 24-hour and zero-padded because they're half of the
  // "HH:mm" the API stores. Only the labels are 12-hour.
  it('keeps values zero-padded 24-hour', () => {
    expect(hourOptions().every(o => /^\d{2}$/.test(o.value))).toBe(true);
  });
});

describe('groupedHourOptions', () => {
  it('keeps every hour, in clock order, across the groups', () => {
    const flat = groupedHourOptions().flatMap(g => g.options);
    expect(flat).toEqual(hourOptions());
  });

  // Night wraps both ends of the day, so it has to open a SECOND group at
  // 9PM rather than reopening the one that started at midnight - otherwise
  // the late hours would jump back up next to 12AM and break clock order.
  it('splits the wrapping night group in two rather than reordering', () => {
    const groups = groupedHourOptions();
    expect(groups.map(g => g.label)).toEqual([
      'Night',
      'Morning',
      'Afternoon',
      'Evening',
      'Night',
    ]);
    expect(groups[0].options[0].value).toBe('00');
    expect(groups[4].options[0].value).toBe('21');
  });

  it('labels the boundary hours on the expected side', () => {
    expect(hourGroupLabel(5)).toBe('Night');
    expect(hourGroupLabel(6)).toBe('Morning');
    expect(hourGroupLabel(11)).toBe('Morning');
    expect(hourGroupLabel(12)).toBe('Afternoon');
    expect(hourGroupLabel(17)).toBe('Evening');
    expect(hourGroupLabel(21)).toBe('Night');
  });
});

describe('minuteOptions', () => {
  it('offers the four quarter hours', () => {
    expect(minuteOptions()).toEqual([
      { value: '00', label: ':00' },
      { value: '15', label: ':15' },
      { value: '30', label: ':30' },
      { value: '45', label: ':45' },
    ]);
  });

  it('leaves the list alone when the current value is already a quarter', () => {
    expect(minuteOptions('30')).toHaveLength(4);
  });

  // A select whose value matches no option renders blank and reads back as
  // its first option - so an odd stored minute would silently save as :00.
  it('injects an off-quarter stored minute in sorted position', () => {
    const options = minuteOptions('37');
    expect(options).toHaveLength(5);
    expect(options.map(o => o.value)).toEqual(['00', '15', '30', '37', '45']);
  });

  it('ignores a malformed or impossible current value', () => {
    expect(minuteOptions('nope')).toHaveLength(4);
    expect(minuteOptions('99')).toHaveLength(4);
    expect(minuteOptions('')).toHaveLength(4);
  });
});

describe('splitWallClock / joinWallClock', () => {
  it('splits a well-formed time', () => {
    expect(splitWallClock('09:30')).toEqual({ hour: '09', minute: '30' });
    expect(splitWallClock('00:00')).toEqual({ hour: '00', minute: '00' });
    expect(splitWallClock('23:45')).toEqual({ hour: '23', minute: '45' });
  });

  it('returns null rather than guessing at a bad value', () => {
    expect(splitWallClock('24:00')).toBeNull();
    expect(splitWallClock('09:75')).toBeNull();
    expect(splitWallClock('9:30')).toBeNull();
    expect(splitWallClock('nonsense')).toBeNull();
    expect(splitWallClock(undefined)).toBeNull();
    expect(splitWallClock(null)).toBeNull();
  });

  // The round trip is the contract the whole component rests on: the split is
  // a rendering detail, and what reaches the API has to be byte-identical to
  // what came out of it.
  it('round-trips every hour and quarter without drift', () => {
    for (const hour of hourOptions()) {
      for (const minute of minuteOptions()) {
        const joined = joinWallClock(hour.value, minute.value);
        expect(joined).toMatch(/^\d{2}:\d{2}$/);
        expect(splitWallClock(joined)).toEqual({ hour: hour.value, minute: minute.value });
      }
    }
  });
});

describe('dayOptions', () => {
  // Pinned instant: 2026-08-08 19:00 in Chicago.
  const now = dayjs.tz('2026-08-08 19:00', 'America/Chicago');

  it("starts at the viewer's today and names the first two days", () => {
    const options = dayOptions('America/Chicago', now);
    expect(options).toHaveLength(14);
    expect(options[0]).toEqual({ value: '2026-08-08', label: 'Today' });
    expect(options[1]).toEqual({ value: '2026-08-09', label: 'Tomorrow' });
    expect(options[2]).toEqual({ value: '2026-08-10', label: 'Mon, Aug 10' });
  });

  // The whole reason this takes a timezone: at 7pm Chicago it is already the
  // next day in Tokyo, so "today" is a different date depending on the clock.
  it("resolves today on the given zone, not the machine's", () => {
    expect(dayOptions('America/Chicago', now)[0].value).toBe('2026-08-08');
    expect(dayOptions('Asia/Tokyo', now)[0].value).toBe('2026-08-09');
  });

  it('honours the requested length', () => {
    expect(dayOptions('America/Chicago', now, 3)).toHaveLength(3);
  });

  // An empty list degrades to an empty control; throwing would take the whole
  // booking form down with it.
  it('returns an empty list for a missing or unusable zone', () => {
    expect(dayOptions(undefined, now)).toEqual([]);
    expect(dayOptions('Not/AZone', now)).toEqual([]);
  });
});
