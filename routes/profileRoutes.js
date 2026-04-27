const express = require('express');
const router = express.Router();
const { getAllProfiles, searchProfiles, exportCSV } = require('../controllers/profileController');
const { authenticate, requireRole } = require('../middleware/auth');

// All profile routes require authentication
router.get('/search', authenticate, searchProfiles);
router.get('/export', authenticate, requireRole('admin'), exportCSV);
router.get('/', authenticate, getAllProfiles);

module.exports = router;