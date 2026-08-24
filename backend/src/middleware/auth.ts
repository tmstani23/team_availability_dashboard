import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import UserBadgeModel from '../models/UserBadge';

export interface AuthPayload {
  id: string;          // UserBadge _id
  teamMemberId: string;
  role: 'admin' | 'member';
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

// Verifies the JWT in the httpOnly "token" cookie set by /login, then confirms
// the badge it names still exists and reads the CURRENT role off it.
//
// WHY THE SIGNATURE ISN'T ENOUGH. A valid signature proves the token was
// minted by this server and hasn't been edited since. It proves nothing about
// now: the payload is a snapshot of who you were at login, and it keeps
// looking true for the full 24h no matter what happens in the database
// afterwards. Three things followed from that, all found 8/24:
//
//   - DELETED USERS KEPT WORKING. DELETE /api/team-members/:id removes the
//     badge along with the member, but nothing read the badge, so the token
//     went on authenticating someone who no longer existed.
//   - DEMOTED ADMINS KEPT ADMIN. PATCH /:id/role writes badge.role, while
//     requireAdmin read req.user.role - which came from the token. A demotion
//     didn't take effect until the token expired.
//   - TOKENS CROSSED DATABASES. Sessions were bound to JWT_SECRET, not to any
//     data, so pointing MONGODB_URI somewhere else left everyone logged in
//     against a database that had never heard of them. That is how a login on
//     an empty seed database produced an admin view it had never issued.
//
// So the token is now an identity CLAIM and the badge is the answer. Only
// decoded.id survives the lookup; role and teamMemberId are read fresh, which
// is what makes a demotion land on the next request rather than the next day.
//
// WHAT IT COSTS. This runs on every authenticated request. The frontend polls
// every 15s (POLL_INTERVAL_MS) and each poll is three requests, so one client
// is about 12 requests a minute - each of which already queries Mongo for the
// data it returns. This adds one more lookup, by indexed _id, to requests that
// were never free. Not a number worth optimising here. The cheaper option -
// checking only inside requireAdmin - catches demotion but leaves deleted
// members authenticating on every non-admin route, which is the worse half to
// miss.
//
// WHAT IT COSTS ELSEWHERE. Auth used to be pure CPU and now needs the database
// reachable, so a Mongo outage becomes a login outage rather than just a data
// outage. That is the trade for revocation working at all.
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  let decoded: AuthPayload;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  try {
    // select() keeps this to the two fields that get used. The password hash
    // is select:false on the schema anyway, but there's no reason to pull the
    // rest either. lean() skips hydrating a full Mongoose document for a read.
    const badge = await UserBadgeModel
      .findById(decoded.id)
      .select('role teamMemberId')
      .lean();

    // A correctly signed token naming a badge that isn't here: deleted, or
    // minted against a different database. Worded differently from the verify
    // failure above only so the two are tellable apart in devtools - both are
    // 401 and the frontend treats them identically.
    if (!badge) {
      return res.status(401).json({ message: 'Session no longer valid' });
    }

    req.user = {
      id: decoded.id,
      teamMemberId: badge.teamMemberId.toString(),
      role: badge.role
    };

    next();
  } catch (error) {
    // A database failure is not an authentication failure. Answering 401 here
    // would log every user out over a blip, and they'd have no way to tell
    // that from a real expiry.
    return res.status(500).json({ message: 'Error verifying session' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Reads the role authenticate just took off the badge, not the token's copy.
  // That distinction is the whole point of the lookup above.
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};
