import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SearchBar } from './SearchBar';
import Breadcrumbs from './Breadcrumbs';
import ThemeToggle from './ThemeToggle';

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleSearch = (query) => {
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const isHomePage = location.pathname === '/';

  return (
    <div className="layout">
      {/* Main Header */}
      <header className="main-header">
        <div className="header-container">
          {/* Logo and Home Link */}
          <div className="header-brand">
            <Link to="/" className="brand-link">
              <h1 className="brand-title">Price Tracker</h1>
            </Link>
          </div>

          {/* Search Bar */}
          <div className="header-search">
            <SearchBar
              onSearch={handleSearch}
              placeholder="Search for brands, models, products..."
              className="header-search-bar"
            />
          </div>

          {/* Navigation Links */}
          <nav className="header-nav">
            <Link to="/" className="nav-link">
              Home
            </Link>
            <Link to="/categories" className="nav-link">
              Categories
            </Link>
            <Link to="/dashboard" className="nav-link">
              Dashboard
            </Link>
            <ThemeToggle className="nav-theme-toggle" />
          </nav>
        </div>
      </header>

      {/* Breadcrumbs (only show on non-home pages) */}
      {!isHomePage && (
        <div className="breadcrumbs-container">
          <Breadcrumbs />
        </div>
      )}

      {/* Main Content Area */}
      <main className="main-content">
        {children}
      </main>

      {/* Footer */}
      <footer className="main-footer">
        <div className="footer-container">
          <div className="footer-section">
            <h3>Price Tracker</h3>
            <p>Track and analyze marketplace prices</p>
          </div>
          <div className="footer-section">
            <h4>Quick Links</h4>
            <Link to="/">Home</Link>
            <Link to="/categories">Categories</Link>
          </div>
          <div className="footer-section">
            <h4>About</h4>
            <p>Built with React and Node.js</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout; 