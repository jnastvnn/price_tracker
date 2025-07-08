import React, { useState, useEffect } from 'react';

export const SearchBar = ({
  onSearch,
  placeholder = 'Search...',
  className = '',
  debounceMs = 300,
}) => {
  const [query, setQuery] = useState('');


  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query);

    

  };

  return (
    <div className={`search-bar ${className}`}>
      <form onSubmit={handleSubmit} className="search-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="search-input"
        />
        <button type="submit">Search</button>
      </form>
    </div>
  );
}; 