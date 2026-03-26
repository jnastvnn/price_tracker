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
    const baseUrl = `/price-history/${encodeURIComponent(model)}`;
    const queryParams = new URLSearchParams();
    if (categoryId) queryParams.append('categoryId', categoryId);
    // signal that the param is a modelKey
    if (listing.model_key) queryParams.append('isKey', '1');
    const queryString = queryParams.toString();
    navigate(`${baseUrl}${queryString ? `?${queryString}` : ''}`);
  };

  return (
    <div
      className="app-panel p-4 transition-colors hover:bg-[var(--landing-hover)]"
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--landing-border)] pb-3">
        <div className="min-w-0">
          <div className="text-base md:text-lg font-semibold text-[var(--landing-text-strong)] break-words">
            {listing.model_key || listing.model}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.14em] app-muted">
            Model group
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs uppercase tracking-[0.14em] app-muted">Avg price</div>
          <div className="font-semibold text-lg text-[var(--landing-text-strong)] mt-1">
          {formatPrice(listing.average_price)}
          </div>
        </div>
      </div>

      <div className="pt-3 text-sm">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] app-muted">Listings</div>
          <div className="mt-1 text-[var(--landing-text-strong)]">
            {listing.listing_count} listing{listing.listing_count !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <button
        onClick={handleViewPriceHistory}
        aria-label="View price history"
        title="View price history"
        className="app-btn mt-4 w-full justify-between"
      >
        <span>Price History</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
};

export const CategoryListings = ({ categoryId, category }) => {
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

  const pageListingTotal = listings.reduce((sum, listing) => {
    const count = Number(listing.listing_count);
    return sum + (Number.isFinite(count) ? count : 0);
  }, 0);

  if (loading && listings.length === 0) {
    return <div className="app-loading">Loading listings...</div>;
  }

  if (error) {
    return (
      <div className="app-error">
        <div className="app-error-box">
        Error loading listings: {error}
        <button onClick={() => window.location.reload()} className="app-btn mt-4">
          Retry
        </button>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="app-panel p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.14em] app-muted">Catalog</div>
            <h2 className="mt-1 text-xl md:text-2xl font-semibold text-[var(--landing-text-strong)]">
              {category?.name ? `${category.name} models` : 'Category models'}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="app-chip">{listings.length} model group{listings.length !== 1 ? 's' : ''} on this page</span>
              <span className="app-chip">{pageListingTotal} listings represented</span>
              {pagination?.currentPage ? <span className="app-chip">Page {pagination.currentPage}</span> : null}
              {activeSearch ? <span className="app-chip">Search: “{activeSearch}”</span> : null}
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <input
              type="text"
              placeholder="Search model groups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="app-input w-full sm:min-w-80"
            />
            <div className="flex gap-2">
              <button type="submit" className="app-btn">
                Search
              </button>
              {activeSearch && (
                <button
                  type="button"
                  onClick={handleSearchReset}
                  className="app-btn"
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {listings.length === 0 ? (
        <div className="app-empty min-h-[14rem]">
          No listings found{activeSearch ? ' matching your filters.' : ' in this category.'}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard
                key={listing.model_key || listing.model}
                listing={listing}
                categoryId={categoryId}
              />
            ))}
          </div>

          {loading && <div className="text-center app-muted py-6">Loading more listings...</div>}

          {pagination && (pagination.hasPrevPage || pagination.hasNextPage) && (
            <div className="app-panel px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm app-muted">
                  {Number.isInteger(pagination.totalPages)
                    ? `Page ${pagination.currentPage} of ${pagination.totalPages}`
                    : `Page ${pagination.currentPage}`}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevPage}
                    className="app-btn disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className="app-btn disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
