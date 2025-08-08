// Rate limiting constants for different route types
export const RATE_LIMITS = {
  // Global rate limit - applies to all routes
  GLOBAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 100 requests per window
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    }
  },

  // Category routes - moderate usage
  CATEGORIES: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 30 requests per minute
    message: {
      error: 'Too many category requests, please try again in a minute.',
      retryAfter: '1 minute'
    }
  },

  // Search routes - expensive queries
  SEARCH: {
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute
    message: {
      error: 'Too many search requests, please try again in a minute.',
      retryAfter: '1 minute'
    }
  },

  // Heavy DB queries (models, brands)
  HEAVY_QUERIES: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: {
      error: 'Too many heavy query requests, please try again in a minute.',
      retryAfter: '1 minute'
    }
  },

  // Health check - for monitoring tools
  HEALTH_CHECK: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: {
      error: 'Too many health check requests.',
      retryAfter: '1 minute'
    }
  }
};

// Slow down configuration - progressively slow down repeated requests
export const SLOW_DOWN_CONFIG = {
  windowMs: 60 * 1000, // 1 minute
  delayAfter: 5, // Start slowing down after 5 requests
  maxDelayMs: 5000, // Maximum delay of 5 seconds
  skipFailedRequests: true, // Don't count failed requests
  skipSuccessfulRequests: false // Count successful requests
}; 