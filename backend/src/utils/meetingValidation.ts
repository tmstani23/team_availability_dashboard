// Validation rules for a meeting payload.
//
// Same shape as shiftValidation.ts - pure functions, no Mongoose, returning an
// error message or null - but the rules could hardly be more different, and
// that difference is the point. Shift validation reasons about wall-clock
// strings with no date ("is this on the hour"). A meeting is a UTC instant, so
// there is no "on the hour" to check and no wrap-past-midnight case: an
// instant is just a number, and "before" means before.
//
// If you find yourself importing parseHHmm here, stop - that would be the
// wall-clock/instant mixing the whole phase is built to avoid.

import mongoose from 'mongoose';

// A meeting payload as it arrives on POST /api/meetings.
export interface MeetingInput {
  title?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  attendeeIds?: unknown;
}

const MINUTE_MS = 60 * 1000;

// Shortest bookable meeting. 15 minutes matches the break granularity from
// Phase 2, which is also the finest slice the grid can draw legibly inside an
// hour cell.
const MIN_DURATION_MS = 15 * MINUTE_MS;

// Longest bookable meeting. 12 hours is generous for anything that deserves to
// be called a meeting, and the ceiling exists mainly to catch a swapped
// date/time in the form producing something absurd - the grid draws one day,
// so a 3-week "meeting" would render as a solid band with no way to see why.
const MAX_DURATION_MS = 12 * 60 * MINUTE_MS;

const MAX_TITLE_LENGTH = 120;

/**
 * Parses an ISO 8601 instant into epoch milliseconds, or null if it isn't one.
 *
 * Rejecting rather than coercing matters for the same reason it does in
 * shiftValidation: `new Date('tomorrow')` is an Invalid Date, and every
 * comparison against its NaN timestamp is silently false, so a garbage value
 * would sail through the range checks below looking fine.
 *
 * Note this accepts any offset ("...+05:00" as readily as "...Z") and
 * normalizes to the same instant, which is correct - an instant is an instant
 * regardless of which zone the client wrote it in. What it will NOT accept is
 * a bare "2026-08-03 14:00" with no offset, since that names a wall clock and
 * not an instant, and guessing a zone for it is exactly the bug we're avoiding.
 */
export function parseInstant(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  // Must carry a date, a time, AND an offset (Z or ±hh:mm) to name an instant.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return null;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Normalizes the attendee list: must be a non-empty array of valid ObjectId
 * strings. Duplicates are collapsed rather than rejected - a form that lets you
 * tick a name twice is a UI bug, not something the caller needs a 400 about,
 * and a duplicate would otherwise make a member's row draw the same meeting
 * twice.
 *
 * Returns the cleaned list, or an error message.
 */
export function normalizeAttendeeIds(value: unknown): { ids: string[] } | { error: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: 'a meeting needs at least one attendee' };
  }

  const ids: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string' || !mongoose.isValidObjectId(raw)) {
      return { error: 'attendeeIds must be team member ids' };
    }
    if (!ids.includes(raw)) ids.push(raw);
  }

  return { ids };
}

/**
 * The whole payload. Returns the parsed instants alongside the cleaned
 * attendee list so the route doesn't re-parse (and can't accidentally re-parse
 * differently).
 */
export function validateMeetingInput(
  input: MeetingInput
): { error: string } | { title: string; startsAtMs: number; endsAtMs: number; attendeeIds: string[] } {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) return { error: 'a meeting needs a title' };
  if (title.length > MAX_TITLE_LENGTH) {
    return { error: `title must be ${MAX_TITLE_LENGTH} characters or fewer` };
  }

  const startsAtMs = parseInstant(input.startsAt);
  const endsAtMs = parseInstant(input.endsAt);
  if (startsAtMs === null || endsAtMs === null) {
    return { error: 'startsAt and endsAt must be ISO timestamps with a timezone offset (e.g. 2026-08-03T14:00:00Z)' };
  }

  // No wrap handling here, unlike shifts. An overnight SHIFT wraps because it
  // has no date to distinguish "5am tomorrow" from "5am today"; a meeting
  // carries its date, so an end before its start is simply backwards.
  const duration = endsAtMs - startsAtMs;
  if (duration <= 0) return { error: 'a meeting must end after it starts' };
  if (duration < MIN_DURATION_MS) return { error: 'a meeting must be at least 15 minutes long' };
  if (duration > MAX_DURATION_MS) return { error: 'a meeting cannot be longer than 12 hours' };

  const attendees = normalizeAttendeeIds(input.attendeeIds);
  if ('error' in attendees) return { error: attendees.error };

  return { title, startsAtMs, endsAtMs, attendeeIds: attendees.ids };
}
