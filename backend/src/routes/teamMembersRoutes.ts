import express from 'express';
import TeamMemberModel from '../models/TeamMember';
import UserBadgeModel from '../models/UserBadge';
import RecurringShiftModel from '../models/RecurringShift';
import bcrypt from 'bcrypt';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { validateDayEntry } from '../utils/shiftValidation';
import { TeamMemberStatus } from '../types';

const router = express.Router();

const SALT_ROUNDS = 10; // standard cost factor - higher is slower but more brute-force resistant

// The values the /status route will accept. 'offline' is intentionally NOT
// settable by hand - it's derived from a member's schedule (see nextSteps.md),
// so allowing it here would let a client set a state the UI is meant to compute.
const SETTABLE_STATUSES: TeamMemberStatus[] = ['active', 'away', 'dnd'];

// Only re-stamp the heartbeat if the existing one is at least this stale.
// Clients poll every ~15s (see useRefreshTick.ts); without this debounce
// every single poll would also be a write. 10s is comfortably under the
// poll interval, so the stamp still stays fresh between polls.
const HEARTBEAT_DEBOUNCE_MS = 10 * 1000;

// GET all team members - any logged-in user can view the roster/schedule,
// not just admins, since this powers the ScheduleGrid everyone needs to see.
// This is also the endpoint clients poll for presence, so it doubles as the
// heartbeat: it stamps lastSeenAt for whoever is asking.
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const members = await TeamMemberModel.find();
    res.json(members);

    // Stamp the caller's heartbeat. Keyed off the JWT's teamMemberId, never
    // a client-supplied id. Fire-and-forget: this runs after the response is
    // already sent, and a failure here must not fail the read - presence
    // staleness is self-healing on the next poll anyway.
    const callerId = req.user?.teamMemberId;
    if (callerId) {
      const self = members.find((m) => m._id.toString() === callerId);
      const isStale =
        !self?.lastSeenAt ||
        Date.now() - new Date(self.lastSeenAt).getTime() > HEARTBEAT_DEBOUNCE_MS;

      if (isStale) {
        TeamMemberModel
          .updateOne({ _id: callerId }, { lastSeenAt: new Date() })
          .catch(() => {
            // Swallow - a missed heartbeat write just means this member
            // looks stale for one more poll cycle, not a broken request.
          });
      }
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching members' });
  }
});

// POST new team member - admin only. Creates the TeamMember (schedule profile)
// AND a linked UserBadge (login credentials) together, since a member with no
// way to log in isn't useful. This replaces the old separate /auth/register flow.
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, email, password, timezone, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required to create a login for this member' });
  }

  // Step 1: create the schedule profile. If this fails (e.g. missing
  // name/timezone/role), there's nothing to roll back yet - just bail out.
  const newMember = new TeamMemberModel({ name, timezone, role });
  let savedMember;
  try {
    savedMember = await newMember.save();
  } catch (error) {
    return res.status(400).json({ message: 'Error creating member' });
  }

  // Step 2: create the login. Kept in a separate try/catch from step 1 so
  // we can tell "member creation failed" apart from "login creation failed"
  // and so savedMember has a clear, non-implicit type once we reach here.
  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    await new UserBadgeModel({
      email,
      password: hashedPassword,
      role: 'member', // hardcoded - admin promotion happens as a separate action, not at creation time
      teamMemberId: savedMember._id
    }).save();

    // No initial shift is created here. Members start unset (no RecurringShift
    // records) and set their own week after login via PUT /:id/hours.
    res.status(201).json(savedMember);
  } catch (error: any) {
    // Login creation failed after the profile was already saved - roll back
    // the TeamMember so we don't leave an orphaned profile with no way to
    // ever log in as that person
    await TeamMemberModel.findByIdAndDelete(savedMember._id);

    if (error.code === 11000) {
      // MongoDB's duplicate-key error, triggered by the unique email index on UserBadge
      return res.status(409).json({ message: 'Email already registered' });
    }
    res.status(400).json({ message: 'Error creating member login' });
  }
});

// PUT update a team member's profile - admin only. Full edit access
// (name, timezone, job role). NOT for status changes - see PATCH below.
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const updated = await TeamMemberModel.findByIdAndUpdate(req.params.id, req.body, { new: true });

    if (!updated) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: 'Error updating member' });
  }
});

