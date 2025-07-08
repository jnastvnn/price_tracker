import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';

// Categories with their children from the database
const categoriesWithChildren = [
  {
    id: 2,
    name: 'Small Home Appliances',
    children: [
      { id: 3, name: 'Coffee Makers' },
      { id: 4, name: 'Toasters' },
      { id: 5, name: 'Food Processors & Mixers' },
      { id: 7, name: 'Vacuum Cleaners' },
      { id: 8, name: 'Hand Blenders' },
      { id: 10, name: 'Blenders' },
      { id: 11, name: 'Kettles' },
    ]
  },
  {
    id: 13,
    name: 'Home Appliances',
    children: [
      { id: 14, name: 'Dishwashers' },
      { id: 15, name: 'Refrigerators' },
      { id: 17, name: 'Dryers' },
      { id: 18, name: 'Stoves' },
      { id: 20, name: 'Microwave Ovens' },
      { id: 22, name: 'Freezers' },
      { id: 23, name: 'Washing Machines' },
      { id: 24, name: 'Ovens' },
    ]
  },
  {
    id: 26,
    name: 'Phones',
    children: [
      { id: 27, name: 'Mobile Phones' },
      { id: 28, name: 'Other Phones' },
      { id: 29, name: 'Phone Accessories' },
    ]
  },
  {
    id: 31,
    name: 'Information Technology',
    children: [
      { id: 32, name: 'Laptops' },
      { id: 33, name: 'Hard Drives & Storage' },
      { id: 35, name: 'Monitors' },
      { id: 36, name: 'Peripherals' },
      { id: 38, name: 'Desktop Computers' },
      { id: 39, name: 'Tablets & E-readers' },
      { id: 40, name: 'Computer Components' },
    ]
  },
  {
    id: 42,
    name: 'Photography & Video',
    children: [
      { id: 43, name: 'Hybrid Cameras' },
      { id: 44, name: 'System Cameras' },
      { id: 46, name: 'Compact Cameras' },
      { id: 48, name: 'Lenses' },
      { id: 49, name: 'Camcorders' },
    ]
  },
  {
    id: 50,
    name: 'Games & Consoles',
    children: [
      { id: 51, name: 'Merchandise' },
      { id: 52, name: 'Game Consoles' },
      { id: 53, name: 'Games' },
    ]
  },
  {
    id: 54,
    name: 'Audio & Video',
    children: [
      { id: 58, name: 'Speakers' },
      { id: 60, name: 'Headphones' },
      { id: 66, name: 'TV' },
      { id: 67, name: 'Amplifiers & Receivers' },
      { id: 69, name: 'Projectors & Screens' },
    ]
  },
  // Categories without children or with fewer children
  { id: 25, name: 'Other Electronics', children: [] },
  { id: 30, name: 'Health & Well-being', children: [] },
  { id: 71, name: 'Watches', children: [] },
];

export const HomePage = () => {
  const navigate = useNavigate();
  const [hoveredCategory, setHoveredCategory] = useState(null);

  const handleSearch = (query) => {
    console.log('Searching for:', query);
  };

  const handleCategoryClick = (categoryId) => {
    navigate(`/category/${categoryId}`);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          font-family: 'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        }
      `}</style>
      <div className="home-page" style={{ margin: 0, padding: 0 }}>
        <header style={{
          backgroundColor: '#000000',
          borderBottom: '1px solid #ddd',
          fontSize: '1.0rem', // Increase base font size for header
          width: '100vw',
          position: 'relative',
          left: '50%',
          right: '50%',
          marginLeft: '-50vw',
          marginRight: '-50vw',
          boxSizing: 'border-box',
          marginTop: 0,
          top: 0,
          paddingTop: 0,
          zIndex: 100,
          fontFamily: "'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        }}>
          {/* Single header bar with everything */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            minHeight: '54px',
            maxWidth: '1440px',
            margin: '0 auto',
            width: '100%',
            padding: '0.5rem 1.5rem',
            boxSizing: 'border-box',
            fontFamily: "'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
          }}>
            {/* Logo */}
            <h1 style={{ marginLeft: -2, marginRight: '2rem', marginTop: 0, marginBottom: 0, fontSize: '1.45rem', minWidth: 'fit-content', letterSpacing: '-0.5px', color: '#fff', fontWeight: 700, fontFamily: "'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }}>Price Tracker</h1>
            
            {/* Category navigation */}
            <nav style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '0.7rem', // Reduce gap
              flex: '1',
              justifyContent: 'center',
              position: 'relative',
              fontSize: '1.08em', // Larger nav font
              color: '#fff',
            }}>
              {categoriesWithChildren.map((category) => (
                <div
                  key={category.id}
                  style={{ position: 'relative' }}
                  onMouseEnter={() => setHoveredCategory(category.id)}
                  onMouseLeave={() => setHoveredCategory(null)}
                >
                  <button
                    onClick={() => handleCategoryClick(category.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '0.35rem 0.15rem', // Reduce padding
                      fontSize: '1em', // Larger
                      color: '#fff',
                      cursor: 'pointer',
                      textDecoration: 'none',
                      borderBottom: '2px solid transparent',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap',
                      minWidth: 'unset',
                      maxWidth: '160px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.color = '#ffd700';
                      e.target.style.borderBottomColor = '#ffd700';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.color = '#fff';
                      e.target.style.borderBottomColor = 'transparent';
                    }}
                  >
                    {category.name}
                  </button>
                  
                  {/* Dropdown menu for children */}
                  {hoveredCategory === category.id && category.children.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#222',
                      border: '1px solid #333',
                      borderRadius: '4px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.18)',
                      zIndex: 1000,
                      minWidth: '170px',
                      marginTop: '2px',
                      fontSize: '1em', // Larger dropdown font
                    }}>
                      {category.children.map((child, index) => (
                        <button
                          key={child.id}
                          onClick={() => handleCategoryClick(child.id)}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '0.55rem 0.9rem', // Reduce padding
                            border: 'none',
                            background: 'none',
                            textAlign: 'left',
                            fontSize: '1em',
                            color: '#fff',
                            cursor: 'pointer',
                            borderBottom: index < category.children.length - 1 ? '1px solid #333' : 'none',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#333';
                            e.target.style.color = '#ffd700';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = 'transparent';
                            e.target.style.color = '#fff';
                          }}
                        >
                          {child.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* Right side navigation */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.7rem', // Reduce gap
              minWidth: 'fit-content',
              fontSize: '1em', // Larger font
            }}>
              {/* Add any right-side links here, ensure white color if added */}
            </div>
          </div>
        </header>
        
        <main style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: 'calc(100vh - 70px)', // Reduce header height
          padding: '1.5rem' // Reduce padding
        }}>
          <div style={{ textAlign: 'center', maxWidth: '600px' }}>
            <h2 style={{ marginBottom: '1.2rem', color: '#333', fontSize: '1.15rem', fontWeight: 500 }}>
              Find the best prices across categories
            </h2>
            <SearchBar 
              onSearch={handleSearch} 
              placeholder="Search for a product, brand, or model..." 
            />
          </div>
        </main>
      </div>
    </>
  );
};