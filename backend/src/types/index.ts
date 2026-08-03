// The presence states a member can be in. Stored as a plain string in Mongo
// (readable in the DB, no lookup table). 'active' is the old "available".
//
// Two of these are DERIVED and never stored: 'offline' (off shift or no
// heartbeat) and 'break' (inside a standing lunch). Neither appears in
// SETTABLE_STATUSES, so the API rejects them. Note 'break' is also absent from
// the TeamMember schema's enum, unlike 'offline' - nothing ever writes it, so
// letting the DB accept it would only create a way for the value to get stuck
// in a document where no schedule change could clear it.
export type TeamMemberStatus = 'active' | 'away' | 'dnd' | 'offline' | 'break';

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