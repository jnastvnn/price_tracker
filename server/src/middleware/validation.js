import { param, query, validationResult } from 'express-validator';

// Validation error handler
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));
    
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Invalid input data provided',
      details: formattedErrors,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

// Common validation rules
export const validateCategoryId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer')
    .toInt(),
  handleValidationErrors
];

export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  
  handleValidationErrors
];

export const validateSearch = [
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
    .escape(), // Escape HTML characters to prevent XSS
  
  handleValidationErrors
];

// Combined validation for listings endpoint
export const validateListingsQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')  
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
    .escape(),
  
  query('category')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category must be a positive integer')
    .toInt(),
  
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be a non-negative number')
    .toFloat(),
  
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be a non-negative number')
    .toFloat(),
  
  handleValidationErrors
];

// Category-specific validations
export const validateCategoryQuery = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer')
    .toInt(),
  
  handleValidationErrors
];

export const validateSubcategoriesQuery = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer')
    .toInt(),
  
  handleValidationErrors
];

export const validateModelsQuery = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  
  handleValidationErrors
];

export const validateBrandsQuery = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  
  handleValidationErrors
];

// Generic validation helpers
export const validateId = (paramName = 'id') => [
  param(paramName)
    .isInt({ min: 1 })
    .withMessage(`${paramName} must be a positive integer`)
    .toInt(),
  handleValidationErrors
];

export const validateOptionalString = (fieldName, maxLength = 255) => [
  query(fieldName)
    .optional()
    .isString()
    .trim()
    .isLength({ max: maxLength })
    .withMessage(`${fieldName} must be a string with maximum ${maxLength} characters`)
    .escape(),
  handleValidationErrors
];

// Custom validation middleware for complex scenarios
export const validatePriceRange = (req, res, next) => {
  const { minPrice, maxPrice } = req.query;
  
  if (minPrice && maxPrice && parseFloat(minPrice) > parseFloat(maxPrice)) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Minimum price cannot be greater than maximum price',
      details: [{
        field: 'priceRange',
        message: 'Invalid price range',
        value: { minPrice, maxPrice }
      }]
    });
  }
  
  next();
};

// Sanitization middleware
export const sanitizeInput = (req, res, next) => {
  // Remove any potential script tags or dangerous content
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    return value;
  };
  
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      req.query[key] = sanitizeValue(req.query[key]);
    });
  }
  
  // Sanitize body parameters
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      req.body[key] = sanitizeValue(req.body[key]);
    });
  }
  
  next();
}; 