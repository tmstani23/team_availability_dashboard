// The four presence states. Mirrors the backend type. 'active' is the old
// "available"; 'offline' is schedule-derived (see nextSteps.md), the rest
// are set by hand.
export type TeamMemberStatus = 'active' | 'away' | 'dnd' | 'offline';

export interface TeamMember {
  _id: string;
  name: string;
  timezone: string;
  role: string;
  status: TeamMemberStatus;  // replaces the old isAvailable boolean
  lastUpdated: string;
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

// One-off, dated events (breaks). Standing weekly hours live in
// RecurringShift. Mirrors the backend type - keep in sync.
export interface WorkShift {
  _id?: string;
  teamMemberId: string | TeamMember;   // Can be populated or just the ID
  date: string;                        // YYYY-MM-DD
  startTime: string;                   // HH:mm
  endTime: string;                     // HH:mm
  isBreak?: boolean;
  notes?: string;
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
  isOff: boolean;
}

export interface TeamContextType {
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
