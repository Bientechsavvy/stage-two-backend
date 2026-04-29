const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const profileRoutes = require('./routes/profileRoutes');
const authRoutes = require('./routes/authRoutes');
const { requestLogger } = require('./middleware/logger');
const { authLimiter, apiLimiter } = require('./middleware/rateLimiter');

const app = express();

app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

app.use('/api/v1/auth', authLimiter);
app.use('/api/auth', authLimiter);
app.use('/auth', authLimiter);
app.use('/api/v1/profiles', apiLimiter);
app.use('/api/profiles', apiLimiter);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profiles', profileRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/auth', authRoutes);

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