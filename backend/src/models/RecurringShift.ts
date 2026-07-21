import mongoose from 'mongoose';
import { RecurringShift } from '../types';

// Standing weekly hours: one record per member per day of week. Repeats each
// week (keyed by dayOfWeek), unlike WorkShift which is a one-off dated break.
const recurringShiftSchema = new mongoose.Schema({
  teamMemberId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember', required: true },
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 }, // 0 = Sunday .. 6 = Saturday
  // Member's own local HH:mm. Optional because an off day stores no hours;
  // the route requires them when isOff is false.
  startTime: { type: String },
  endTime: { type: String },
  // true = off that weekday. No record at all = hours never set up.
  isOff: { type: Boolean, default: false }
}, { timestamps: true });

// One record per member per weekday; also lets the save route upsert by
// (teamMemberId, dayOfWeek). Built by syncIndexes() on boot in non-prod.
recurringShiftSchema.index({ teamMemberId: 1, dayOfWeek: 1 }, { unique: true });

export default mongoose.model<RecurringShift>('RecurringShift', recurringShiftSchema);
