// The presence states. Mirrors the backend type. 'active' is the old
// "available". 'offline' and 'break' are both schedule-derived (see
// resolveDisplayStatus) and never hand-settable; the rest are set by hand.
export type TeamMemberStatus = 'active' | 'away' | 'dnd' | 'offline' | 'break';

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

export interface TeamContextType {
  // Ticking clock from useRefreshTick - components computing schedule/
  // heartbeat state should read time from here, not call dayjs() themselves,
  // so they actually re-render on each poll tick instead of going stale in
  // an open tab. Typed as `any` here (not Dayjs) so this shared types file
  // - mirrored by hand on the backend - doesn't have to import a frontend-only
  // date library.
  now: any;
  members: any[];
  recurringShifts: RecurringShift[];
  loading: boolean;
  // Sets a member's presence to an explicit state (not a toggle - four
  // states have no single "opposite"). Only active/away/dnd are settable.
  setStatus: (id: string, status: TeamMemberStatus) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  refreshAllData: () => Promise<void>;
  handleMemberAdded: () => void;
  viewerId: string | null;
  setViewer: (id: string) => void;
  viewerMember: any;
  viewerTimezone: string;
}

export interface AuthContextType {
  role: 'admin' | 'member' | null;
  teamMemberId: string | null;
  isAuthenticated: boolean;
  loading: boolean; // true while checking for an existing session on page load
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
}
