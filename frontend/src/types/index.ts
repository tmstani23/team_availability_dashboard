export interface TeamMember {
  _id: string;
  name: string;
  timezone: string;
  role: string;
  isAvailable: boolean;
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

export interface WorkShift {
  _id?: string;
  teamMemberId: string | TeamMember;   // Can be populated or just the ID
  date: string;                        // YYYY-MM-DD
  startTime: string;                   // HH:mm
  endTime: string;                     // HH:mm
  isBreak?: boolean;
  notes?: string;
}

export interface TeamContextType {
  members: any[];
  shifts: any[];
  loading: boolean;
  toggleAvailability: (id: string, currentStatus: boolean) => Promise<void>;
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
