import logger from '../utils/logger.js';

const requestLogger = (req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    logger.info(`${req.method} ${req.originalUrl}`, {
      status: res.statusCode,
      durationMs,
      ip: req.ip,
    });
  });

  next();
};

export default requestLogger;
