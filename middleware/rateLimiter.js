const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { status: 'error', message: 'Too many requests, please try again later' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { status: 'error', message: 'Too many requests, please try again later' },
});

module.exports = { authLimiter, apiLimiter };