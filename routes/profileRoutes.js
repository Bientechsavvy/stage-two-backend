const express = require('express');
const router = express.Router();
const {
  getAllProfiles,
  searchProfiles,
  exportCSV,
  createProfile,
} = require('../controllers/profileController');
const { authenticate, requireRole, checkApiVersion } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadCSV } = require('../controllers/uploadController');
// All routes require auth + API version header
router.post('/upload', requireRole('admin'), upload.single('file'), uploadCSV);

router.get('/search', searchProfiles);
router.get('/export', requireRole('admin', 'analyst'), exportCSV);
router.get('/', getAllProfiles);
router.post('/', requireRole('admin'), createProfile);

module.exports = router;