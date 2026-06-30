import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';

import teamMembersRoutes from './routes/teamMembersRoutes';

dotenv.config();

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI!)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware section: Tools that run on every request
// Parses incoming JSON data from the frontend (important for availability updates)
app.use(express.json());

// Security / connection helper: Lets the React frontend safely call this backend
app.use(cors());

// Mount team members routes
app.use('/api/team-members', teamMembersRoutes);

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Team Availability Backend is running');
});

// Simple test route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is connected' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});