const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  // Check header first, then cookie
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1] || req.cookies?.access_token;

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

module.exports = { authenticate, requireRole };