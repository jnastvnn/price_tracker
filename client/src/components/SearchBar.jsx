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
      <div className="bg-white flex items-center gap-2 px-1 py-1 rounded-lg border border-gray-300 w-full mx-auto">
        <input 
          type='text' 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder} 
          className="flex-1 min-w-70 outline-none bg-white pl-4 text-sm" 
        />
        <button 
          type='submit'
          className="shrink-0 bg-blue-600 hover:bg-blue-700 transition-all text-white rounded-md px-3 py-2.5 flex items-center justify-center"
          disabled={!query.trim()}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>
    </form>
  );
}; 