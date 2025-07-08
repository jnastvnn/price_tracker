import React from 'react';

// Main grid container component
const Grid = ({ 
  children, 
  columns = 'auto-fit',
  minWidth = '300px',
  gap = '1rem',
  className = '',
  ...props 
}) => {
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: columns === 'auto-fit' 
      ? `repeat(auto-fit, minmax(${minWidth}, 1fr))`
      : columns === 'auto-fill'
      ? `repeat(auto-fill, minmax(${minWidth}, 1fr))`
      : columns,
    gap,
    width: '100%',
    ...props.style
  };

  return (
    <div 
      className={`responsive-grid ${className}`}
      style={gridStyle}
      {...props}
    >
      {children}
    </div>
  );
};

// Grid item component
const GridItem = ({ 
  children, 
  colSpan = 1, 
  rowSpan = 1,
  className = '',
  ...props 
}) => {
  const itemStyle = {
    gridColumn: colSpan > 1 ? `span ${colSpan}` : 'auto',
    gridRow: rowSpan > 1 ? `span ${rowSpan}` : 'auto',
    ...props.style
  };

  return (
    <div 
      className={`grid-item ${className}`}
      style={itemStyle}
      {...props}
    >
      {children}
    </div>
  );
};

// Pre-configured grid layouts
const CategoryGrid = ({ children, className = '', ...props }) => (
  <Grid 
    minWidth="280px"
    gap="1.5rem"
    className={`category-grid ${className}`}
    {...props}
  >
    {children}
  </Grid>
);

const BrandGrid = ({ children, className = '', ...props }) => (
  <Grid 
    minWidth="250px"
    gap="1rem"
    className={`brand-grid ${className}`}
    {...props}
  >
    {children}
  </Grid>
);

const SearchResultsGrid = ({ children, className = '', ...props }) => (
  <Grid 
    minWidth="320px"
    gap="1.25rem"
    className={`search-results-grid ${className}`}
    {...props}
  >
    {children}
  </Grid>
);

// Layout component for sidebar + content
const SidebarLayout = ({ 
  sidebar, 
  children, 
  sidebarWidth = '280px',
  gap = '2rem',
  className = '',
  collapsible = false,
  collapsed = false,
  onToggleCollapse
}) => {
  const layoutStyle = {
    display: 'grid',
    gridTemplateColumns: collapsed 
      ? '1fr' 
      : `${sidebarWidth} 1fr`,
    gap,
    alignItems: 'start'
  };

  return (
    <div className={`sidebar-layout ${className}`} style={layoutStyle}>
      {!collapsed && (
        <div className="sidebar-container">
          {collapsible && (
            <button 
              className="sidebar-toggle"
              onClick={onToggleCollapse}
              aria-label="Hide sidebar"
            >
              ←
            </button>
          )}
          {sidebar}
        </div>
      )}
      
      <div className="main-container">
        {collapsed && collapsible && (
          <button 
            className="sidebar-toggle collapsed"
            onClick={onToggleCollapse}
            aria-label="Show sidebar"
          >
            →
          </button>
        )}
        {children}
      </div>
    </div>
  );
};

// Responsive container with max-width
const Container = ({ 
  children, 
  maxWidth = '1200px',
  padding = '0 1rem',
  className = '',
  ...props 
}) => {
  const containerStyle = {
    maxWidth,
    margin: '0 auto',
    padding,
    width: '100%',
    ...props.style
  };

  return (
    <div 
      className={`container ${className}`}
      style={containerStyle}
      {...props}
    >
      {children}
    </div>
  );
};

// Responsive card component
const Card = ({ 
  children, 
  onClick,
  hover = true,
  className = '',
  ...props 
}) => {
  const cardClass = `
    card 
    ${hover ? 'card-hover' : ''} 
    ${onClick ? 'card-clickable' : ''} 
    ${className}
  `.trim();

  return (
    <div 
      className={cardClass}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e);
        }
      } : undefined}
      {...props}
    >
      {children}
    </div>
  );
};

// Responsive text component that adjusts based on screen size
const ResponsiveText = ({ 
  children, 
  as = 'p',
  desktop,
  tablet,
  mobile,
  className = '',
  ...props 
}) => {
  const Component = as;
  
  return (
    <Component 
      className={`responsive-text ${className}`}
      {...props}
    >
      <span className="desktop-text">{desktop || children}</span>
      <span className="tablet-text">{tablet || desktop || children}</span>
      <span className="mobile-text">{mobile || tablet || desktop || children}</span>
    </Component>
  );
};

// Export all components
export {
  Grid,
  GridItem,
  CategoryGrid,
  BrandGrid,
  SearchResultsGrid,
  SidebarLayout,
  Container,
  Card,
  ResponsiveText
};

export default Grid; 