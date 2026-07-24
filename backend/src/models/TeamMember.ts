import mongoose from 'mongoose';
import { TeamMember } from '../types';

// This defines the structure (mongoose schema) of TeamMember documents in MongoDB
const teamMemberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  timezone: { type: String, required: true },
  role: { type: String, required: true },
  // Presence state. enum restricts writes to these four values at the DB layer.
  // Default is 'away', NOT 'active': 'active' is a claim that someone is
  // present and available, and only the person themselves can make it
  // truthfully. A member an admin creates at 3am who has never logged in
  // hasn't asserted anything, so 'away' is the honest "no positive signal
  // yet" state. Members opt into active via the picker.
  // (Note this is only the stored value - a member who is off shift displays
  // as 'offline' regardless, derived on the frontend. See resolveDisplayStatus.)
  status: {
    type: String,
    enum: ['active', 'away', 'dnd', 'offline'],
    default: 'away'
  },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model<TeamMember>('TeamMember', teamMemberSchema);