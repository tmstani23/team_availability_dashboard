import express from 'express';
import WorkShiftModel from '../models/WorkShift';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = express.Router();

// GET all shifts or by date (for grid display) - authenticate only (no
// requireAdmin), since every logged-in member needs to see the schedule
// grid, not just admins
router.get('/', authenticate, async (req, res) => {
  try {
    const { date } = req.query;
    // Type guard: ensure date is a string before using it in the query
    const query = typeof date === 'string' ? { date } : {};
    const shifts = await WorkShiftModel.find(query);
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching shifts' });
  }
});

// POST new shift - admin only for now. No self-service caller exists yet;
// when break logging lands, a member creating their own break will need a
// separate route that trusts the JWT's teamMemberId (same pattern as
// PATCH /api/team-members/:id/status), not open access here
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const newShift = new WorkShiftModel(req.body);
    await newShift.save();
    res.status(201).json(newShift);
  } catch (error) {
    res.status(400).json({ message: 'Error creating shift' });
  }
});

// PUT update shift - admin only
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const updated = await WorkShiftModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: 'Error updating shift' });
  }
});

// DELETE shift - admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await WorkShiftModel.findByIdAndDelete(req.params.id);
    res.json({ message: 'Shift deleted' });
  } catch (error) {
    res.status(400).json({ message: 'Error deleting shift' });
  }
});

export default router;