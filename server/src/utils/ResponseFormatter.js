/**
 * Standardized API response formatter
 */
class ResponseFormatter {
  /**
   * Success response with data
   */
  static success(res, data, message = null, statusCode = 200) {
    const response = {
      success: true,
      data
    };

    if (message) {
      response.message = message;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Success response with pagination
   */
  static successWithPagination(res, data, pagination, message = null) {
    return res.json({
      success: true,
      data,
      pagination,
      message
    });
  }

  /**
   * Error response
   */
  static error(res, message, statusCode = 500, details = null) {
    const response = {
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    };

    if (details && process.env.NODE_ENV === 'development') {
      response.details = details;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Validation error response
   */
  static validationError(res, errors) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: 'Invalid input data provided',
      details: errors,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Not found response
   */
  static notFound(res, resource = 'Resource') {
    return res.status(404).json({
      success: false,
      error: `${resource} not found`,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Unauthorized response
   */
  static unauthorized(res, message = 'Unauthorized') {
    return res.status(401).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Forbidden response
   */
  static forbidden(res, message = 'Forbidden') {
    return res.status(403).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
}

export default ResponseFormatter; 