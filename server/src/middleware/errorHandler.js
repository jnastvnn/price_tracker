import ResponseFormatter from '../utils/ResponseFormatter.js';
import logger from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || err.statusCode || 500;
  const errorId = Math.random().toString(36).substring(2, 15);

  logger.error('Request failed', {
    errorId,
    status,
    message: err.message,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  const details = process.env.NODE_ENV === 'development' ? err.details || err : null;
  return ResponseFormatter.error(
    res,
    status === 500 ? 'Something went wrong' : err.message,
    status,
    details
  );
};

export default errorHandler;