// GET a team member's login info - admin only. Returns only email + role,
// never password (excluded by UserBadge's select:false, and not requested
// here anyway). Kept as its own on-demand route rather than joined into the
// main GET / response, so the roster/schedule endpoint everyone hits stays
// as narrow as it's always been - this is a separate, deliberate lookup.
router.get('/:id/badge', authenticate, requireAdmin, async (req, res) => {
  try {
    const badge = await UserBadgeModel.findOne({ teamMemberId: req.params.id });

    if (!badge) {
      return res.status(404).json({ message: 'No login found for this member' });
    }

    res.json({ email: badge.email, role: badge.role });
  } catch (error) {
    res.status(400).json({ message: 'Error fetching login info' });
  }
});


// PATCH update a team member's own status - any authenticated user, but only
// for themselves (or an admin, on anyone's behalf). This is deliberately the
// ONLY field this route can touch, so it can't be used as a backdoor around
// the full-edit permissions PUT is meant to gate.
router.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
  try {
    // Trust the JWT's teamMemberId, never a client-supplied id - otherwise
    // any logged-in member could target someone else's :id and flip their status
    const isOwnProfile = req.user?.teamMemberId === req.params.id;
    const isAdmin = req.user?.role === 'admin';

    if (!isOwnProfile && !isAdmin) {
      return res.status(403).json({ message: 'You can only update your own status' });
    }

    const { status } = req.body;

    // Reject anything that isn't one of the hand-settable states. This guards
    // the DB even though the model's enum would also catch it - a clear 400
    // here beats a generic validation error surfacing from the save.
    if (!SETTABLE_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${SETTABLE_STATUSES.join(', ')}`
      });
    }

    const updated = await TeamMemberModel.findByIdAndUpdate(
      req.params.id,
      { status, lastUpdated: new Date() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: 'Error updating status' });
  }
});

// PATCH update a team member's own timezone - self-or-admin, same shape as
// the status route above and for the same reason: a narrow single-field route
// can't be used as a backdoor around the admin-only full-profile PUT.
//
// WHY THIS EXISTS AT ALL: timezone used to be admin-only, not by decision but
// by accident - it arrived as part of the member profile (name/role/timezone)
// on TeamMemberCard. It's the field with the worst failure mode of the three,
// since a stale zone misreports someone to the entire team until an admin
// notices. Schedule identity is self-owned; admin stays an override for
// onboarding someone who has never logged in.
router.patch('/:id/timezone', authenticate, async (req: AuthRequest, res) => {
  try {
    // Trust the JWT's teamMemberId, never a client-supplied id - otherwise any
    // logged-in member could target someone else's :id and retime them for the
    // whole team.
    const isOwnProfile = req.user?.teamMemberId === req.params.id;
    const isAdmin = req.user?.role === 'admin';

    if (!isOwnProfile && !isAdmin) {
      return res.status(403).json({ message: 'You can only update your own timezone' });
    }

    const { timezone } = req.body;

    if (typeof timezone !== 'string' || !timezone.trim()) {
      return res.status(400).json({ message: 'timezone is required' });
    }

    // Validate against REAL IANA data rather than the frontend's curated list.
    // Intl.DateTimeFormat throws a RangeError on an unknown zone, and it's the
    // same database dayjs.tz resolves against - so anything that passes here is
    // guaranteed convertible later. Checking the curated list instead would
    // reject zones that are perfectly valid and break the moment someone adds
    // an option to the UI, which is backwards: the list is a convenience, this
    // is the boundary.
    //
    // The stakes are higher than a normal bad-input case. An unresolvable zone
    // stored here doesn't fail loudly - it poisons every shift conversion for
    // this member on every viewer's grid.
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      return res.status(400).json({ message: `Unknown timezone: ${timezone}` });
    }

    const updated = await TeamMemberModel.findByIdAndUpdate(
      req.params.id,
      { timezone, lastUpdated: new Date() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: 'Error updating timezone' });
  }
});

// GET one member's weekly hours (any logged-in user), sorted by weekday.
router.get('/:id/hours', authenticate, async (req, res) => {
  try {
    const hours = await RecurringShiftModel
      .find({ teamMemberId: req.params.id })
      .sort({ dayOfWeek: 1 });
    res.json(hours);
  } catch (error) {
    res.status(400).json({ message: 'Error fetching hours' });
  }
});

// PUT replace a member's whole week in one call. Self-or-admin: a member can
// only write their own hours (JWT teamMemberId must match :id); admin can
// write anyone's.
router.put('/:id/hours', authenticate, async (req: AuthRequest, res) => {
  try {
    // Match the JWT's teamMemberId, not the URL id, so a member can't edit
    // someone else's hours.
    const isOwnProfile = req.user?.teamMemberId === req.params.id;
    const isAdmin = req.user?.role === 'admin';
    if (!isOwnProfile && !isAdmin) {
      return res.status(403).json({ message: 'You can only update your own hours' });
    }

    // array of { dayOfWeek, isOff, startTime?, endTime?, breakStart?, breakEnd? }
    const { week } = req.body;

    if (!Array.isArray(week)) {
      return res.status(400).json({ message: 'week must be an array of day entries' });
    }

    // Validate the whole payload before writing, so a bad entry can't
    // half-update the week. The rules themselves live in shiftValidation.ts -
    // same module the shape checks and break checks come from, so the API and
    // HoursEditor can't drift apart on what a legal day looks like.
    for (const day of week) {
      const problem = validateDayEntry(day);
      if (problem) {
        return res.status(400).json({ message: `dayOfWeek ${day?.dayOfWeek}: ${problem}` });
      }
    }

    // Upsert each day by (teamMemberId, dayOfWeek). Off days clear any
    // leftover times, and every write $unsets the break pair unless this
    // payload sets one - otherwise removing a lunch in the editor would leave
    // the old window sitting in the document forever, since $set only ever
    // adds. Same reasoning as the existing time $unset on off days.
    for (const day of week) {
      if (day.isOff) {
        await RecurringShiftModel.updateOne(
          { teamMemberId: req.params.id, dayOfWeek: day.dayOfWeek },
          {
            $set: { isOff: true },
            $unset: { startTime: '', endTime: '', breakStart: '', breakEnd: '' }
          },
          { upsert: true }
        );
      } else {
        const hasBreak = Boolean(day.breakStart && day.breakEnd);
        await RecurringShiftModel.updateOne(
          { teamMemberId: req.params.id, dayOfWeek: day.dayOfWeek },
          {
            $set: {
              isOff: false,
              startTime: day.startTime,
              endTime: day.endTime,
              ...(hasBreak ? { breakStart: day.breakStart, breakEnd: day.breakEnd } : {})
            },
            ...(hasBreak ? {} : { $unset: { breakStart: '', breakEnd: '' } })
          },
          { upsert: true }
        );
      }
    }

    // Return the fresh, sorted week so the client can sync its state.
    const updated = await RecurringShiftModel
      .find({ teamMemberId: req.params.id })
      .sort({ dayOfWeek: 1 });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: 'Error updating hours' });
  }
});

// DELETE a team member by ID - admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const deleted = await TeamMemberModel.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    // Also remove their login so there's no orphaned UserBadge with no profile
    await UserBadgeModel.findOneAndDelete({ teamMemberId: req.params.id });

    res.json({ message: 'Member deleted' });
  } catch (error) {
    res.status(400).json({ message: 'Error deleting member' });
  }
});

router.patch('/:id/role', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { role } = req.body;

    if (role !== 'admin' && role !== 'member') {
      return res.status(400).json({ message: 'role must be admin or member' });
    }

    const target = await UserBadgeModel.findOne({ teamMemberId: req.params.id });
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Block demoting the last admin standing - not "yourself" specifically,
    // since that's the actual failure mode worth preventing (zero admins left)
    if (target.role === 'admin' && role === 'member') {
      const adminCount = await UserBadgeModel.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Cannot demote the last remaining admin' });
      }
    }

    target.role = role;
    await target.save();

    res.json({ teamMemberId: target.teamMemberId, role: target.role });
  } catch (error) {
    res.status(400).json({ message: 'Error updating role' });
  }
});

// PATCH reset a team member's password - admin only. This is an admin
// override (no current-password check), not a self-service "change my
// password" flow - matches the same trust model as role promotion above.
router.patch('/:id/password', authenticate, requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const target = await UserBadgeModel.findOne({ teamMemberId: req.params.id });
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    target.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await target.save();

    // Never echo the password (hashed or not) back in the response
    res.json({ message: 'Password updated' });
  } catch (error) {
    res.status(400).json({ message: 'Error updating password' });
  }
});
export default router;