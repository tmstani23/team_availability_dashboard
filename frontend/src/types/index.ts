import type { Dayjs } from 'dayjs';

// The presence states. Mirrors the backend type. 'active' is the old
// "available". 'offline', 'break' and 'meeting' are all schedule-derived (see
// resolveDisplayStatus) and never hand-settable; the rest are set by hand.
export type TeamMemberStatus = 'active' | 'away' | 'dnd' | 'offline' | 'break' | 'meeting';

export interface TeamMember {
  _id: string;
  name: string;
  timezone: string;
  role: string;
  status: TeamMemberStatus;  // replaces the old isAvailable boolean
  lastUpdated: string;
  // Heartbeat timestamp from the last authenticated poll. Absent means "never
  // logged in" - must fall through the heartbeat layer, not derive offline.
  lastSeenAt?: string;
}

// Auth credentials + role, kept separate from TeamMember so password/email
// never flow through team-data API responses
export interface UserBadge {
  _id?: string;
  email: string;
  role: 'admin' | 'member';
  teamMemberId: string | TeamMember;
  // no password field here — it should never be sent to or stored in the frontend
}

// 0 = Sunday .. 6 = Saturday (JS getDay() convention).
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// A member's standing hours for one weekday; repeats weekly. isOff true = off
// that day. Mirrors the backend type - keep in sync.
export interface RecurringShift {
  _id?: string;
  teamMemberId: string | TeamMember;
  dayOfWeek: DayOfWeek;
  startTime?: string;                  // HH:mm, member's own local time
  endTime?: string;                    // HH:mm
  // Standing daily break (lunch), member's own local time. Both or neither,
  // and must fall inside startTime/endTime - enforced by PUT /:id/hours.
  // May land on a quarter hour, unlike shift times.
  breakStart?: string;                 // HH:mm
  breakEnd?: string;                   // HH:mm
  isOff: boolean;
}

/**
 * A single booked meeting. Mirrors the backend type - keep in sync.
 *
 * THE TIME NOTE, because this is where it bites on the frontend: `startsAt` /
 * `endsAt` are ISO 8601 UTC INSTANTS (what `Date` serializes to over JSON),
 * NOT the `HH:mm` wall-clock strings every other time field here uses. A
 * standing 9am is a different instant per person; a meeting is one instant
 * that reads as a different wall clock per person.
 *
 * Practically: these go through `resolveMeetingCarveOutInViewerTz`, never
 * through `resolveHourRangeInViewerTz` or `resolveBreakCarveOutInViewerTz`.
 * Those take wall-clock strings and anchor them to TODAY's date, which is
 * right for a record that carries no date and wrong for one that does.
 */
export interface Meeting {
  _id: string;
  title: string;
  startsAt: string;  // ISO 8601 UTC instant
  endsAt: string;    // ISO 8601 UTC instant
  attendeeIds: string[];
  createdBy: string;
}

export interface TeamContextType {
  // Ticking clock from useRefreshTick - components computing schedule/
  // heartbeat state should read time from here, not call dayjs() themselves,
  // so they actually re-render on each poll tick instead of going stale in
  // an open tab.
  //
  // Properly typed as Dayjs. An earlier comment here claimed it had to be
  // `any` because this file is hand-mirrored on the backend and couldn't
  // import a frontend-only date library - but TeamContextType has no backend
  // counterpart (only TeamMember / RecurringShift / DayOfWeek do), so the
  // import costs nothing.
  now: Dayjs;
  members: TeamMember[];
  recurringShifts: RecurringShift[];
  // Meetings overlapping the VIEWER's local calendar day only - not every
  // meeting that exists. The grid draws one day on one clock, so that's the
  // window the provider holds; anything wanting a different range should fetch
  // it rather than expecting this to be complete.
  meetings: Meeting[];
  loading: boolean;
  // Sets a member's presence to an explicit state (not a toggle - four
  // states have no single "opposite"). Only active/away/dnd are settable.
  setStatus: (id: string, status: TeamMemberStatus) => Promise<void>;
  // Both return the outcome instead of throwing: a refusal here is a real,
  // explainable case (you must be an attendee to create; only the organizer or
  // an admin can delete), and the UI needs the server's wording to say so.
  createMeeting: (input: {
    title: string;
    startsAt: string;   // ISO instant
    endsAt: string;     // ISO instant
    attendeeIds: string[];
  }) => Promise<{ success: boolean; message?: string }>;
  deleteMeeting: (id: string) => Promise<{ success: boolean; message?: string }>;
  deleteMember: (id: string) => Promise<void>;
  refreshAllData: () => Promise<void>;
  handleMemberAdded: () => void;
  // The zone every wall-clock conversion in the UI runs through: the grid's
  // rendering AND MeetingPanel's booking form, which must agree or a meeting
  // lands in a different column from the one that was clicked. Sourced from
  // the browser, falling back to the logged-in member's stored zone and then
  // 'UTC' - see the comment on it in TeamContext for why the browser wins.
  //
  // NOTE this is the WRITE zone. Only MeetingPanel's booking form and the
  // meetings fetch window should read it directly; anything that merely
  // DISPLAYS converted hours wants displayTimezone below.
  viewerTimezone: string;
  // The zone the schedule is currently being LOOKED AT in: previewTimezone
  // when a preview is active, otherwise viewerTimezone. Read by ScheduleGrid
  // and TeamHoursPanel and nothing else - see the split comment in
  // TeamContext for why booking deliberately doesn't follow it.
  displayTimezone: string;
  // The zone being previewed, or null when the user is on their own clock.
  // In-memory only: a preview is a transient action, not a saved preference.
  previewTimezone: string | null;
  setPreviewTimezone: (tz: string | null) => void;
  // What the browser actually reported, or null if it couldn't be read. Only
  // reason this is separate: it lets the UI say "this device" honestly. When
  // it equals viewerTimezone the browser won; when it doesn't, a fallback did,
  // and captioning that as the device's zone would be a lie.
  browserTimezone: string | null;
}

export interface AuthContextType {
  role: 'admin' | 'member' | null;
  teamMemberId: string | null;
  isAuthenticated: boolean;
  loading: boolean; // true while checking for an existing session on page load
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
}
