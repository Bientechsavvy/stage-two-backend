const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const profileRoutes = require('./routes/profileRoutes');
const authRoutes = require('./routes/authRoutes');
const { requestLogger } = require('./middleware/logger');
const { rateLimiter } = require('./middleware/rateLimiter');

const app = express();

// ─── CORS ─────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

// ─── MIDDLEWARE ───────────────────────────────
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);
app.use(rateLimiter);

// ─── ROUTES ───────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profiles', profileRoutes);

// ─── HEALTH CHECK ─────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'success', message: 'Insighta Labs API is running' });
});

// ─── 404 ──────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});