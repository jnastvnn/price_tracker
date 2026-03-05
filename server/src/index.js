import express from 'express';
import cors from 'cors';

// Import routes
import listingsRouter from './routes/listings.js';
import categoriesRouter from './routes/categories.js';
import modelsRouter from './routes/models.js';
import brandsRouter from './routes/brands.js';

// Import middleware
import { 
  globalRateLimit, 
  categoryRateLimit, 
  searchRateLimit, 
  heavyQueryRateLimit, 
  healthCheckRateLimit,
  slowDownMiddleware 
} from './middleware/rateLimiter.js';
import { 
  securityHeaders, 
  compressionMiddleware, 
  additionalSecurity,
  requestSizeLimiter 
} from './middleware/security.js';
import { sanitizeInput } from './middleware/validation.js';
import requestLogger from './middleware/requestLogger.js';
import responseTime from './middleware/responseTime.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';
import env from './config/env.js';
import logger from './utils/logger.js';

const app = express();
const PORT = env.port;

// Trust proxy for accurate IP addresses (important for rate limiting)
app.set('trust proxy', 1);

// Response time header
app.use(responseTime);

// Security middleware (apply early)
app.use(securityHeaders);
app.use(compressionMiddleware);
app.use(additionalSecurity);
app.use(requestSizeLimiter('10mb'));

// Global rate limiting
app.use(globalRateLimit);

// Slow down middleware for repeated requests
app.use(slowDownMiddleware);

// CORS configuration
app.use(cors({
  origin: env.clientUrl,
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// Request logging
app.use(requestLogger);

// Health check endpoint with specific rate limiting
app.get('/health', healthCheckRateLimit, (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// API routes with specific rate limiting
app.use('/api/listings', searchRateLimit, listingsRouter);
app.use('/api/categories', categoryRateLimit, categoriesRouter);
app.use('/api/models', heavyQueryRateLimit, modelsRouter);
app.use('/api/brands', heavyQueryRateLimit, brandsRouter);

// 404 handler
app.use('*', notFound);
app.use(errorHandler);

// Graceful shutdown handlers
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  // Close server
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close database connections, cleanup, etc.
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { message: err.message });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason: String(reason) });
  process.exit(1);
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Environment: ${env.nodeEnv}`);
  logger.info('Security: Rate limiting and security headers enabled');
  logger.info('Logging: Request logging enabled');
  logger.info('Performance: Compression enabled');
});
