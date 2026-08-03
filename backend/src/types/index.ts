// The presence states a member can be in. Stored as a plain string in Mongo
// (readable in the DB, no lookup table). 'active' is the old "available".
//
// Three of these are DERIVED and never stored: 'offline' (off shift or no
// heartbeat), 'break' (inside a standing lunch) and 'meeting' (a booked
// meeting is in progress). None appears in SETTABLE_STATUSES, so the API
// rejects them. Note 'break' and 'meeting' are also absent from the TeamMember
// schema's enum, unlike 'offline' - nothing ever writes them, so letting the
// DB accept them would only create a way for the value to get stuck in a
// document where no schedule change could clear it.
export type TeamMemberStatus = 'active' | 'away' | 'dnd' | 'offline' | 'break' | 'meeting';

// Core type for a team member - defines the shape of data for availability
export interface TeamMember {
  _id?: string;
  name: string;
  timezone: string;
  role: string;
  status: TeamMemberStatus;  // replaces the old isAvailable boolean
  lastUpdated: Date;
  // Heartbeat timestamp, stamped on every authenticated GET /api/team-members
  // poll (debounced). Optional/no default: absent means "never logged in",
  // which must NOT be treated the same as "logged in once, long ago" - see
  // the resolveDisplayStatus heartbeat layer in the frontend.
  lastSeenAt?: Date;
}

// Auth credentials + role, kept separate from TeamMember so password/email
// never flow through team-data API responses
export interface UserBadge {
  _id?: string;
  email: string;
  password: string;
  role: 'admin' | 'member';
  teamMemberId: string | TeamMember;
}

// 0 = Sunday .. 6 = Saturday (JS getDay() convention).
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// A member's standing hours for one weekday; repeats weekly. isOff true = off
// that day; times are omitted on off days.
export interface RecurringShift {
  _id?: string;
  teamMemberId: string | TeamMember;
  dayOfWeek: DayOfWeek;
  startTime?: string;     // HH:mm, member's own local time - omitted on off days
  endTime?: string;       // HH:mm
  // Standing daily break (lunch), member's own local time. Both or neither,
  // and must fall inside startTime/endTime - enforced by PUT /:id/hours.
  // Unlike shift times these may land on a quarter hour (see nextSteps.md);
  // the grid draws them as a fractional carve-out inside the hour cell.
  breakStart?: string;    // HH:mm
  breakEnd?: string;      // HH:mm
  isOff: boolean;
}

/**
 * A single booked meeting. READ THE TIME NOTE BEFORE TOUCHING THIS.
 *
 * `startsAt` / `endsAt` are UTC INSTANTS, not wall-clock strings. Every other
 * time field in this project (shift times, break times) is an `HH:mm` string
 * with no date and no offset, because a standing "9am" is a different instant
 * for each person - it means 9am wherever they are. A meeting is the opposite:
 * ONE instant that reads as a different wall-clock time for each attendee.
 *
 * Mixing the two is the classic scheduling bug, and it is quiet - it looks
 * correct for everyone in the author's timezone and is wrong by their offset
 * for everyone else. So: never format one of these to HH:mm and hand it to
 * anything that takes shift times, and never build one out of an HH:mm string
 * without pinning it to a real date in a real zone first.
 *
 * `attendeeIds` is the full attendee list including whoever created it - the
 * create route requires the caller to be in it (admins excepted), so "my
 * meetings" is a query on this array, not on createdBy.
 */
export interface Meeting {
  _id?: string;
  title: string;
  startsAt: Date;   // UTC instant
  endsAt: Date;     // UTC instant
  attendeeIds: (string | TeamMember)[];
  // Who booked it. Kept separately from the attendee list purely so delete
  // can be creator-or-admin; it is NOT a membership signal.
  createdBy: string | TeamMember;
}