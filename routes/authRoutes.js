const express = require('express');
const router = express.Router();
const { githubLogin, githubCallback, refreshToken, logout, getMe, getTestTokens } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.get('/github', githubLogin);
router.get('/github/callback', githubCallback);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.get('/test-tokens', getTestTokens);
module.exports = router;