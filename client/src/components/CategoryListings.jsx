import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategoryListings } from '../hooks/useCategoryListings';


const priceFormatter = new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' });

const ListingCard = ({ listing, categoryId }) => {
  const navigate = useNavigate();
  
  const formatPrice = (price) => {
    if (price === null || price === undefined) return 'Price not available';
    const numeric = Number(price);
    if (Number.isNaN(numeric)) return 'Price not available';
    return priceFormatter.format(numeric);
  };

  const handleViewPriceHistory = () => {
    const model = listing.model_key || listing.model;
    const brand = listing.brands?.split(',')[0]?.trim();
    const baseUrl = `/price-history/${encodeURIComponent(model)}`;
    const queryParams = new URLSearchParams();
    if (brand) queryParams.append('brand', brand);
    if (categoryId) queryParams.append('categoryId', categoryId);
    // signal that the param is a modelKey
    if (listing.model_key) queryParams.append('isKey', '1');
    const queryString = queryParams.toString();
    navigate(`${baseUrl}${queryString ? `?${queryString}` : ''}`);
  };

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-gray-900">{listing.model_key || listing.model}</div>
          <div className="text-sm text-gray-600">{listing.brands || 'Unknown Brand'}</div>
          <div className="text-sm text-gray-500 mt-1">
            {listing.listing_count} listing{listing.listing_count !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="text-green-600 font-semibold text-lg">
          {formatPrice(listing.average_price)}
        </div>
      </div>

      <button
        onClick={handleViewPriceHistory}
        aria-label="View price history"
        title="View price history"
        className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        <span>📊 Price History</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
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
  // Minimal: no sidebar filters

  const { listings, loading, error, pagination } = useCategoryListings(categoryId, {
    page: currentPage,
    limit: 12,
    search: activeSearch,
    // Minimal: no brand filters
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

  // Minimal: no filters

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
    <div className="min-h-screen">
      <main className="max-w-7xl mx-auto px-4 py-10">
        <section className="bg-blue-50 backdrop-blur-sm border border-white/40 rounded-2xl shadow-md p-6 md:p-10">

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={handleGoBack}
                aria-label="Go back"
                className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700"
              >
                ← Back
              </button>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                Listings in this Category
              </h2>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                placeholder="Search listings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-80 px-4 py-2 border-2 border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
              <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">
                Search
              </button>
              {activeSearch && (
                <button
                  type="button"
                  onClick={handleSearchReset}
                  className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700"
                >
                  Clear
                </button>
              )}
            </form>
          </div>

          {activeSearch && (
            <div className="mb-4 flex items-center gap-2 text-sm">
              <span className="text-gray-500">Active:</span>
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700">Search: “{activeSearch}”</span>
            </div>
          )}

          {pagination && (
            <div className="mb-4 text-sm text-gray-600">
              {Number.isInteger(pagination.totalItems)
                ? `Showing ${listings.length} of ${pagination.totalItems} grouped listings`
                : `Showing ${listings.length} grouped listings`}
            </div>
          )}

          {listings.length === 0 ? (
            <div className="text-center text-gray-600 py-16">No listings found{activeSearch ? ' matching your filters.' : ' in this category.'}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((listing) => (
                  <ListingCard
                    key={`${listing.model_key || listing.model}|${listing.brands || 'unknown'}`}
                    listing={listing}
                    categoryId={categoryId}
                  />
                ))}
              </div>

              {loading && <div className="text-center text-gray-500 py-6">Loading more listings...</div>}

              {pagination && (pagination.hasPrevPage || pagination.hasNextPage) && (
                <div className="mt-8 flex items-center justify-center gap-3">
                  <button
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevPage}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    {Number.isInteger(pagination.totalPages)
                      ? `Page ${pagination.currentPage} of ${pagination.totalPages}`
                      : `Page ${pagination.currentPage}`}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}; 
