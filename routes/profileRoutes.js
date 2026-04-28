const express = require('express');
const router = express.Router();
const {
  getAllProfiles,
  searchProfiles,
  exportCSV,
  createProfile,
} = require('../controllers/profileController');
const { authenticate, requireRole, checkApiVersion } = require('../middleware/auth');

// All routes require auth + API version header
router.use(authenticate);
router.use(checkApiVersion);

router.get('/search', searchProfiles);
router.get('/export', requireRole('admin', 'analyst'), exportCSV);
router.get('/', getAllProfiles);
router.post('/', requireRole('admin'), createProfile);

module.exports = router;