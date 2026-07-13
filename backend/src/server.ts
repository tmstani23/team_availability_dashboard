import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import workShiftRoutes from './routes/workShiftRoutes';
import authRoutes from './routes/authRoutes';
import teamMembersRoutes from './routes/teamMembersRoutes';

dotenv.config();

const app = express();

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
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// Parses the "token" cookie on incoming requests into req.cookies, so
// authenticate middleware can read it
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/team-members', teamMembersRoutes);
app.use('/api/work-shifts', workShiftRoutes);

app.get('/', (req, res) => {
  res.send('Team Availability Backend is running');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is connected' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});