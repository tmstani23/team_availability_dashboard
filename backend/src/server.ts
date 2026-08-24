import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import recurringShiftRoutes from './routes/recurringShiftRoutes';
import authRoutes from './routes/authRoutes';
import teamMembersRoutes from './routes/teamMembersRoutes';
import meetingRoutes from './routes/meetingRoutes';

dotenv.config();

const app = express();

// Render terminates HTTPS at its edge and forwards plain HTTP to this process,
// so without this req.protocol reads 'http' and req.ip is the proxy's address.
// Trusting exactly one hop of X-Forwarded-* fixes both. Production only:
// believing those headers when there's no proxy in front of you lets any
// client claim any IP, and nothing proxies the dev server.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

mongoose.connect(process.env.MONGODB_URI!)
  .then(async () => {
    console.log('Connected to MongoDB');

    // dev safety net diffs each model's current schema against the DB and fixes any mismatch
    // automatically on every server start, instead of needing a manual
    // trip to Compass. Skipped in production - it can briefly lock a
    // collection while building/dropping indexes, which is fine for a
    // small dev dataset but risky to run unattended against live data.
    if (process.env.NODE_ENV !== 'production') {
      await mongoose.syncIndexes();
      console.log('Indexes synced');
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

app.use(express.json());

// credentials: true lets the browser send/receive the httpOnly auth cookie
// across origins (frontend on :5173, backend on :5000 counts as cross-origin
// even on localhost). The wildcard '*' origin used before this doesn't work
// once credentials are involved - CORS requires an explicit origin instead.
//
// In production this is effectively dead weight: Express serves the frontend
// itself (see the bottom of this file), so every request is same-origin and
// never gets preflighted. Left in place because dev still needs it, and
// because a stray CORS header on a same-origin response is harmless.
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  credentials: true
}));

// Parses the "token" cookie on incoming requests into req.cookies, so
// authenticate middleware can read it
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/team-members', teamMembersRoutes);
app.use('/api/recurring-shifts', recurringShiftRoutes);
app.use('/api/meetings', meetingRoutes);

// Dev-only "is the server up?" check. In production this path belongs to the
// frontend's index.html, served below - leaving this registered would shadow
// the app's own home page with a line of plain text.
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (req, res) => {
    res.send('Team Availability Backend is running');
  });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is connected' });
});

// --- Serving the built frontend --------------------------------------------
//
// ONE service, not two. Express serves the frontend's production build from
// the same origin it serves /api from, and that is load-bearing rather than
// convenient: same origin is what keeps the auth cookie's sameSite: 'lax'
// working. Split the domains and the cookie has to become sameSite: 'none' +
// secure, which is the third-party-cookie pattern browsers keep clamping down
// on and which already behaves differently in Safari.
//
// Production only. In dev the frontend runs on Vite's own server at :5173 with
// hot reload, and there is usually no dist/ to serve at all.
if (process.env.NODE_ENV === 'production') {
  // The same relative hop works in both worlds: __dirname is backend/src under
  // ts-node-dev and backend/dist after a build, and both sit two levels below
  // the repo root.
  const clientDist = path.resolve(__dirname, '../../frontend/dist');

  if (!fs.existsSync(clientDist)) {
    // Loud on purpose. Without this the server boots cleanly and then 404s
    // every page, which reads like a routing bug rather than a missing build.
    console.error(
      `No frontend build found at ${clientDist} - run "npm run build" in frontend/ before starting in production`
    );
  } else {
    app.use(express.static(clientDist));

    // Client-side routes like /profile and /admin/schedule exist only in the
    // browser. The server has never heard of them, so a hard refresh or a
    // pasted link would 404. Hand any unmatched GET the app shell and let
    // React Router work out what to draw.
    //
    // Written as app.use rather than the familiar app.get('*'): Express 5
    // upgraded path-to-regexp, and a bare '*' is no longer a valid path
    // pattern - it throws on startup asking for a parameter name. A terminal
    // middleware sidesteps the pattern syntax entirely.
    app.use((req, res, next) => {
      // Anything under /api that reached here is a genuine miss. Let it 404
      // properly instead of handing a fetch() the HTML shell, which surfaces
      // as a baffling "Unexpected token <" in the console.
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});