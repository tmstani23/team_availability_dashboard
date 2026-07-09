import mongoose from 'mongoose';
import { TeamMember } from '../types';

// This defines the structure (mongoose schema) of TeamMember documents in MongoDB
const teamMemberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  timezone: { type: String, required: true },
  role: { type: String, required: true },
  isAvailable: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model<TeamMember>('TeamMember', teamMemberSchema);