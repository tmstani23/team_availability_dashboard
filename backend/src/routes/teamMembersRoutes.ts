import express from 'express';
import TeamMemberModel from '../models/TeamMember';

const router = express.Router();

// GET all team members - reads from database
router.get('/', async (req, res) => {
  try {
    const members = await TeamMemberModel.find();
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching members' });
  }
});

// POST new team member - creates record
router.post('/', async (req, res) => {
  try {
    const newMember = new TeamMemberModel(req.body);
    const savedMember = await newMember.save();

    // Create initial shift if times provided
    if (req.body.startTime && req.body.endTime) {
      const WorkShiftModel = (await import('../models/WorkShift')).default;
      const initialShift = new WorkShiftModel({
        teamMemberId: savedMember._id,
        date: new Date().toISOString().split('T')[0], // today
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
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: 'Error updating member' });
  }
});

// DELETE a team member by ID
router.delete('/:id', async (req, res) => {
  try {
    await TeamMemberModel.findByIdAndDelete(req.params.id);
    res.json({ message: 'Member deleted' });
  } catch (error) {
    res.status(400).json({ message: 'Error deleting member' });
  }
});

export default router;