const jwt = require('jsonwebtoken');

async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1] || req.cookies?.access_token;

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check is_active
    const db = require('../config/db');
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(403).json({ status: 'error', message: 'Account is inactive' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ status: 'error', message: 'Forbidden: insufficient permissions' });
    }
    next();
  };
}

function checkApiVersion(req, res, next) {
  const version = req.headers['x-api-version'];
  if (!version) {
    return res.status(400).json({ status: 'error', message: 'API version header required' });
  }
  next();
}

module.exports = { authenticate, requireRole, checkApiVersion };