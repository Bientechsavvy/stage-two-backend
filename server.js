const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const profileRoutes = require('./routes/profileRoutes');
const authRoutes = require('./routes/authRoutes');
const { requestLogger } = require('./middleware/logger');
const { authLimiter, apiLimiter } = require('./middleware/rateLimiter');

const app = express();

app.use(cors({
  origin: ['http://35.180.66.115:5173', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Version'],
}));

app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

app.use('/auth', authLimiter, authRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/users', apiLimiter, authRoutes);
app.use('/api/profiles', apiLimiter, profileRoutes);
app.use('/api/v1/profiles', apiLimiter, profileRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'success', message: 'Insighta Labs API is running' });
});

app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});