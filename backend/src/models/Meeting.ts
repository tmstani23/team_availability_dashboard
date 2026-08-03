import mongoose from 'mongoose';
import { Meeting } from '../types';

// A single booked meeting: create / view / delete, one occurrence. No invites,
// RSVPs, notifications, conflict warnings, recurrence, or calendar sync - that
// scope edge is deliberate and recorded in nextSteps.md.
//
// TIME MODEL, and it is the opposite of everything else in this project:
// startsAt/endsAt are Dates, i.e. UTC INSTANTS. RecurringShift stores HH:mm
// strings with no date because a standing "9am" means 9am wherever you are - a
// different instant per person. A meeting is one instant that reads as a
// different wall clock per person, so it cannot be stored that way. Mongoose
// stores Date as a BSON UTC timestamp, which is exactly what's wanted here.
const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  // Everyone in the meeting, including whoever booked it. The create route
  // requires the caller to appear here (admins excepted), so this array - not
  // createdBy - is what "am I in this meeting" asks.
  attendeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember', required: true }],
  // Only used to decide who may delete it. Not a membership signal.
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember', required: true }
}, { timestamps: true });

// The grid asks one question over and over: "which meetings overlap this
// window." That's a range scan on startsAt, so it gets the index. Built by
// syncIndexes() on boot in non-prod, same as RecurringShift's.
//
// Deliberately NOT a compound index with attendeeIds: the list query is scoped
// by time first and filtered by attendee second, and at this scale a day's
// worth of meetings is a handful of documents either way.
meetingSchema.index({ startsAt: 1 });

export default mongoose.model<Meeting>('Meeting', meetingSchema);
