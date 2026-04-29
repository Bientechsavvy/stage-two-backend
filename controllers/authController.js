
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

// ─── STEP 1: Redirect to GitHub with PKCE ─────
function githubLogin(req, res) {
  const { state, code_challenge, code_challenge_method } = req.query;

  if (!state) {
    return res.status(400).json({ status: 'error', message: 'state parameter required' });
  }

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_CALLBACK_URL,
    scope: 'user:email',
    state,
  });

  if (code_challenge) {
    params.append('code_challenge', code_challenge);
    params.append('code_challenge_method', code_challenge_method || 'S256');
  }

  return res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}

// ─── STEP 2: GitHub Callback ──────────────────
async function githubCallback(req, res) {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).json({ status: 'error', message: 'Authorization code missing' });
  }

  if (!state) {
    return res.status(400).json({ status: 'error', message: 'State parameter missing' });
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
    return res.redirect(portalUrl);

  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ status: 'error', message: 'Authentication failed' });
  }
}

// ─── STEP 3: Refresh Token ────────────────────
async function refreshToken(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const token = req.body.refresh_token || req.cookies?.refresh_token;

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

// ─── STEP 4: Logout ───────────────────────────
async function logout(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

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
  const [rows] = await db.query(
    'SELECT id, username, email, avatar_url, role, is_active FROM users WHERE id = ?',
    [req.user.id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ status: 'error', message: 'User not found' });
  }
  return res.json({ status: 'success', data: rows[0] });
}

module.exports = { githubLogin, githubCallback, refreshToken, logout, getMe };










// const axios = require('axios');
// const jwt = require('jsonwebtoken');
// const { v4: uuidv4 } = require('uuid');
// const db = require('../config/db');

// // ─── STEP 1: Redirect to GitHub ───────────────
// function githubLogin(req, res) {
//   const { code_challenge, code_challenge_method, state } = req.query;

//   const params = new URLSearchParams({
//     client_id: process.env.GITHUB_CLIENT_ID,
//     redirect_uri: process.env.GITHUB_CALLBACK_URL,
//     scope: 'user:email',
//     state: state || 'default_state',
//   });

//   res.redirect(`https://github.com/login/oauth/authorize?${params}`);
// }

// // ─── STEP 2: GitHub Callback ──────────────────
// async function githubCallback(req, res) {
//   const { code } = req.query;

//   if (!code) {
//     return res.status(400).json({ status: 'error', message: 'Authorization code missing' });
//   }

//   try {
//     // Exchange code for GitHub access token
//     const tokenRes = await axios.post(
//       'https://github.com/login/oauth/access_token',
//       {
//         client_id: process.env.GITHUB_CLIENT_ID,
//         client_secret: process.env.GITHUB_CLIENT_SECRET,
//         code,
//         redirect_uri: process.env.GITHUB_CALLBACK_URL,
//       },
//       { headers: { Accept: 'application/json' } }
//     );

//     const githubToken = tokenRes.data.access_token;

//     if (!githubToken) {
//       return res.status(401).json({ status: 'error', message: 'Failed to get GitHub token' });
//     }

//     // Get GitHub user info
//     const userRes = await axios.get('https://api.github.com/user', {
//       headers: { Authorization: `Bearer ${githubToken}` },
//     });

//     const githubUser = userRes.data;

//     // Check if user exists
//     const [existing] = await db.query(
//       'SELECT * FROM users WHERE github_id = ?',
//       [String(githubUser.id)]
//     );

//     let user;
//     if (existing.length > 0) {
//       user = existing[0];
//       // Update last login
//       await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
//     } else {
//       // Create new user
//       const newId = uuidv4();
//       await db.query(
//         `INSERT INTO users (id, github_id, username, email, avatar_url, role)
//          VALUES (?, ?, ?, ?, ?, 'analyst')`,
//         [
//           newId,
//           String(githubUser.id),
//           githubUser.login,
//           githubUser.email || '',
//           githubUser.avatar_url || '',
//         ]
//       );
//       const [newUser] = await db.query('SELECT * FROM users WHERE id = ?', [newId]);
//       user = newUser[0];
//     }

