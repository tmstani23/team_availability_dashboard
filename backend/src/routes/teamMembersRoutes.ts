import express from 'express';
import TeamMemberModel from '../models/TeamMember';
import UserBadgeModel from '../models/UserBadge';
import bcrypt from 'bcrypt';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { TeamMemberStatus } from '../types';

const router = express.Router();

const SALT_ROUNDS = 10; // standard cost factor - higher is slower but more brute-force resistant

// The values the /status route will accept. 'offline' is intentionally NOT
// settable by hand - it's derived from a member's schedule (see nextSteps.md),
// so allowing it here would let a client set a state the UI is meant to compute.
const SETTABLE_STATUSES: TeamMemberStatus[] = ['active', 'away', 'dnd'];

// GET all team members - any logged-in user can view the roster/schedule,
// not just admins, since this powers the ScheduleGrid everyone needs to see
router.get('/', authenticate, async (req, res) => {
  try {
    const members = await TeamMemberModel.find();
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching members' });
  }
});

// POST new team member - admin only. Creates the TeamMember (schedule profile)
// AND a linked UserBadge (login credentials) together, since a member with no
// way to log in isn't useful. This replaces the old separate /auth/register flow.
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, email, password, timezone, role, startTime, endTime } = req.body;

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

    // Create initial shift if times provided - unchanged from the original behavior
    if (startTime && endTime) {
      const WorkShiftModel = (await import('../models/WorkShift')).default;
      await new WorkShiftModel({
        teamMemberId: savedMember._id,
        date: new Date().toISOString().split('T')[0],
        startTime,
        endTime,
        isBreak: false
      }).save();
    }

    res.status(201).json(savedMember);
  } catch (error: any) {
    // Login (or shift) creation failed after the profile was already saved -
    // roll back the TeamMember so we don't leave an orphaned profile with no
    // way to ever log in as that person
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