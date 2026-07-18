import mongoose from 'mongoose';
import { TeamMember } from '../types';

// This defines the structure (mongoose schema) of TeamMember documents in MongoDB
const teamMemberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  timezone: { type: String, required: true },
  role: { type: String, required: true },
  // Presence state. enum restricts writes to these four values at the DB
  // layer; default 'active' means a newly created member shows as available.
  status: {
    type: String,
    enum: ['active', 'away', 'dnd', 'offline'],
    default: 'active'
  },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model<TeamMember>('TeamMember', teamMemberSchema);