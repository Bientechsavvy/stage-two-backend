const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

// ─── STEP 1: Redirect to GitHub ───────────────
function githubLogin(req, res) {
  const { code_challenge, code_challenge_method, state } = req.query;

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_CALLBACK_URL,
    scope: 'user:email',
    state: state || 'default_state',
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}

// ─── STEP 2: GitHub Callback ──────────────────
async function githubCallback(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ status: 'error', message: 'Authorization code missing' });
  }

  try {
    // Exchange code for GitHub access token
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_CALLBACK_URL,
      },
      { headers: { Accept: 'application/json' } }
    );

    const githubToken = tokenRes.data.access_token;

    if (!githubToken) {
      return res.status(401).json({ status: 'error', message: 'Failed to get GitHub token' });
    }

    // Get GitHub user info
    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${githubToken}` },
    });

    const githubUser = userRes.data;

    // Check if user exists
    const [existing] = await db.query(
      'SELECT * FROM users WHERE github_id = ?',
      [String(githubUser.id)]
    );

    let user;
    if (existing.length > 0) {
      user = existing[0];
    } else {
      // Create new user
      const newId = uuidv4();
      await db.query(
        `INSERT INTO users (id, github_id, username, email, avatar_url, role)
         VALUES (?, ?, ?, ?, ?, 'analyst')`,
        [
          newId,
          String(githubUser.id),
          githubUser.login,
          githubUser.email || '',
          githubUser.avatar_url || '',
        ]
      );
      const [newUser] = await db.query('SELECT * FROM users WHERE id = ?', [newId]);
      user = newUser[0];
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const refreshToken = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at)
       VALUES (?, ?, ?, ?)`,
      [uuidv4(), user.id, refreshToken, expiresAt]
    );

    // Set HTTP-only cookie for web portal
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: false, // set to true when using HTTPS
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Return tokens in response (for CLI)
    return res.json({
      status: 'success',
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ status: 'error', message: 'Authentication failed' });
  }
}

// ─── STEP 3: Refresh Token ────────────────────
async function refreshToken(req, res) {
  const token = req.body.refresh_token || req.cookies?.refresh_token;

  if (!token) {
    return res.status(400).json({ status: 'error', message: 'Refresh token required' });
  }

  const [rows] = await db.query(
    'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
    [token]
  );

  if (rows.length === 0) {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired refresh token' });
  }

  const [users] = await db.query('SELECT * FROM users WHERE id = ?', [rows[0].user_id]);
  const user = users[0];

  const accessToken = jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: false,
    maxAge: 15 * 60 * 1000,
  });

  return res.json({ status: 'success', access_token: accessToken });
}

// ─── STEP 4: Logout ───────────────────────────
async function logout(req, res) {
  const token = req.body.refresh_token || req.cookies?.refresh_token;

  if (token) {
    await db.query('DELETE FROM refresh_tokens WHERE token = ?', [token]);
  }

  res.clearCookie('access_token');
  res.clearCookie('refresh_token');

  return res.json({ status: 'success', message: 'Logged out successfully' });
}

// ─── STEP 5: Get current user ─────────────────
async function getMe(req, res) {
  const [rows] = await db.query('SELECT id, username, email, avatar_url, role FROM users WHERE id = ?', [req.user.id]);
  if (rows.length === 0) {
    return res.status(404).json({ status: 'error', message: 'User not found' });
  }
  return res.json({ status: 'success', data: rows[0] });
}

module.exports = { githubLogin, githubCallback, refreshToken, logout, getMe };