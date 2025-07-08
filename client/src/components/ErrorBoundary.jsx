import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });

    // You can also log the error to an error reporting service here
    // logErrorToService(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      const { fallback: Fallback } = this.props;
      
      if (Fallback) {
        return (
          <Fallback 
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            onRetry={this.handleRetry}
          />
        );
      }

      // Default error UI
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h2>Oops! Something went wrong</h2>
            <p>We're sorry, but something unexpected happened.</p>
            <button 
              onClick={this.handleRetry}
              className="error-retry-button"
            >
              Try Again
            </button>
            
            {process.env.NODE_ENV === 'development' && (
              <details className="error-details">
                <summary>Error Details (Development)</summary>
                <pre className="error-stack">
                  {this.state.error && this.state.error.toString()}
                  <br />
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Error display component for API/data errors
export const ErrorDisplay = ({ 
  error, 
  onRetry, 
  className = '',
  title = 'Something went wrong',
  showDetails = false 
}) => {
  const errorMessage = error?.message || error || 'An unexpected error occurred';

  return (
    <div className={`error-display ${className}`}>
      <div className="error-display-content">
        <div className="error-icon" aria-hidden="true">⚠️</div>
        <h3 className="error-title">{title}</h3>
        <p className="error-message">{errorMessage}</p>
        
        {onRetry && (
          <button 
            onClick={onRetry}
            className="error-retry-button"
          >
            Try Again
          </button>
        )}

        {showDetails && error?.stack && (
          <details className="error-details">
            <summary>Technical Details</summary>
            <pre className="error-stack">{error.stack}</pre>
          </details>
        )}
      </div>
    </div>
  );
};

export default ErrorBoundary; 