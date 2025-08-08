import React, { useState, useEffect } from 'react';
import { useBrands } from '../hooks/useBrands';

export const FilterSidebar = ({ categoryId, onFiltersApply, appliedFilters }) => {
  const [selectedBrands, setSelectedBrands] = useState(appliedFilters.brands || []);
  
  // Use the existing useBrands hook
  const { brands, loading, error } = useBrands({ id: categoryId });

  // Update selected brands when applied filters change
  useEffect(() => {
    setSelectedBrands(appliedFilters.brands || []);
  }, [appliedFilters.brands]);

  const handleBrandToggle = (brand) => {
    setSelectedBrands(prev => {
      if (prev.includes(brand)) {
        return prev.filter(b => b !== brand);
      } else {
        return [...prev, brand];
      }
    });
  };

  const handleApplyFilters = () => {
    onFiltersApply({
      brands: selectedBrands
    });
  };

  const handleClearFilters = () => {
    setSelectedBrands([]);
    onFiltersApply({
      brands: []
    });
  };

  const hasChanges = JSON.stringify(selectedBrands.sort()) !== JSON.stringify((appliedFilters.brands || []).sort());

  return (
    <div style={{
      position: 'fixed',
      left: 0,
      top: 0,
      width: '300px',
      height: '100vh',
      backgroundColor: '#f8f8f8',
      borderRight: '1px solid #ddd',
      padding: '20px',
      overflowY: 'auto'
    }}>
      <h3 style={{ margin: '0 0 16px 0' }}>Filters</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Brands</h4>
        
        {loading && <div style={{ padding: '12px' }}>Loading brands...</div>}
        
        {error && (
          <div style={{ padding: '12px', color: 'red', backgroundColor: '#ffe6e6', border: '1px solid #ffcccc' }}>
            {error}
          </div>
        )}
        
        {!loading && !error && (!brands || brands.length === 0) && (
          <div style={{ padding: '12px', color: '#666', fontStyle: 'italic' }}>
            No brands available
          </div>
        )}
        
        {!loading && !error && brands && brands.length > 0 && (
          <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', padding: '8px' }}>
            {brands.map(brand => (
              <label key={brand.brand} style={{ display: 'block', padding: '4px 0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(brand.brand)}
                  onChange={() => handleBrandToggle(brand.brand)}
                  style={{ marginRight: '8px' }}
                />
                {brand.brand} ({brand.listing_count})
              </label>
            ))}
          </div>
        )}
      </div>
      
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleApplyFilters}
          disabled={!hasChanges}
          style={{
            flex: 1,
            padding: '8px 12px',
            backgroundColor: hasChanges ? '#007bff' : '#ccc',
            color: 'white',
            border: 'none',
            cursor: hasChanges ? 'pointer' : 'not-allowed'
          }}
        >
          Apply
        </button>
        
        <button
          onClick={handleClearFilters}
          disabled={selectedBrands.length === 0}
          style={{
            padding: '8px 12px',
            backgroundColor: 'white',
            color: selectedBrands.length > 0 ? '#dc3545' : '#ccc',
            border: `1px solid ${selectedBrands.length > 0 ? '#dc3545' : '#ccc'}`,
            cursor: selectedBrands.length > 0 ? 'pointer' : 'not-allowed'
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}; 