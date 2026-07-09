import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Shape of data embedded in every JWT - kept minimal so the token itself
// never carries anything sensitive beyond what's needed to identify + authorize
export interface AuthPayload {
  id: string;          // UserBadge _id
  teamMemberId: string;
  role: 'admin' | 'member';
}

// Extends Express's Request so downstream handlers get typed access to
// req.user instead of `any`, once this middleware has run
export interface AuthRequest extends Request {
  user?: AuthPayload;
}

// Verifies the JWT sent as "Authorization: Bearer <token>".
// Any route using this middleware requires a valid, non-expired token.
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    req.user = decoded;
    next();
  } catch (error) {
    // Expired and tampered tokens both fail here - client just needs to
    // re-login either way, so we don't need to distinguish the two cases
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Run AFTER authenticate - assumes req.user is already populated.
// Blocks anyone whose role isn't 'admin' from hitting the route.
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};