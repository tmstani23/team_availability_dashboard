// The zones offered anywhere a timezone is CHOSEN: admin create, admin edit,
// and the member's own profile.
//
// One list because there were two, and they had already drifted -
// AddTeamMemberForm offered Paris and Sydney, TeamMemberCard didn't. That
// meant an admin could create a Sydney member and then silently lose that
// value the first time they edited anything else on the card, since a <select>
// whose current value isn't among its options renders as the first option
// instead. Same reasoning as STATUS_META in status.ts: one source, so the
// surfaces can't disagree.
//
// A short curated list rather than the full ~400 from Intl.supportedValuesOf.
// This is a small team tool, a 400-item select is worse than useless, and the
// BACKEND validates against real IANA data anyway - so this list is a
// convenience, not the security boundary. Extending it is just adding a line.
export interface TimezoneOption {
  value: string;
  label: string;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: 'America/New_York', label: 'America/New_York (Eastern)' },
  { value: 'America/Chicago', label: 'America/Chicago (Central)' },
  { value: 'America/Denver', label: 'America/Denver (Mountain)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (Pacific)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney' },
];

// Whether a stored zone appears in the list above. Used to decide whether a
// select needs an extra option appended for the CURRENT value: someone's zone
// can legitimately be a valid IANA name that isn't curated here (set before
// this list existed, or written straight to the API), and dropping it silently
// is the exact drift bug this file exists to prevent.
export function isCuratedTimezone(tz: string | undefined | null): boolean {
  return !!tz && TIMEZONE_OPTIONS.some(option => option.value === tz);
}
