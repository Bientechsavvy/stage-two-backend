const express = require('express');
const router = express.Router();
const { githubLogin, githubCallback, refreshToken, logout, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.get('/github', githubLogin);
router.get('/github/callback', githubCallback);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);

module.exports = router;