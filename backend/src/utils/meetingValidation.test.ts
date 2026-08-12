import { describe, it, expect } from 'vitest';
import {
  parseInstant,
  normalizeAttendeeIds,
  validateMeetingInput,
} from './meetingValidation';

// The counterpart to shiftValidation.test.ts, and the contrast between the two
// is the point. Shifts are wall-clock strings with no date, so they wrap past
// midnight and have to land on the hour. A meeting is a single UTC instant, so
// there is no wrap and no "on the hour" - but there IS a new failure mode the
// shift side doesn't have: a client can send a string that names a wall clock
// rather than an instant, and guessing a zone for it is exactly the bug the
// whole meeting model was built to avoid.

// Real 24-hex ObjectIds. Worth knowing when adding cases here:
// mongoose.isValidObjectId also accepts ANY 12-character string (12 raw bytes
// is a valid ObjectId), so a plausible-looking 12-char placeholder would pass
// and make a "rejects junk" test quietly assert nothing.
const ALICE = '507f1f77bcf86cd799439011';
const BOB = '507f191e810c19729de860ea';

describe('parseInstant', () => {
  it('parses a UTC timestamp to epoch milliseconds', () => {
    expect(parseInstant('2026-08-03T14:00:00Z')).toBe(Date.UTC(2026, 7, 3, 14, 0, 0));
  });

  it('accepts the optional seconds and fractional seconds', () => {
    expect(parseInstant('2026-08-03T14:00Z')).toBe(Date.UTC(2026, 7, 3, 14, 0, 0));
    expect(parseInstant('2026-08-03T14:00:00.500Z')).toBe(Date.UTC(2026, 7, 3, 14, 0, 0) + 500);
  });

  // An instant is an instant regardless of which zone the client wrote it in,
  // so an explicit offset is as acceptable as Z and must normalize to the same
  // number. This is the property that lets the API stay zone-agnostic.
  it('normalizes an explicit offset to the same instant as Z', () => {
    const utc = parseInstant('2026-08-03T14:00:00Z');
    expect(parseInstant('2026-08-03T19:00:00+05:00')).toBe(utc);
    expect(parseInstant('2026-08-03T09:00:00-05:00')).toBe(utc);
  });

  // The rejection that matters most. '2026-08-03T14:00' names a wall clock,
  // not a moment - accepting it would mean picking a timezone on the client's
  // behalf, which is the wall-clock/instant mixing this model exists to
  // prevent.
  it('rejects a timestamp with no offset', () => {
    expect(parseInstant('2026-08-03T14:00:00')).toBeNull();
    expect(parseInstant('2026-08-03T14:00')).toBeNull();
  });

  it('rejects a space-separated datetime', () => {
    expect(parseInstant('2026-08-03 14:00:00Z')).toBeNull();
  });

  it('rejects a date with no time', () => {
    expect(parseInstant('2026-08-03')).toBeNull();
  });

  // Well-shaped enough for the regex, impossible as a date. The regex only
  // checks digit counts, so this is the case Number.isFinite has to catch -
  // new Date() returns Invalid Date, whose NaN timestamp compares false
  // against every duration bound below and would otherwise look valid.
  it('rejects a well-shaped but impossible instant', () => {
    expect(parseInstant('2026-13-45T99:99Z')).toBeNull();
  });

  it('rejects free text and non-strings', () => {
    expect(parseInstant('tomorrow')).toBeNull();
    expect(parseInstant('')).toBeNull();
    expect(parseInstant(null)).toBeNull();
    expect(parseInstant(undefined)).toBeNull();
    expect(parseInstant(1754229600000)).toBeNull();
    expect(parseInstant(new Date())).toBeNull();
  });
});

describe('normalizeAttendeeIds', () => {
  it('accepts a list of valid ids', () => {
    expect(normalizeAttendeeIds([ALICE, BOB])).toEqual({ ids: [ALICE, BOB] });
  });

  // Collapsed rather than rejected: ticking a name twice is a UI bug, and the
  // consequence of letting it through is a member's row drawing the same
  // meeting twice.
  it('collapses duplicates while preserving order', () => {
    expect(normalizeAttendeeIds([ALICE, BOB, ALICE])).toEqual({ ids: [ALICE, BOB] });
  });

  it('rejects an empty list', () => {
    expect(normalizeAttendeeIds([])).toEqual({ error: 'a meeting needs at least one attendee' });
  });

  it('rejects anything that is not an array', () => {
    expect(normalizeAttendeeIds(ALICE)).toEqual({ error: 'a meeting needs at least one attendee' });
    expect(normalizeAttendeeIds(null)).toEqual({ error: 'a meeting needs at least one attendee' });
    expect(normalizeAttendeeIds(undefined)).toEqual({ error: 'a meeting needs at least one attendee' });
  });

  it('rejects a list containing anything that is not an id', () => {
    expect(normalizeAttendeeIds(['nope'])).toEqual({ error: 'attendeeIds must be team member ids' });
    expect(normalizeAttendeeIds([ALICE, 42])).toEqual({ error: 'attendeeIds must be team member ids' });
    expect(normalizeAttendeeIds([ALICE, null])).toEqual({ error: 'attendeeIds must be team member ids' });
  });
});

