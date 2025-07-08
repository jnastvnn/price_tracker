import React from 'react';

const AccessibilityAnnouncer = ({ announcement, priority = 'polite' }) => {
  if (!announcement) return null;

  return (
    <div
      aria-live={priority}
      aria-atomic="true"
      style={{
        position: 'absolute',
        left: '-10000px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden'
      }}
    >
      {announcement}
    </div>
  );
};

export default AccessibilityAnnouncer; 