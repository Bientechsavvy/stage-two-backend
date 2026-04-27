const express = require('express');
const cors = require('cors');
require('dotenv').config();

const profileRoutes = require('./routes/profileRoutes');

const app = express();

// ✅ Enable CORS (required for grading)
app.use(cors());

// ✅ Parse JSON body
app.use(express.json());

// ✅ Root route (optional but good for testing)
app.get('/', (req, res) => {
  res.send('API is running...');
});

// ✅ CORRECT route prefix (IMPORTANT FIX)
app.use('/api/profiles', profileRoutes);

// ✅ 404 handler (must be last)
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// ✅ Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});