describe('validateMeetingInput', () => {
  // A valid payload, spread into each case so a test only states what it is
  // changing. 14:00-14:30 UTC, one attendee.
  const valid = {
    title: 'Standup',
    startsAt: '2026-08-03T14:00:00Z',
    endsAt: '2026-08-03T14:30:00Z',
    attendeeIds: [ALICE],
  };

  it('returns the parsed payload when everything is fine', () => {
    const result = validateMeetingInput(valid);
    if ('error' in result) throw new Error(`unexpected error: ${result.error}`);

    expect(result.title).toBe('Standup');
    expect(result.startsAtMs).toBe(Date.UTC(2026, 7, 3, 14, 0, 0));
    expect(result.endsAtMs).toBe(Date.UTC(2026, 7, 3, 14, 30, 0));
    expect(result.attendeeIds).toEqual([ALICE]);
  });

  // The instants come back parsed specifically so the route doesn't re-parse
  // and can't accidentally re-parse differently.
  it('returns instants the caller can use without re-parsing', () => {
    const result = validateMeetingInput({ ...valid, startsAt: '2026-08-03T19:00:00+05:00' });
    if ('error' in result) throw new Error(`unexpected error: ${result.error}`);

    expect(result.startsAtMs).toBe(Date.UTC(2026, 7, 3, 14, 0, 0));
  });

  it('requires a title', () => {
    expect(validateMeetingInput({ ...valid, title: undefined }))
      .toEqual({ error: 'a meeting needs a title' });
    expect(validateMeetingInput({ ...valid, title: '   ' }))
      .toEqual({ error: 'a meeting needs a title' });
    expect(validateMeetingInput({ ...valid, title: 42 }))
      .toEqual({ error: 'a meeting needs a title' });
  });

  it('trims the title it returns', () => {
    const result = validateMeetingInput({ ...valid, title: '  Standup  ' });
    if ('error' in result) throw new Error(`unexpected error: ${result.error}`);

    expect(result.title).toBe('Standup');
  });

  it('caps the title length', () => {
    expect(validateMeetingInput({ ...valid, title: 'a'.repeat(120) })).not.toHaveProperty('error');
    expect(validateMeetingInput({ ...valid, title: 'a'.repeat(121) }))
      .toEqual({ error: 'title must be 120 characters or fewer' });
  });

  it('requires both instants', () => {
    const message =
      'startsAt and endsAt must be ISO timestamps with a timezone offset (e.g. 2026-08-03T14:00:00Z)';
    expect(validateMeetingInput({ ...valid, startsAt: '2026-08-03T14:00' })).toEqual({ error: message });
    expect(validateMeetingInput({ ...valid, endsAt: undefined })).toEqual({ error: message });
  });

  // No wrap handling here, unlike shifts: a meeting carries its own date, so
  // an end before its start is simply backwards rather than overnight.
  it('rejects a meeting that ends before or when it starts', () => {
    expect(validateMeetingInput({ ...valid, endsAt: '2026-08-03T13:00:00Z' }))
      .toEqual({ error: 'a meeting must end after it starts' });
    expect(validateMeetingInput({ ...valid, endsAt: '2026-08-03T14:00:00Z' }))
      .toEqual({ error: 'a meeting must end after it starts' });
  });

  it('enforces the 15 minute floor', () => {
    expect(validateMeetingInput({ ...valid, endsAt: '2026-08-03T14:14:00Z' }))
      .toEqual({ error: 'a meeting must be at least 15 minutes long' });
    expect(validateMeetingInput({ ...valid, endsAt: '2026-08-03T14:15:00Z' }))
      .not.toHaveProperty('error');
  });

  // The ceiling is mostly there to catch a swapped date in the form: the grid
  // draws one day, so a three-week "meeting" renders as a solid band with no
  // way to see why.
  it('enforces the 12 hour ceiling', () => {
    expect(validateMeetingInput({ ...valid, endsAt: '2026-08-04T02:00:00Z' }))
      .not.toHaveProperty('error');
    expect(validateMeetingInput({ ...valid, endsAt: '2026-08-04T02:01:00Z' }))
      .toEqual({ error: 'a meeting cannot be longer than 12 hours' });
  });

  it('passes through the attendee errors', () => {
    expect(validateMeetingInput({ ...valid, attendeeIds: [] }))
      .toEqual({ error: 'a meeting needs at least one attendee' });
    expect(validateMeetingInput({ ...valid, attendeeIds: ['nope'] }))
      .toEqual({ error: 'attendeeIds must be team member ids' });
  });

  it('collapses duplicate attendees on the way through', () => {
    const result = validateMeetingInput({ ...valid, attendeeIds: [ALICE, BOB, ALICE] });
    if ('error' in result) throw new Error(`unexpected error: ${result.error}`);

    expect(result.attendeeIds).toEqual([ALICE, BOB]);
  });

  // Ordering, so a payload wrong in several ways reports the first problem
  // rather than an arbitrary one.
  it('reports the title problem before the instant problem', () => {
    expect(validateMeetingInput({ ...valid, title: '', startsAt: 'nonsense' }))
      .toEqual({ error: 'a meeting needs a title' });
  });
});
