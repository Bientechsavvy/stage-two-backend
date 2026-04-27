const db = require('../config/db');

async function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', async () => {
    try {
      const userId = req.user?.id || null;
      await db.query(
        `INSERT INTO request_logs (user_id, method, path, status_code, ip)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, req.method, req.originalUrl, res.statusCode, req.ip]
      );
    } catch (err) {
      // Silent fail — logging should never break the app
    }
  });

  next();
}

module.exports = { requestLogger };