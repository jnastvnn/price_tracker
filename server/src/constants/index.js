// Application status constants
export const STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
  PENDING: 'pending'
};

// Database attribute IDs for listing attributes
export const ATTRIBUTE_IDS = {
  BRAND: 6,
  MODEL: 2,
  COLOR: 3,
  STORAGE: 4,
  PROCESSOR: 5,
  RAM: 7,
  GRAPHICS_CARD: 8,
  OPERATING_SYSTEM: 9,
  SIZE: 10,
  RESOLUTION: 11,
  REFRESH_RATE: 12,
  LATENCY: 13,
  PANEL_TECHNOLOGY: 14
};

export const ATTRIBUTE_NAMES = {
  MODEL_KEY: 'model_key',
  MODEL: 'Model',
  BRAND: 'Brand'
};

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// Default pagination values
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100
};

// Search and filter constants
export const SEARCH = {
  MIN_SEARCH_LENGTH: 2,
  MAX_SEARCH_LENGTH: 100
}; 
