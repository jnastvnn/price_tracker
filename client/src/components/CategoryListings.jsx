import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategoryListings } from '../hooks/useCategoryListings';
import { FilterSidebar } from './FilterSidebar';
import './CategoryListings.css';

const ListingCard = ({ listing, categoryId }) => {
  const navigate = useNavigate();
  
  const formatPrice = (price) => {
    if (!price) return 'Price not available';
    return `€${parseFloat(price).toFixed(2)}`;
  };

  const handleViewPriceHistory = () => {
    const model = listing.model;
    const brand = listing.brands?.split(',')[0]?.trim(); // Get first brand if multiple
    
    // Build base URL with only the model
    const baseUrl = `/price-history/${encodeURIComponent(model)}`;
    
    // Add brand and categoryId as query parameters
    const queryParams = new URLSearchParams();
    if (brand) {
      queryParams.append('brand', brand);
    }
    if (categoryId) {
      queryParams.append('categoryId', categoryId);
    }
    
    const queryString = queryParams.toString();
    navigate(`${baseUrl}${queryString ? `?${queryString}` : ''}`);
  };

  return (
    <div className="listing-card">
      <div className="listing-content">
        <div className="listing-model">{listing.model}</div>
        <div className="listing-brands">{listing.brands || 'Unknown Brand'}</div>
        <div className="listing-count">
          {listing.listing_count} listing{listing.listing_count !== 1 ? 's' : ''}
        </div>
      </div>
      
      <div className="listing-price">
        {formatPrice(listing.average_price)}
      </div>
      
      <button 
        className="price-history-btn"
        onClick={handleViewPriceHistory}
        title="View price history"
      >
        📊 Price History
      </button>
    </div>
  );
};

const Pagination = ({ pagination, onPageChange }) => {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { currentPage, totalPages, hasPrevPage, hasNextPage } = pagination;

  return (
    <div className="pagination">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!hasPrevPage}
        className="pagination-btn"
      >
        Previous
      </button>
      
      <span className="pagination-info">
        Page {currentPage} of {totalPages}
      </span>
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNextPage}
        className="pagination-btn"
      >
        Next
      </button>
    </div>
  );
};

export const CategoryListings = ({ categoryId }) => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ brands: [] });

  const { listings, loading, error, pagination } = useCategoryListings(categoryId, {
    page: currentPage,
    limit: 12,
    search: activeSearch,
    brands: appliedFilters.brands
  });

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setActiveSearch(searchTerm);
    setCurrentPage(1);
  };

  const handleSearchReset = () => {
    setSearchTerm('');
    setActiveSearch('');
    setCurrentPage(1);
  };

  const handleFiltersApply = (filters) => {
    setAppliedFilters(filters);
    setCurrentPage(1);
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  if (loading && listings.length === 0) {
    return <div className="loading">Loading listings...</div>;
  }

  if (error) {
    return (
      <div className="error">
        Error loading listings: {error}
        <button onClick={() => window.location.reload()} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="category-listings">
      <FilterSidebar 
        categoryId={categoryId}
        onFiltersApply={handleFiltersApply}
        appliedFilters={appliedFilters}
      />

      <div className="main-content">
        <div className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <button 
              onClick={handleGoBack}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ← Back
            </button>
            <h2 style={{ margin: 0 }}>Listings in this Category</h2>
          </div>
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Search listings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="search-btn">Search</button>
            {activeSearch && (
              <button type="button" onClick={handleSearchReset} className="clear-btn">
                Clear
              </button>
            )}
          </form>
        </div>

        {(activeSearch || appliedFilters.brands.length > 0) && (
          <div className="active-filters">
            <strong>Active filters:</strong>
            {activeSearch && <span>Search: "{activeSearch}"</span>}
            {appliedFilters.brands.map(brand => (
              <span key={brand}>Brand: {brand}</span>
            ))}
          </div>
        )}

        {pagination && (
          <div className="results-count">
            Showing {listings.length} of {pagination.totalItems} grouped listings
          </div>
        )}

        {listings.length === 0 ? (
          <div className="no-results">
            {activeSearch || appliedFilters.brands.length > 0 ? 
              'No listings found matching your filters.' :
              'No listings found in this category.'
            }
          </div>
        ) : (
          <>
            <div className="listings-grid">
              {listings.map((listing, index) => (
                <ListingCard 
                  key={`${listing.model}-${index}`} 
                  listing={listing} 
                  categoryId={categoryId}
                />
              ))}
            </div>

            {loading && <div className="loading-more">Loading more listings...</div>}

            <Pagination 
              pagination={pagination} 
              onPageChange={handlePageChange} 
            />
          </>
        )}
      </div>
    </div>
  );
}; 