import mongoose from 'mongoose';
import { WorkShift } from '../types';

// Schema for individual work shifts to power the schedule grid
const workShiftSchema = new mongoose.Schema({
  teamMemberId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember', required: true },
  date: { type: String, required: true },           // YYYY-MM-DD
  startTime: { type: String, required: true },      // HH:mm
  endTime: { type: String, required: true },
  isBreak: { type: Boolean, default: false },
  notes: { type: String }
});

export default mongoose.model<WorkShift>('WorkShift', workShiftSchema);