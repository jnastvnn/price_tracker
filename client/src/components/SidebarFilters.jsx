import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SidebarFilters = ({ 
  categoryId,
  filters = {},
  onFiltersChange,
  className = ''
}) => {
  const [availableFilters, setAvailableFilters] = useState({
    brands: [],
    priceRanges: [],
    attributes: []
  });
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState({});

  useEffect(() => {
    if (categoryId) {
      fetchAvailableFilters();
    }
  }, [categoryId]);

  const fetchAvailableFilters = async () => {
    setLoading(true);
    try {
      // Fetch available filter options for this category
      const response = await axios.get(`/api/categories/${categoryId}/filters`);
      setAvailableFilters(response.data);
    } catch (error) {
      console.error('Error fetching filters:', error);
      // Fallback: basic filters without API data
      setAvailableFilters({
        brands: [],
        priceRanges: [
          { label: 'Under €50', min: 0, max: 50 },
          { label: '€50 - €100', min: 50, max: 100 },
          { label: '€100 - €250', min: 100, max: 250 },
          { label: '€250 - €500', min: 250, max: 500 },
          { label: '€500+', min: 500, max: null }
        ],
        attributes: []
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterType, filterKey, value, checked = null) => {
    const newFilters = { ...filters };

    if (filterType === 'brand') {
      if (!newFilters.brands) newFilters.brands = [];
      if (checked) {
        newFilters.brands = [...newFilters.brands, value];
      } else {
        newFilters.brands = newFilters.brands.filter(b => b !== value);
      }
    } else if (filterType === 'priceRange') {
      newFilters.priceRange = value;
    } else if (filterType === 'price') {
      newFilters[filterKey] = value;
    } else if (filterType === 'attribute') {
      if (!newFilters.attributes) newFilters.attributes = {};
      if (!newFilters.attributes[filterKey]) newFilters.attributes[filterKey] = [];
      
      if (checked) {
        newFilters.attributes[filterKey] = [...newFilters.attributes[filterKey], value];
      } else {
        newFilters.attributes[filterKey] = newFilters.attributes[filterKey].filter(v => v !== value);
      }
    }

    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const clearFilterGroup = (filterType) => {
    const newFilters = { ...filters };
    if (filterType === 'brands') {
      delete newFilters.brands;
    } else if (filterType === 'price') {
      delete newFilters.minPrice;
      delete newFilters.maxPrice;
      delete newFilters.priceRange;
    } else if (filterType === 'attributes') {
      delete newFilters.attributes;
    }
    onFiltersChange(newFilters);
  };

  const toggleSection = (section) => {
    setCollapsed(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const hasActiveFilters = () => {
    return Object.keys(filters).some(key => {
      const value = filters[key];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(v => Array.isArray(v) ? v.length > 0 : Boolean(v));
      }
      return Boolean(value);
    });
  };

  if (loading) {
    return (
      <aside className={`sidebar-filters loading ${className}`}>
        <div className="filters-loading">Loading filters...</div>
      </aside>
    );
  }

  return (
    <aside className={`sidebar-filters ${className}`}>
      <div className="filters-header">
        <h3>Filters</h3>
        {hasActiveFilters() && (
          <button 
            onClick={clearFilters}
            className="clear-all-btn"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Brand Filter */}
      {availableFilters.brands && availableFilters.brands.length > 0 && (
        <div className="filter-section">
          <div className="filter-section-header">
            <h4 onClick={() => toggleSection('brands')}>
              Brands
              <span className="toggle-icon">
                {collapsed.brands ? '+' : '-'}
              </span>
            </h4>
            {filters.brands && filters.brands.length > 0 && (
              <button 
                onClick={() => clearFilterGroup('brands')}
                className="clear-section-btn"
              >
                Clear
              </button>
            )}
          </div>
          
          {!collapsed.brands && (
            <div className="filter-options">
              {availableFilters.brands.slice(0, 10).map(brand => (
                <label key={brand.name} className="filter-option">
                  <input
                    type="checkbox"
                    checked={filters.brands?.includes(brand.name) || false}
                    onChange={(e) => handleFilterChange('brand', null, brand.name, e.target.checked)}
                  />
                  <span className="option-label">
                    {brand.name}
                    <span className="option-count">({brand.count})</span>
                  </span>
                </label>
              ))}
              
              {availableFilters.brands.length > 10 && (
                <button className="show-more-btn">
                  Show more brands...
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Price Filter */}
      <div className="filter-section">
        <div className="filter-section-header">
          <h4 onClick={() => toggleSection('price')}>
            Price Range
            <span className="toggle-icon">
              {collapsed.price ? '+' : '-'}
            </span>
          </h4>
          {(filters.minPrice || filters.maxPrice || filters.priceRange) && (
            <button 
              onClick={() => clearFilterGroup('price')}
              className="clear-section-btn"
            >
              Clear
            </button>
          )}
        </div>
        
        {!collapsed.price && (
          <div className="filter-options">
            {/* Quick price ranges */}
            {availableFilters.priceRanges.map((range, index) => (
              <label key={index} className="filter-option">
                <input
                  type="radio"
                  name="priceRange"
                  checked={filters.priceRange?.min === range.min && filters.priceRange?.max === range.max}
                  onChange={() => handleFilterChange('priceRange', null, range)}
                />
                <span className="option-label">{range.label}</span>
              </label>
            ))}
            
            {/* Custom price range */}
            <div className="custom-price-range">
              <h5>Custom Range</h5>
              <div className="price-inputs">
                <input
                  type="number"
                  placeholder="Min €"
                  value={filters.minPrice || ''}
                  onChange={(e) => handleFilterChange('price', 'minPrice', e.target.value)}
                />
                <span>-</span>
                <input
                  type="number"
                  placeholder="Max €"
                  value={filters.maxPrice || ''}
                  onChange={(e) => handleFilterChange('price', 'maxPrice', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Attribute Filters */}
      {availableFilters.attributes && availableFilters.attributes.map(attribute => (
        <div key={attribute.id} className="filter-section">
          <div className="filter-section-header">
            <h4 onClick={() => toggleSection(`attr_${attribute.id}`)}>
              {attribute.name}
              <span className="toggle-icon">
                {collapsed[`attr_${attribute.id}`] ? '+' : '-'}
              </span>
            </h4>
            {filters.attributes?.[attribute.id]?.length > 0 && (
              <button 
                onClick={() => {
                  const newFilters = { ...filters };
                  if (newFilters.attributes) {
                    delete newFilters.attributes[attribute.id];
                  }
                  onFiltersChange(newFilters);
                }}
                className="clear-section-btn"
              >
                Clear
              </button>
            )}
          </div>
          
          {!collapsed[`attr_${attribute.id}`] && (
            <div className="filter-options">
              {attribute.values.map(value => (
                <label key={value.value} className="filter-option">
                  <input
                    type="checkbox"
                    checked={filters.attributes?.[attribute.id]?.includes(value.value) || false}
                    onChange={(e) => handleFilterChange('attribute', attribute.id, value.value, e.target.checked)}
                  />
                  <span className="option-label">
                    {value.value}
                    <span className="option-count">({value.count})</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </aside>
  );
};

export default SidebarFilters; 