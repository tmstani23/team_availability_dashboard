import express from 'express';
import WorkShiftModel from '../models/WorkShift';

const router = express.Router();

// GET all shifts or by date (for grid display)
router.get('/', async (req, res) => {
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

// POST new shift
router.post('/', async (req, res) => {
  try {
    const newShift = new WorkShiftModel(req.body);
    await newShift.save();
    res.status(201).json(newShift);
  } catch (error) {
    res.status(400).json({ message: 'Error creating shift' });
  }
});

// PUT update shift
router.put('/:id', async (req, res) => {
  try {
    const updated = await WorkShiftModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: 'Error updating shift' });
  }
});

// DELETE shift
router.delete('/:id', async (req, res) => {
  try {
    await WorkShiftModel.findByIdAndDelete(req.params.id);
    res.json({ message: 'Shift deleted' });
  } catch (error) {
    res.status(400).json({ message: 'Error deleting shift' });
  }
});

export default router;