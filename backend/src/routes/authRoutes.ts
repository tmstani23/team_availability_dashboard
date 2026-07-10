import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import UserBadgeModel from '../models/UserBadge';
import { AuthPayload, authenticate, AuthRequest } from '../middleware/auth';

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

    // httpOnly blocks JS from ever reading this cookie (even via
    // document.cookie), which is what protects the token from theft via
    // XSS. sameSite: 'lax' blocks it from being sent on most cross-site
    // requests, covering most CSRF risk without needing a separate CSRF
    // token at this project's scale.
    //
    // path: '/' matters here - without it, the browser defaults a cookie's
    // path to the directory of the request that set it (here, '/api/auth'),
    // meaning it would only get sent back on /api/auth/* requests and never
    // reach /api/team-members or /api/work-shifts.
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // set true once deployed behind HTTPS
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24h, matches the JWT's own expiry
    });

    // Token no longer goes in the response body - it lives only in the cookie
    res.json({ role: user.role, teamMemberId: user.teamMemberId });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in' });
  }
});

// POST /api/auth/logout - clears the cookie so the browser stops sending it.
// path must match what was used to set the cookie, or the browser won't
// recognize it as the same cookie to clear.
router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me - lets the frontend check "am I still logged in?" after
// a page refresh, since JS can't read the httpOnly cookie itself to check.
// Reuses authenticate, which already verifies the cookie and populates req.user.
router.get('/me', authenticate, (req: AuthRequest, res) => {
  res.json({ role: req.user!.role, teamMemberId: req.user!.teamMemberId });
});

export default router;