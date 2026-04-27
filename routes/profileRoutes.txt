const express = require('express');
const router = express.Router();
const { getAllProfiles, searchProfiles } = require('../controllers/profileController');

// IMPORTANT: /search must come BEFORE /:id or any wildcard
router.get('/search', searchProfiles);
router.get('/', getAllProfiles);

module.exports = router;
