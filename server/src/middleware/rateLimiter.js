import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { RATE_LIMITS, SLOW_DOWN_CONFIG } from '../constants/rateLimits.js';

// Remove custom key generator to use default (handles IPv6 properly)

// Custom handler for rate limit exceeded
const rateLimitHandler = (req, res, next, options) => {
  const retryAfter = Math.round(options.windowMs / 1000);
  
  res.status(429).json({
    error: options.message.error,
    retryAfter: options.message.retryAfter,
    retryAfterSeconds: retryAfter,
    limit: options.max,
    current: req.rateLimit?.current || 0,
    remaining: req.rateLimit?.remaining || 0,
    resetTime: new Date(Date.now() + options.windowMs).toISOString()
  });
};

// Global rate limiter - applies to all routes
export const globalRateLimit = rateLimit({
  ...RATE_LIMITS.GLOBAL,
  handler: rateLimitHandler,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks in development
    return process.env.NODE_ENV === 'development' && req.path === '/health';
  }
});

// Category routes rate limiter
export const categoryRateLimit = rateLimit({
  ...RATE_LIMITS.CATEGORIES,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});

// Search routes rate limiter
export const searchRateLimit = rateLimit({
  ...RATE_LIMITS.SEARCH,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});

// Heavy queries rate limiter (models, brands)
export const heavyQueryRateLimit = rateLimit({
  ...RATE_LIMITS.HEAVY_QUERIES,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});

// Health check rate limiter
export const healthCheckRateLimit = rateLimit({
  ...RATE_LIMITS.HEALTH_CHECK,
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});

// Slow down middleware - progressively slow down repeated requests
export const slowDownMiddleware = slowDown({
  ...SLOW_DOWN_CONFIG,
  delayMs: () => 500, // Fixed delay per request
  validate: {
    delayMs: false // Disable the deprecation warning
  }
});

// Rate limiter factory for custom limits
export const createRateLimit = (options) => {
  return rateLimit({
    ...options,
    handler: rateLimitHandler,
    standardHeaders: true,
    legacyHeaders: false
  });
}; 