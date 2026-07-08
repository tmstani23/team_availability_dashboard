import mongoose, { Schema, Document } from 'mongoose';
import { UserBadge } from '../types';

const userBadgeSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false }, // stored as a bcrypt hash, never plaintext
  role: { type: String, enum: ['admin', 'member'], required: true, default: 'member' },
  teamMemberId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember', required: true }
}, { timestamps: true });

export default mongoose.model<UserBadge>('UserBadge', userBadgeSchema);