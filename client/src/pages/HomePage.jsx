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
  { id: 25, name: 'Other Electronics', children: [] }
];

export const HomePage = () => {
  const navigate = useNavigate();
  const [hoveredCategory, setHoveredCategory] = useState(null);

  const handleSearch = (query) => {
    // TODO: implement search route/state if needed
  };

  const handleCategoryClick = (categoryId) => {
    navigate(`/category/${categoryId}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header>
      
        <nav className="flex justify-center items-center gap-2 py-4">
        <h1 className="font-['Open_Sans'] text-2xl font-bold mr-10">Price Tracker</h1>
          {categoriesWithChildren.map((category) => (
            <div
              key={category.id}
              className="relative font-['Open_Sans'] font-bold text-sm hover:bg-gray-200 hover:text-black rounded-md py-1 px-1"
              onMouseEnter={() => setHoveredCategory(category.id)}
              onMouseLeave={() => setHoveredCategory(null)}
            >
              <button onClick={() => handleCategoryClick(category.id)}>
                {category.name}
              </button>
              
              {hoveredCategory === category.id && category.children.length > 0 && (
                <div
                  className="absolute duration-300 top-full left-0 mt-0 z-10 bg-white divide-y divide-gray-100 rounded-sm shadow-sm w-44 "
                  onMouseEnter={() => setHoveredCategory(category.id)}
                  onMouseLeave={() => setHoveredCategory(null)}
                >
                  {category.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => handleCategoryClick(child.id)}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                    >
                      {child.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </header>
      
      <main className="flex-1 grid place-items-center px-8">
        <section className="w-full max-w-8xl grid place-items-center rounded-2xl md:p-80 shadow min-h-[80vh] overflow-hidden" style={{background: 'radial-gradient(ellipse at left top,rgb(91, 127, 120),rgb(65, 97, 162), #93c5fd)'}}>
        <div>
          <SearchBar 
            onSearch={handleSearch} 
            placeholder="Search for a product, brand, or model..." 
          />
        </div>
        </section>

      </main>
    </div>
  );
};