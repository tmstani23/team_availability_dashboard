import express from 'express';
import RecurringShiftModel from '../models/RecurringShift';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// GET all recurring shifts (any logged-in user) - the grid needs every
// member's weekly hours, not just the caller's. One member's week comes from
// GET /api/team-members/:id/hours instead.
router.get('/', authenticate, async (req, res) => {
  try {
    const shifts = await RecurringShiftModel.find();
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching recurring shifts' });
  }
});

export default router;
