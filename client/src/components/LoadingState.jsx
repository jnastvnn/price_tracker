import React from 'react';

const LoadingState = ({ 
  size = 'medium', 
  text = 'Loading...', 
  fullPage = false,
  overlay = false,
  className = ''
}) => {
  const sizeClasses = {
    small: 'loading-small',
    medium: 'loading-medium',
    large: 'loading-large'
  };

  const containerClass = `
    loading-container 
    ${sizeClasses[size]} 
    ${fullPage ? 'loading-fullpage' : ''} 
    ${overlay ? 'loading-overlay' : ''}
    ${className}
  `.trim();

  const content = (
    <div className={containerClass}>
      <div className="loading-content">
        <div className="loading-spinner">
          <div className="spinner-circle"></div>
        </div>
        {text && <div className="loading-text">{text}</div>}
      </div>
    </div>
  );

  return content;
};

// Skeleton loading component for content placeholders
export const SkeletonLoader = ({ 
  lines = 3, 
  width = '100%', 
  height = '1rem',
  className = ''
}) => {
  return (
    <div className={`skeleton-container ${className}`}>
      {Array.from({ length: lines }, (_, index) => (
        <div 
          key={index}
          className="skeleton-line"
          style={{ 
            width: Array.isArray(width) ? width[index] || width[0] : width,
            height 
          }}
        />
      ))}
    </div>
  );
};

// Card skeleton for loading cards/tiles
export const CardSkeleton = ({ count = 1, className = '' }) => {
  return (
    <div className={`card-skeleton-container ${className}`}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card-skeleton">
          <div className="card-skeleton-header">
            <SkeletonLoader lines={1} width="60%" height="1.2rem" />
          </div>
          <div className="card-skeleton-body">
            <SkeletonLoader lines={2} width={['100%', '80%']} />
          </div>
          <div className="card-skeleton-footer">
            <SkeletonLoader lines={1} width="40%" height="0.9rem" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default LoadingState; 