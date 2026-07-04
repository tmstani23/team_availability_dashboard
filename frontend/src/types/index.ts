export interface TeamMember {
  _id: string;
  name: string;
  email: string;
  timezone: string;
  role: string;
  isAvailable: boolean;
  lastUpdated: string;
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