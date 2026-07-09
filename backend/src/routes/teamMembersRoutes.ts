import express from 'express';
import TeamMemberModel from '../models/TeamMember';

const router = express.Router();

// GET all team members
router.get('/', async (req, res) => {
  try {
    const members = await TeamMemberModel.find();
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching members' });
  }
});

// POST new team member
router.post('/', async (req, res) => {
  try {
    const newMember = new TeamMemberModel(req.body);
    const savedMember = await newMember.save();

    if (req.body.startTime && req.body.endTime) {
      const WorkShiftModel = (await import('../models/WorkShift')).default;
      const initialShift = new WorkShiftModel({
        teamMemberId: savedMember._id,
        date: new Date().toISOString().split('T')[0],
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        isBreak: false
      });
      await initialShift.save();
    }

    res.status(201).json(savedMember);
  } catch (error) {
    res.status(400).json({ message: 'Error creating member' });
  }
});

// PUT update a team member by ID
router.put('/:id', async (req, res) => {
  try {
    const updated = await TeamMemberModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    
    // ✨ FIX: Return 404 instead of 200 with null if member doesn't exist
    if (!updated) {
      return res.status(404).json({ message: 'Team member not found' });
    }
    
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: 'Error updating member' });
  }
});

// 🔄 ADDED: PATCH update status endpoint for toggleAvailability
router.patch('/:id/status', async (req, res) => {
  try {
    const { isAvailable } = req.body;

    // ✨ FIX: Minor non-blocking bullet type guard
    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({ message: 'isAvailable must be a boolean' });
    }

    const updated = await TeamMemberModel.findByIdAndUpdate(
      req.params.id,
      { isAvailable, lastUpdated: new Date() },
      { new: true }
    );

    // ✨ FIX: Return 404 instead of 200 with null
    if (!updated) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: 'Error updating status' });
  }
});

// DELETE a team member by ID
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await TeamMemberModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Team member not found' });
    }
    res.json({ message: 'Member deleted' });
  } catch (error) {
    res.status(400).json({ message: 'Error deleting member' });
  }
});

export default router;