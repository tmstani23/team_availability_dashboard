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