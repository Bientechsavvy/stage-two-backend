const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { status: 'error', message: 'Too many requests, please try again later' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => {
    const ip = req.ip || req.connection.remoteAddress || '';
    return req.user?.id || ip.replace(/^::ffff:/, '');
  },
  message: { status: 'error', message: 'Too many requests, please try again later' },
});

module.exports = { authLimiter, apiLimiter };