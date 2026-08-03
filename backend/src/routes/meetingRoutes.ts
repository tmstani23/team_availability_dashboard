import express from 'express';
import MeetingModel from '../models/Meeting';
import TeamMemberModel from '../models/TeamMember';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validateMeetingInput, parseInstant } from '../utils/meetingValidation';

const router = express.Router();

// How wide a window the list route will serve in one call. The grid asks for
// one day at a time; this exists so a malformed or hostile range can't ask the
// database to scan the whole collection.
const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

/**
 * GET /api/meetings?from=<iso>&to=<iso>
 *
 * Every meeting OVERLAPPING the window, not merely starting inside it - a
 * meeting that began at 23:30 yesterday and runs into today still belongs on
 * today's grid. That's the classic interval-overlap test: it starts before the
 * window ends AND it ends after the window begins.
 *
 * Both bounds are instants, and the caller decides what they mean. The grid
 * sends the viewer's local midnight-to-midnight converted to UTC, which is the
 * cross-day decision from nextSteps.md (the VIEWER's calendar day defines
 * what's on screen) expressed as a query rather than a filter - so the server
 * never has to know about anyone's timezone.
 *
 * Any authenticated user, matching GET /api/recurring-shifts: this is the same
 * roster-wide schedule data the grid already shows everyone.
 */
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const from = parseInstant(req.query.from);
    const to = parseInstant(req.query.to);

    if (from === null || to === null) {
      return res.status(400).json({
        message: 'from and to must be ISO timestamps with a timezone offset (e.g. 2026-08-03T00:00:00Z)'
      });
    }
    if (to <= from) {
      return res.status(400).json({ message: 'to must be after from' });
    }
    if (to - from > MAX_RANGE_MS) {
      return res.status(400).json({ message: 'range cannot exceed 31 days' });
    }

    const meetings = await MeetingModel
      .find({ startsAt: { $lt: new Date(to) }, endsAt: { $gt: new Date(from) } })
      .sort({ startsAt: 1 });

    res.json(meetings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching meetings' });
  }
});

/**
 * POST /api/meetings - book one.
 *
 * AUTH, and this is the first write in the app that isn't about a single
 * member: any authenticated member may create a meeting, but THE CALLER MUST
 * BE ONE OF THE ATTENDEES. Admins are exempt and can book for anyone.
 *
 * The existing rule everywhere else is "trust req.user.teamMemberId, never a
 * client-supplied id," which assumes one subject per write and so doesn't
 * transfer here directly. Its intent does: you may commit your own time, not
 * someone else's unilaterally. Requiring self-attendance is that intent
 * applied to a write with several subjects - still a JWT-derived check, the
 * difference being that the JWT's id must appear IN the attendee list rather
 * than BE the target.
 */
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const parsed = validateMeetingInput(req.body);
    if ('error' in parsed) {
      return res.status(400).json({ message: parsed.error });
    }

    const { title, startsAtMs, endsAtMs, attendeeIds } = parsed;

    const callerId = req.user?.teamMemberId;
    const isAdmin = req.user?.role === 'admin';

    if (!callerId) {
      // A valid token with no teamMemberId shouldn't exist, but if one did,
      // failing closed beats creating a meeting with no owner.
      return res.status(403).json({ message: 'Your login is not linked to a team member' });
    }
    if (!isAdmin && !attendeeIds.includes(callerId)) {
      return res.status(403).json({ message: 'You can only create meetings you are attending' });
    }

    // Every attendee must actually exist. Without this a typo'd id creates a
    // meeting that renders for nobody and can't be explained by looking at the
    // grid - the failure would be silent and permanent rather than a 400.
    const foundCount = await TeamMemberModel.countDocuments({ _id: { $in: attendeeIds } });
    if (foundCount !== attendeeIds.length) {
      return res.status(400).json({ message: 'One or more attendees no longer exist' });
    }

    const meeting = await new MeetingModel({
      title,
      // Stored as Dates, i.e. UTC instants. The epoch numbers came from
      // validation, so nothing here re-parses a string and risks reading it
      // as a wall clock.
      startsAt: new Date(startsAtMs),
      endsAt: new Date(endsAtMs),
      attendeeIds,
      createdBy: callerId
    }).save();

    res.status(201).json(meeting);
  } catch (error) {
    res.status(400).json({ message: 'Error creating meeting' });
  }
});

/**
 * DELETE /api/meetings/:id - creator or admin.
 *
 * Deliberately NOT "any attendee": deleting removes the meeting for everyone,
 * so an attendee cancelling on their own behalf would silently cancel it for
 * the rest of the room. Leaving a meeting is a different action and it lives
 * past the scope edge for this phase (that road leads to invites and RSVPs).
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const meeting = await MeetingModel.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const isCreator = String(meeting.createdBy) === req.user?.teamMemberId;
    const isAdmin = req.user?.role === 'admin';
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ message: 'Only the organizer or an admin can delete this meeting' });
    }

    await MeetingModel.findByIdAndDelete(req.params.id);
    res.json({ message: 'Meeting deleted' });
  } catch (error) {
    res.status(400).json({ message: 'Error deleting meeting' });
  }
});

export default router;
