import { useEffect, useRef, useState } from 'react';

// Hook for managing focus
export const useFocus = () => {
  const ref = useRef(null);

  const setFocus = () => {
    if (ref.current) {
      ref.current.focus();
    }
  };

  return [ref, setFocus];
};

// Hook for keyboard navigation
export const useKeyboardNavigation = (items, onSelect, options = {}) => {
  const [activeIndex, setActiveIndex] = useState(options.initialIndex || -1);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleKeyDown = (event) => {
    if (!items || items.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setIsNavigating(true);
        setActiveIndex((prev) => (prev + 1) % items.length);
        break;
      
      case 'ArrowUp':
        event.preventDefault();
        setIsNavigating(true);
        setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
        break;
      
      case 'Enter':
      case ' ':
        if (activeIndex >= 0 && onSelect) {
          event.preventDefault();
          onSelect(items[activeIndex], activeIndex);
        }
        break;
      
      case 'Escape':
        setActiveIndex(-1);
        setIsNavigating(false);
        break;
      
      case 'Home':
        event.preventDefault();
        setIsNavigating(true);
        setActiveIndex(0);
        break;
      
      case 'End':
        event.preventDefault();
        setIsNavigating(true);
        setActiveIndex(items.length - 1);
        break;
      
      default:
        // Letter key navigation
        if (event.key.length === 1 && options.enableTypeahead) {
          const letter = event.key.toLowerCase();
          const startIndex = activeIndex + 1;
          let foundIndex = -1;

          // Search from current position
          for (let i = startIndex; i < items.length; i++) {
            if (items[i]?.name?.toLowerCase().startsWith(letter)) {
              foundIndex = i;
              break;
            }
          }

          // Search from beginning if not found
          if (foundIndex === -1) {
            for (let i = 0; i < startIndex; i++) {
              if (items[i]?.name?.toLowerCase().startsWith(letter)) {
                foundIndex = i;
                break;
              }
            }
          }

          if (foundIndex !== -1) {
            setActiveIndex(foundIndex);
            setIsNavigating(true);
          }
        }
        break;
    }
  };

  const reset = () => {
    setActiveIndex(-1);
    setIsNavigating(false);
  };

  return {
    activeIndex,
    isNavigating,
    handleKeyDown,
    setActiveIndex,
    reset
  };
};

// Hook for managing ARIA announcements
export const useAnnouncements = () => {
  const [announcement, setAnnouncement] = useState('');
  const timeoutRef = useRef(null);

  const announce = (message, priority = 'polite') => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setAnnouncement(''); // Clear first to ensure re-announcement
    
    timeoutRef.current = setTimeout(() => {
      setAnnouncement(message);
    }, 100);

    // Clear announcement after a delay
    setTimeout(() => {
      setAnnouncement('');
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { announcement, announce };
};

// Hook for skip links
export const useSkipLinks = () => {
  const skipLinksRef = useRef(null);

  const addSkipLink = (target, label) => {
    if (typeof document === 'undefined') return;

    const existingLink = document.querySelector(`[href="#${target}"]`);
    if (existingLink) return;

    const link = document.createElement('a');
    link.href = `#${target}`;
    link.textContent = label;
    link.className = 'skip-link';
    
    // Insert at the beginning of the body
    document.body.insertBefore(link, document.body.firstChild);
  };

  useEffect(() => {
    // Add common skip links
    addSkipLink('main-content', 'Skip to main content');
    addSkipLink('main-navigation', 'Skip to navigation');
  }, []);

  return { addSkipLink };
};

// Hook for reduced motion preference
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
};

// Hook for high contrast preference
export const useHighContrast = () => {
  const [prefersHighContrast, setPrefersHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setPrefersHighContrast(mediaQuery.matches);

    const handleChange = (event) => {
      setPrefersHighContrast(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersHighContrast;
};

// Hook for managing focus trap (useful for modals)
export const useFocusTrap = (isActive = false) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [isActive]);

  return containerRef;
};

// Main accessibility hook that combines multiple utilities
export const useAccessibility = (options = {}) => {
  const { announcement, announce } = useAnnouncements();
  const prefersReducedMotion = useReducedMotion();
  const prefersHighContrast = useHighContrast();
  const { addSkipLink } = useSkipLinks();

  // Generate unique IDs for ARIA labeling
  const generateId = (prefix = 'accessible') => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Helper for proper heading hierarchy
  const getHeadingLevel = (parentLevel = 1) => {
    return Math.min(parentLevel + 1, 6);
  };

  return {
    announcement,
    announce,
    prefersReducedMotion,
    prefersHighContrast,
    addSkipLink,
    generateId,
    getHeadingLevel,
    useFocus,
    useKeyboardNavigation,
    useFocusTrap
  };
};

export default useAccessibility; 