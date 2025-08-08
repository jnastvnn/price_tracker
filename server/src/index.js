import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

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

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for accurate IP addresses (important for rate limiting)
app.set('trust proxy', 1);

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
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// Enhanced request logging middleware
app.use((req, res, next) => {
  
  
  // Log query parameters if present
  if (Object.keys(req.query).length > 0) {
    console.log(`Query params: ${JSON.stringify(req.query)}`);
  }
  
  next();
});

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
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  });
});

// Enhanced global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const timestamp = new Date().toISOString();
  const errorId = Math.random().toString(36).substring(2, 15);
  
  // Log error details
  console.error(`[${timestamp}] Error ID: ${errorId}`);
  console.error('Error details:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Determine error status
  const status = err.status || err.statusCode || 500;
  
  // Different responses for different environments
  const errorResponse = {
    error: 'Internal server error',
    message: status === 500 ? 'Something went wrong' : err.message,
    timestamp,
    errorId
  };
  
  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err;
  }
  
  res.status(status).json(errorResponse);
});

// Graceful shutdown handlers
const gracefulShutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully`);
  
  // Close server
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close database connections, cleanup, etc.
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Security: Rate limiting and security headers enabled`);
  console.log(`📝 Logging: Enhanced request logging enabled`);
  console.log(`⚡ Performance: Compression enabled`);
}); 