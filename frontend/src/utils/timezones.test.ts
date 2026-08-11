import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { TIMEZONE_OPTIONS, isCuratedTimezone } from './timezones';

dayjs.extend(utc);
dayjs.extend(timezone);

// These cover the LIST as data, which is the part that can rot silently.
// The select rendering itself needs a DOM and belongs to the jsdom work; what
// can be checked here is that every value in the list is a zone the app can
// actually convert with, and that isCuratedTimezone agrees with the list.
//
// Worth having because a typo'd zone doesn't fail loudly. It saves fine, and
// then every shift conversion for whoever picked it is wrong on every viewer's
// grid - the same failure mode the backend's Intl validation guards from the
// other side.
describe('TIMEZONE_OPTIONS', () => {
  it('has no duplicate values', () => {
    const values = TIMEZONE_OPTIONS.map(option => option.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('gives every option a non-empty label', () => {
    for (const option of TIMEZONE_OPTIONS) {
      expect(option.label.trim()).not.toBe('');
    }
  });

  // The real one. Intl throws a RangeError on an unknown zone, which is the
  // same check the backend's PATCH /:id/timezone runs - so a value that fails
  // here would be offered by the UI and then rejected by the server.
  it('offers only zones Intl recognises', () => {
    for (const option of TIMEZONE_OPTIONS) {
      expect(
        () => new Intl.DateTimeFormat('en-US', { timeZone: option.value }),
        `${option.value} is not a valid IANA zone`
      ).not.toThrow();
    }
  });

  // Intl accepting a zone isn't quite enough: dayjs.tz is what the grid
  // actually converts through, so pin that each option survives a round trip
  // rather than yielding an Invalid Date.
  it('offers only zones dayjs can convert into', () => {
    for (const option of TIMEZONE_OPTIONS) {
      const converted = dayjs.utc('2026-08-11T12:00:00Z').tz(option.value);
      expect(converted.isValid(), `${option.value} did not convert`).toBe(true);
    }
  });

  // The two zones the drift bug was actually about: TeamMemberCard's old
  // hardcoded list omitted them while AddTeamMemberForm offered them, so a
  // member could be created in one and silently reset out of it by the other.
  it('includes the zones the old per-component lists disagreed about', () => {
    const values = TIMEZONE_OPTIONS.map(option => option.value);
    expect(values).toContain('Australia/Sydney');
    expect(values).toContain('Europe/Paris');
  });
});

describe('isCuratedTimezone', () => {
  it('is true for every value in the list', () => {
    for (const option of TIMEZONE_OPTIONS) {
      expect(isCuratedTimezone(option.value)).toBe(true);
    }
  });

  // A valid IANA zone that simply isn't offered. This is the case that makes
  // the select append an extra option instead of dropping the stored value,
  // so it has to read false rather than throwing.
  it('is false for a valid zone that is not curated', () => {
    expect(isCuratedTimezone('Africa/Nairobi')).toBe(false);
  });

  it('is false for empty, null and undefined', () => {
    expect(isCuratedTimezone('')).toBe(false);
    expect(isCuratedTimezone(null)).toBe(false);
    expect(isCuratedTimezone(undefined)).toBe(false);
  });

  // Guards the comparison staying an exact string match. Zone ids are
  // case-sensitive and Intl rejects the wrong casing, so treating this as
  // curated would let an unconvertible value through as if it were fine.
  it('does not match on differing case', () => {
    expect(isCuratedTimezone('australia/sydney')).toBe(false);
  });
});
