import mongoose from 'mongoose';
import { RecurringShift } from '../types';

// Standing weekly hours: one record per member per day of week, repeating
// each week (keyed by dayOfWeek rather than a calendar date). Since Phase 2
// this is the only shift model - the old date-based WorkShift was deleted
// once ad-hoc breaks were cut and the standing lunch landed here instead.
const recurringShiftSchema = new mongoose.Schema({
  teamMemberId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember', required: true },
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 }, // 0 = Sunday .. 6 = Saturday
  // Member's own local HH:mm. Optional because an off day stores no hours;
  // the route requires them when isOff is false.
  startTime: { type: String },
  endTime: { type: String },
  // Standing daily break (lunch), member's own local HH:mm. Optional, and
  // both-or-neither - the route enforces that, plus that it sits inside the
  // day's shift. One break per day is deliberate: that covers lunch, and a
  // multi-break model is more general than anything asked for yet.
  //
  // This lives on the shift record rather than its own model because a
  // standing lunch is a SCHEDULE fact - known ahead, repeats weekly,
  // computable from data already fetched. That's what separates it from the
  // ad-hoc breaks that were cut (those were a presence fact, and 'away'
  // already covers them now that polling makes 'away' visible to other people).
  breakStart: { type: String },
  breakEnd: { type: String },
  // true = off that weekday. No record at all = hours never set up.
  isOff: { type: Boolean, default: false }
}, { timestamps: true });

// One record per member per weekday; also lets the save route upsert by
// (teamMemberId, dayOfWeek). Built by syncIndexes() on boot in non-prod.
recurringShiftSchema.index({ teamMemberId: 1, dayOfWeek: 1 }, { unique: true });

export default mongoose.model<RecurringShift>('RecurringShift', recurringShiftSchema);
