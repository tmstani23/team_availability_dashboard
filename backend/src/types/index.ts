// Core type for a team member - defines the shape of data for availability
export interface TeamMember {
  _id?: string;
  name: string;
  email: string;
  timezone: string;
  role: string;
  isAvailable: boolean;
  lastUpdated: Date;
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