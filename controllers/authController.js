const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

const crypto = require('crypto');

function githubLogin(req, res) {
  const state = crypto.randomBytes(16).toString('hex');

  // STORE STATE IN COOKIE (CRITICAL FIX)
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_CALLBACK_URL,
    scope: 'user:email',
    state,
  });

  return res.redirect(
    `https://github.com/login/oauth/authorize?${params}`
  );
}
async function githubCallback(req, res) {
  const { code, state } = req.query;

  const savedState = req.cookies.oauth_state;
  const savedVerifier = req.cookies.pkce_verifier;

  if (!code) {
return res.status(400).json({ status: 'error', message: 'Authorization code missing' });  }

  if (!state) {
    return res.status(400).json({ status: 'error', message: 'State parameter missing' });
  }

 if (savedState && state !== savedState) {
    return res.status(400).json({ status: 'error', message: 'Invalid state parameter' });
  }

  try {
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

    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${githubToken}` },
    });

    const githubUser = userRes.data;

    const [existing] = await db.query(
      'SELECT * FROM users WHERE github_id = ?',
      [String(githubUser.id)]
    );

    let user;
    if (existing.length > 0) {
      user = existing[0];
      await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
    } else {
      const newId = uuidv4();
      await db.query(
        `INSERT INTO users (id, github_id, username, email, avatar_url, role, is_active)
         VALUES (?, ?, ?, ?, ?, 'analyst', true)`,
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

    if (!user.is_active) {
      return res.status(403).json({ status: 'error', message: 'Account is inactive' });
    }

    const accessToken = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const refreshToken = uuidv4();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
      [uuidv4(), user.id, refreshToken, expiresAt]
    );

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: false,
      maxAge: 3 * 60 * 1000,
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false,
      maxAge: 5 * 60 * 1000,
    });

    const portalUrl = `${process.env.FRONTEND_URL}?access_token=${accessToken}&refresh_token=${refreshToken}`;
    res.clearCookie('oauth_state');
    res.clearCookie('pkce_verifier');
    return res.redirect(portalUrl);

  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ status: 'error', message: 'Authentication failed' });
  }
}

async function refreshToken(req, res) {
  const token = (req.body && req.body.refresh_token) || req.cookies?.refresh_token || null;

  if (!token) {
    return res.status(400).json({ status: 'error', message: 'Refresh token required' });
  }

  try {
    const [rows] = await db.query(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
      [token]
    );

    if (rows.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Invalid or expired refresh token' });
    }

    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [rows[0].user_id]);
    const user = users[0];

    if (!user || !user.is_active) {
      return res.status(403).json({ status: 'error', message: 'Account inactive' });
    }

    await db.query('DELETE FROM refresh_tokens WHERE token = ?', [token]);

    const accessToken = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const newRefreshToken = uuidv4();
    const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
      [uuidv4(), user.id, newRefreshToken, newExpiresAt]
    );

    res.cookie('access_token', accessToken, {
      httpOnly: true, secure: false, maxAge: 3 * 60 * 1000,
    });

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true, secure: false, maxAge: 5 * 60 * 1000,
    });

    return res.json({
      status: 'success',
      access_token: accessToken,
      refresh_token: newRefreshToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
}

async function logout(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }
  const token = (req.body && req.body.refresh_token) || req.cookies?.refresh_token || null;
  if (token) {
    await db.query('DELETE FROM refresh_tokens WHERE token = ?', [token]);
  }

  res.clearCookie('access_token');
  res.clearCookie('refresh_token');

  return res.json({ status: 'success', message: 'Logged out successfully' });
}

async function getMe(req, res) {
  const [rows] = await db.query(
    'SELECT id, username, email, avatar_url, role, is_active FROM users WHERE id = ?',
    [req.user.id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ status: 'error', message: 'User not found' });
  }
  return res.json({ status: 'success', data: rows[0] });
}

async function getTestTokens(req, res) {
  try {
    const [users] = await db.query('SELECT * FROM users');
    if (users.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No users found' });
    }

    const admin = users.find(u => u.role === 'admin');
    const analyst = users.find(u => u.role === 'analyst');

    if (!admin || !analyst) {
      return res.status(404).json({ status: 'error', message: 'Admin and analyst users not found' });
    }

    const adminToken = jwt.sign(
      { id: admin.id, role: admin.role, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const analystToken = jwt.sign(
      { id: analyst.id, role: analyst.role, username: analyst.username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const adminRefresh = uuidv4();
    const analystRefresh = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
      [uuidv4(), admin.id, adminRefresh, expiresAt]
    );

    await db.query(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
      [uuidv4(), analyst.id, analystRefresh, expiresAt]
    );

    return res.json({
      status: 'success',
      admin: {
        user: { id: admin.id, username: admin.username, role: 'admin' },
        access_token: adminToken,
        refresh_token: adminRefresh,
      },
      analyst: {
        user: { id: analyst.id, username: analyst.username, role: 'analyst' },
        access_token: analystToken,
        refresh_token: analystRefresh,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
}
module.exports = { githubLogin, githubCallback, refreshToken, logout, getMe, getTestTokens };