//     // Generate tokens
//     const accessToken = jwt.sign(
//       { id: user.id, role: user.role, username: user.username },
//       process.env.JWT_SECRET,
//       { expiresIn: process.env.JWT_EXPIRES_IN }
//     );

//     const refreshToken = uuidv4();
//     const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
//     await db.query(
//       `INSERT INTO refresh_tokens (id, user_id, token, expires_at)
//        VALUES (?, ?, ?, ?)`,
//       [uuidv4(), user.id, refreshToken, expiresAt]
//     );

//     // Set HTTP-only cookie for web portal
//     res.cookie('access_token', accessToken, {
//       httpOnly: true,
//       secure: false, // set to true when using HTTPS
//       maxAge: 15 * 60 * 1000,
//     });

//     res.cookie('refresh_token', refreshToken, {
//       httpOnly: true,
//       secure: false,
//       maxAge: 7 * 24 * 60 * 60 * 1000,
//     });

//     // Return tokens in response (for CLI)
//     const redirectUri = req.query.redirect_uri || req.query.state_redirect;
// if (redirectUri && redirectUri.includes('localhost:9999')) {
//   return res.redirect(`http://localhost:9999/callback?access_token=${accessToken}&refresh_token=${refreshToken}`);
// }
// const portalUrl = `${process.env.FRONTEND_URL}?access_token=${accessToken}&refresh_token=${refreshToken}`;
// return res.redirect(portalUrl);
//   } catch (err) {
//     console.error(err.message);
//     return res.status(500).json({ status: 'error', message: 'Authentication failed' });
//   }
// }

// // ─── STEP 3: Refresh Token ────────────────────
// async function refreshToken(req, res) {
//   const token = req.body.refresh_token || req.cookies?.refresh_token;

//   if (!token) {
//     return res.status(400).json({ status: 'error', message: 'Refresh token required' });
//   }

//   const [rows] = await db.query(
//     'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
//     [token]
//   );

//   if (rows.length === 0) {
//     return res.status(401).json({ status: 'error', message: 'Invalid or expired refresh token' });
//   }

//   const [users] = await db.query('SELECT * FROM users WHERE id = ?', [rows[0].user_id]);
//   const user = users[0];

// // Invalidate old refresh token
// await db.query('DELETE FROM refresh_tokens WHERE token = ?', [token]);

// // Issue new tokens
// const accessToken = jwt.sign(
//   { id: user.id, role: user.role, username: user.username },
//   process.env.JWT_SECRET,
//   { expiresIn: process.env.JWT_EXPIRES_IN }
// );

// const newRefreshToken = require('uuid').v4();
// const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

// await db.query(
//   `INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
//   [require('uuid').v4(), user.id, newRefreshToken, newExpiresAt]
// );

// res.cookie('access_token', accessToken, {
//   httpOnly: true,
//   secure: false,
//   maxAge: 3 * 60 * 1000,
// });

// res.cookie('refresh_token', newRefreshToken, {
//   httpOnly: true,
//   secure: false,
//   maxAge: 5 * 60 * 1000,
// });

// return res.json({
//   status: 'success',
//   access_token: accessToken,
//   refresh_token: newRefreshToken,
// });
// }
// // ─── STEP 4: Logout ───────────────────────────
// async function logout(req, res) {
//   const token = req.body.refresh_token || req.cookies?.refresh_token;

//   if (token) {
//     await db.query('DELETE FROM refresh_tokens WHERE token = ?', [token]);
//   }

//   res.clearCookie('access_token');
//   res.clearCookie('refresh_token');

//   return res.json({ status: 'success', message: 'Logged out successfully' });
// }

// // ─── STEP 5: Get current user ─────────────────
// async function getMe(req, res) {
//   const [rows] = await db.query('SELECT id, username, email, avatar_url, role FROM users WHERE id = ?', [req.user.id]);
//   if (rows.length === 0) {
//     return res.status(404).json({ status: 'error', message: 'User not found' });
//   }
//   return res.json({ status: 'success', data: rows[0] });
// }

// module.exports = { githubLogin, githubCallback, refreshToken, logout, getMe };