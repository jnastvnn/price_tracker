import helmet from 'helmet';
import compression from 'compression';

// Security headers configuration
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // X-Frame-Options
  frameguard: {
    action: 'deny'
  },
  
  // X-Content-Type-Options
  noSniff: true,
  
  // X-XSS-Protection
  xssFilter: true,
  
  // Referrer Policy
  referrerPolicy: {
    policy: 'same-origin'
  },
  
  // Hide X-Powered-By header
  hidePoweredBy: true,
  
  // DNS Prefetch Control
  dnsPrefetchControl: {
    allow: false
  },
  
  // Don't cache sensitive pages
  noCache: false, // We want some caching for performance
  
  // Permissions Policy (formerly Feature Policy)
  permissionsPolicy: {
    features: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      usb: [],
      magnetometer: [],
      gyroscope: [],
      accelerometer: []
    }
  }
});

// Compression middleware for better performance
export const compressionMiddleware = compression({
  // Only compress responses above 1KB
  threshold: 1024,
  
  // Compression level (1-9, 6 is default)
  level: 6,
  
  // Filter function to determine what to compress
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // Use compression for all other responses
    return compression.filter(req, res);
  }
});

// Additional security middleware
export const additionalSecurity = (req, res, next) => {
  // Remove sensitive headers that might leak information
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Add custom security headers
  res.setHeader('X-API-Version', '1.0');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  next();
};

// IP whitelist middleware (for future use)
export const createIPWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    // Skip in development
    if (process.env.NODE_ENV === 'development') {
      return next();
    }
    
    // If no whitelist is provided, allow all
    if (allowedIPs.length === 0) {
      return next();
    }
    
    // Check if IP is in whitelist
    if (allowedIPs.includes(clientIP)) {
      return next();
    }
    
    // IP not allowed
    res.status(403).json({
      error: 'Access denied',
      message: 'Your IP address is not allowed to access this resource'
    });
  };
};

// Request size limiter
export const requestSizeLimiter = (maxSize = '1mb') => {
  return (req, res, next) => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength);
      const maxSizeInBytes = parseSize(maxSize);
      
      if (sizeInBytes > maxSizeInBytes) {
        return res.status(413).json({
          error: 'Request too large',
          message: `Request size exceeds maximum allowed size of ${maxSize}`,
          maxSize: maxSize,
          receivedSize: formatBytes(sizeInBytes)
        });
      }
    }
    
    next();
  };
};

// Helper function to parse size strings like '1mb', '500kb'
const parseSize = (size) => {
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (!match) return 0;
  
  const [, number, unit] = match;
  return parseFloat(number) * (units[unit] || 1);
};

// Helper function to format bytes
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}; 
