// The four presence states a member can be in. Stored as a plain string in
// Mongo (readable in the DB, no lookup table). 'active' is the old "available".
export type TeamMemberStatus = 'active' | 'away' | 'dnd' | 'offline';

// Core type for a team member - defines the shape of data for availability
export interface TeamMember {
  _id?: string;
  name: string;
  timezone: string;
  role: string;
  status: TeamMemberStatus;  // replaces the old isAvailable boolean
  lastUpdated: Date;
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

// Represents a work shift for the schedule matrix
export interface WorkShift {
  _id?: string;
  teamMemberId: string | TeamMember;
  date: string;           // YYYY-MM-DD
  startTime: string;      // HH:mm (local to member)
  endTime: string;        // HH:mm
  isBreak: boolean;       // e.g. lunch or meeting
  notes?: string;
}