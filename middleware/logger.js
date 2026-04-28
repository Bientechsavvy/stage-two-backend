const db = require('../config/db');

async function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', async () => {
    const duration = Date.now() - start;
    try {
      const userId = req.user?.id || null;
      await db.query(
        `INSERT INTO request_logs (user_id, method, path, status_code, ip)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, req.method, req.originalUrl, res.statusCode, req.ip]
      );
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    } catch (err) {
      // Silent fail
    }
  });

  next();
}

module.exports = { requestLogger };