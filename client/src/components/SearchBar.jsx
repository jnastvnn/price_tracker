import React, { useState } from 'react';

export const SearchBar = ({
  onSearch,
  placeholder = 'Search...',
  className = '',
}) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="landing-search-shell">
        <input 
          type='text' 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder} 
          className="landing-square-input min-w-0 flex-1 border-0 bg-transparent text-sm shadow-none focus:shadow-none" 
        />
        <button 
          type='submit'
          className="landing-square-btn-primary landing-search-submit shrink-0 px-4"
          disabled={!query.trim()}
          aria-label="Submit search"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>
    </form>
  );
}; 
