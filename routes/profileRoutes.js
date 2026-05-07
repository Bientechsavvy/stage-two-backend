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
router.post('/upload', authenticate, requireRole('admin'), upload.single('file'), uploadCSV);

router.get('/search', authenticate, searchProfiles);

router.get('/export', authenticate, requireRole('admin', 'analyst'), exportCSV);

router.get('/', authenticate, getAllProfiles);

router.post('/', authenticate, requireRole('admin'), createProfile);

module.exports = router;
