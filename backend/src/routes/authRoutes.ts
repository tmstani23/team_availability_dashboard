import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import UserBadgeModel from '../models/UserBadge';
import { AuthPayload } from '../middleware/auth';

const router = express.Router();

const SALT_ROUNDS = 10; // standard cost factor - higher is slower but more brute-force resistant

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    // password has select:false on the schema - must explicitly request it
    // here since bcrypt.compare needs the actual hash to check against
    const user = await UserBadgeModel.findOne({ email }).select('+password');

    // Same error message for "no such email" and "wrong password" on purpose -
    // distinguishing them lets an attacker enumerate valid emails
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const payload: AuthPayload = {
      id: user._id!.toString(),
      teamMemberId: user.teamMemberId.toString(),
      role: user.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '24h' });

    res.json({ token, role: user.role, teamMemberId: user.teamMemberId });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in' });
  }
});

export default router;