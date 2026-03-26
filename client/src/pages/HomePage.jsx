import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';
import { useTheme } from '../contexts/ThemeContext';

const asciiArt = String.raw`
                                                                                                                                                          
                                                                                                                                                          
                                                                                                                                                          
                                                                                                                                                          
                                                                                                                                                          
                                                                                                                                                          
                                                                                   @@@@                                                                   
                                                                               :@@@@@@@@@                                                                 
                                                                            *@@@@@@+ -@@@                                                                 
                                                                         @@@@@@@-  @@@@@@                                                                 
                                                                      @@@@@@@   @@@@@@@@@                                                                 
                                                                  *@@@@@@#   @@@@@@@@@@@@                                                                 
                                                               @@@@@@@+  :@@@@@@@@@  @@@@                                                                 
                                                            @@@@@@@:  @@@@@@@@@%     @@@@                                                                 
                                                        -@@@@@@@   @@@@@@@@@+        @@@@                                                                 
                                                     %@@@@@@@   @@@@@@@@@            @@@@                                                                 
                                                  @@@@@@@-  +@@@@@@@@@               @@@@                                                                 
                                               @@@@@@@   @@@@@@@@@@                  @@@@                                                                 
                                           :@@@@@@@   @@@@@@@@@=                     @@@@                                                                 
                                        @@@@@@@@   @@@@@@@@@                         @@@@                                                                 
                                     @@@@@@@%  =@@@@@@@@@                            @@@@                                                                 
                                  @@@@@@@   @@@@@@@@@#                               @@@@                                                                 
                              =@@@@@@@   @@@@@@@@@-                                  @@@@                                                                 
                           @@@@@@@%  -@@@@@@@@@                                      @@@@                                                                 
                        @@@@@@@   @@@@@@@@@@                                         @@@@                                                                 
                     @@@@@@@   @@@@@@@@@%                                            @@@@                                                                 
                  @@@@@@@   @@@@@@@@@                                                @@@@                                                                 
                  @@@  #@@@@@@@@@@                                                   @@@@                                                                 
                  @@@   %@@@@@@                                                      @@@@                                                                 
                  @@@   @@@@@                                                        @@@@                                                                 
                  @@@   %@@@@                                                        @@@@                                                                 
                  @@@   @@@@@                                                        @@@@                                                                 
                  @@@   @@@@@                                                        @@@@                                                                 
                  @@@   @@@@@                                                        @@@@                                                                 
                  @@@   @@@@@                                                        @@@@                                                                 
                  @@@   %@@@@                                                        @@@@                                                                 
                  @@@   %@@@@                                                        @@@@                                                                 
                  @@@   %@@@@                                                      @@@@@@*                                                                
                  @@@   %@@@@                                                   @@@@@@@@@@@#                                                              
                  @@@   %@@@@                                               *@@@@@@@@@@@@@@@@@%                                                           
                  @@@   %@@@@                                            %@@@@@@@@@@@@@@@@@@@@@@@@                                                        
                  @@@   %@@@@                                         @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@:                                                    
                  @@@   %@@@@                                      @@@@@@@@@@@@@@@@@*     :@@@@@@@@@@@@@#                                                 
                  @@@   %@@@@                                  +@@@@@@@@@@@@@@@@@  @-     %+  @@@@@@@@@@@@@@                                              
                  @@@   %@@@@                               %@@@@@@@@@@@@@@@@@        @@.        @@@@@@@@@@@@@@                                           
                  @@@   %@@@@                            @@@@@@@@@@@@@@@@@#    @    @    .@  :@     *@@@@@@@@@@@@@.                                       
                  @@@   %@@@@                        .@@@@@@@@@@@@@@@@@@@       #*@+      -% @      =% .@@@@@@@@@@@@@=                                    
                  @@@   %@@@@                     +@@@@@@@@@@@@@@@@@       @-@.      =@@=       @@@        @@@@@@@@@@@@@*                                 
                  @@@   %@@@@                  @@@@@@@@@@@@@@@@@%  %+     @   @.    @    @    @.   +#   @.    @@@@@@@@@@@@@@                              
                  @@@   %@@@@               @@@@@@@@@@@@@@@@@@        %@        @@%       :@@.       @=@       @ +@@@@@@@@@@@@@                           
                  @@@   %@@@@           :@@@@@@@@@@@@@@@@@.    @   %.     @  #+     :@ =*      #@+@       @#@       .@@@@@@@@@@@@@=                       
                  @@@   %@@@@        +@@@@@@@@@@@@@@@@@-@       @ #+      @  @.     @:  @     #=  =@    +#   +=   =@@@@@@@@@@@@@@@@@@%                    
                  @@@   %@@@@     @@@@@@@@@@@@@@@@@@       @-@       @@@        @@        =@@        @@.       @@@@@@@@@@@@@@@@@@@@@@@@@@                 
                  @@@   %@@@@  @@@@@@@@@@@@@@@@@*  =%    *#   @    -%    @   .%    -@   @     ##  @      @  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@               
                  @@@   @@@@@@@@@@@@@@@@@@@@@@        @@        @@@       @%@-      @=-@      -* .@     .@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@                  
                  @@@   @@@@@@@@@@@@@@@@@@     #+  @      @. @       @ @       +@@        @@+       @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+     +               
                  @@@   @@@@@@@@@@@@@@*=@      =# #@     .%  #*     @   @     @    @    @    +*   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@-     =@@@               
                  @@@@  %@@@@@@@@@@        @@#       @@@        @@        @@@       =%@        @@@@@@@ :@@@@@@@@@@@@@@@@@@@@@@      %@@@@@*               
                  @@@@@@ @@@@@@@@@@@@    @    %:   @     @   @      @  #*     :@ *#      @-%@@@@@@#        @@@@@@@@@@@@@@@%      @@@@@@@@                 
                  @@@@@@    %@@@@@@@@@@@       :@%@       @ #*      @  @-     @-  @     %@@@@@@.              #@@@@@@@@=      @@@@@@@@                    
                   =@@@@@      +@@@@@@@@@@@+**       @@@       @@@        @@        +@@@@@@@                 *@@@@@@      -@@@@@@@#                       
                     @@@@@@@+      @@@@@@@@@@@#    @:   @.   +*    @   -#     @   @@@@@@@                 @@@@@@@      @@@@@@@@-                          
                     @@@@@@@@@@@      @@@@@@@@@@@@        @@@       @%@=      #@@@@@@@                 @@@@@@%      @@@@@@@@                              
                       %@@@@@@@@@@@      @@@@@@@@@@@@ .@      :@.@       #@@@@@@@@@@@@@            :@@@@@@=      @@@@@@@@                                 
                          -@@@@@@@@@@@.     #@@@@@@@@@@@:    *%   @     @@@@@@@@@@@@@@@@@@      @@@@@@@      -@@@@@@@#                                    
                              @@@@@@@@@@@@      @@@@@@@@@@@@        @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@      @@@@@@@@                                        
                                 @@@@@@@@@@@@      @@@@@@@@@@@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%      @@@@@@@@                                           
                                    :@@@@@@@@@@@      %@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*      @@@@@@@@                                              
                                        @@@@@@@@@@@:     -@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@      =@@@@@@@@                                                 
                                           @@@@@@@@@@@@      @@@@@@@@@@@@@@@@@@@@@@@@@@      @@@@@@@@                                                     
                                              %@@@@@@@@@@@      @@@@@@@@@@@@@@@@@@@%      @@@@@@@@                                                        
                                                  @@@@@@@@@@@      @@@@@@@@@@@@@.     .@@@@@@@@                                                           
                                                     @@@@@@@@@@@#     .@@@@@@      @@@@@@@@*                                                              
                                                        %@@@@@@@@@@@            @@@@@@@@.                                                                 
                                                           :@@@@@@@@@@@      @@@@@@@@                                                                     
                                                               @@@@@@@@@@@@@@@@@@@                                                                        
                                                                  @@@@@@@@@@@@:                                                                           
                                                                     +@@@@@                                                                               
                                                                                                                                                          
                                                                                                                                                          
                                                                                                                                                          
`;

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
  { id: 25, name: 'Other Electronics', children: [] }
];

export const HomePage = () => {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [activeCategoryId, setActiveCategoryId] = useState(null);

  const handleSearch = () => {
    // TODO: implement search route/state if needed
  };

  const handleCategoryClick = (categoryId) => {
    navigate(`/category/${categoryId}`);
  };

  const activeCategory = categoriesWithChildren.find((category) => category.id === activeCategoryId) || null;
  const expandedDesktopColumns = 4;
  const expandedCellCount = activeCategory ? activeCategory.children.length + 1 : 0;
  const expandedFillerCount = expandedCellCount
    ? (expandedDesktopColumns - (expandedCellCount % expandedDesktopColumns)) % expandedDesktopColumns
    : 0;

  const handleCategorySelect = (category) => {
    if (category.children.length === 0) {
      setActiveCategoryId(null);
      handleCategoryClick(category.id);
      return;
    }

    setActiveCategoryId((current) => (current === category.id ? null : category.id));
  };

  return (
    <div className="landing-shell">
      <div className="landing-container">
        <header className="mt-4 md:mt-5">
          <div className="landing-panel landing-panel-open-sides landing-panel-no-top">
            <div className="landing-cell px-5 py-4 md:px-6 md:py-5">
              <div className="flex items-start justify-between gap-4">
                <h1 className="landing-wordmark">Price Tracker</h1>
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
                  className="landing-theme-toggle"
                >
                  <span className="landing-theme-toggle-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="4.5" />
                      <path d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1 5.3 5.3" />
                    </svg>
                  </span>
                  <span>{isDark ? 'Light' : 'Dark'}</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="pb-10">
          <section className="landing-panel landing-panel-open-sides landing-panel-no-top landing-table">
            <div className="landing-cell flex min-h-[220px] items-center justify-between gap-6 px-5 py-8 md:min-h-[250px] md:px-6 md:py-10">
              <div className="space-y-2 md:space-y-3">
                <h2 className="max-w-4xl text-4xl font-extrabold leading-none tracking-[-0.05em] text-[var(--landing-text-strong)] md:text-5xl">
                  Explore prices, categories, and product trends through a structured index.
                </h2>
              </div>
              <div className="landing-ascii-wrap hidden lg:flex lg:justify-end">
                <pre className="landing-ascii-large" aria-hidden="true">{asciiArt}</pre>
              </div>
            </div>
          </section>

          <section className="landing-panel landing-panel-open-sides landing-panel-no-top landing-table overflow-visible">
            <div className="grid gap-px bg-[var(--landing-border)] sm:grid-cols-2 xl:grid-cols-4">
              <div className="landing-cell px-5 py-4 md:px-6 md:py-4 sm:col-span-2 xl:col-span-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
                  <p className="max-w-sm text-sm text-[var(--landing-muted)]">
                    Search products, brands, or models directly from the table.
                  </p>
                  <div className="w-full max-w-3xl">
                    <SearchBar
                      onSearch={handleSearch}
                      placeholder=""
                    />
                  </div>
                </div>
              </div>

              <div className="landing-cell px-5 py-3 md:px-6 md:py-3 sm:col-span-2 xl:col-span-4">
                <div className="landing-label text-[var(--landing-text-strong)]">Categories</div>
              </div>

              {categoriesWithChildren.map((category) => {
                const isActive = activeCategoryId === category.id;
                return (
                  <div key={category.id}>
                    <button
                      onClick={() => handleCategorySelect(category)}
                      aria-expanded={isActive}
                      className={`landing-cell flex h-full min-h-[88px] w-full items-center justify-between gap-3 px-5 py-4 text-left md:px-6 ${
                        isActive ? 'landing-cell-selected' : 'landing-cell-hover landing-cell-strong'
                      }`}
                    >
                      <span className="font-semibold text-[var(--landing-text-strong)]">{category.name}</span>
                      <span className="text-sm text-[var(--landing-muted)]">
                        {category.children.length ? `${category.children.length} items` : 'Open'}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>

            {activeCategory ? (
              <div className="border-t border-[var(--landing-border)]">
                <div className="grid gap-px bg-[var(--landing-border)] sm:grid-cols-2 xl:grid-cols-4">
                  <div className="landing-cell px-5 py-5 md:px-6">
                    <div className="landing-label">Selected category</div>
                    <h2 className="mt-3 text-2xl font-extrabold tracking-[-0.04em] text-[var(--landing-text-strong)]">
                      {activeCategory.name}
                    </h2>
                    <button
                      onClick={() => handleCategoryClick(activeCategory.id)}
                      className="landing-square-btn mt-4 w-full justify-between"
                    >
                      <span>Open category</span>
                      <span>{String(activeCategory.id).padStart(2, '0')}</span>
                    </button>
                  </div>

                  {activeCategory.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => handleCategoryClick(child.id)}
                      className="landing-cell landing-cell-hover flex min-h-[88px] items-center justify-between gap-3 px-5 py-4 text-left md:px-6"
                    >
                      <span className="font-semibold text-[var(--landing-text-strong)]">{child.name}</span>
                      <span className="text-sm text-[var(--landing-muted)]">Open</span>
                    </button>
                  ))}

                  {Array.from({ length: expandedFillerCount }).map((_, index) => (
                    <div
                      key={`filler-${index}`}
                      aria-hidden="true"
                      className="landing-cell min-h-[88px] px-5 py-4 md:px-6"
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <footer className="landing-panel landing-panel-open-sides landing-panel-no-top landing-table">
            <div className="grid gap-px bg-[var(--landing-border)] sm:grid-cols-2 xl:grid-cols-4">
              <div className="landing-cell px-5 py-3 md:px-6 md:py-4">
                <div className="landing-label">Coverage</div>
                <div className="mt-2 text-sm text-[var(--landing-muted)]">Consumer electronics index</div>
              </div>
              <div className="landing-cell px-5 py-3 md:px-6 md:py-4">
                <div className="landing-label">Method</div>
                <div className="mt-2 text-sm text-[var(--landing-muted)]">Search, compare, inspect</div>
              </div>
              <div className="landing-cell px-5 py-3 md:px-6 md:py-4">
                <div className="landing-label">Structure</div>
                <div className="mt-2 text-sm text-[var(--landing-muted)]">Categories, brands, price history</div>
              </div>
              <div className="landing-cell px-5 py-3 md:px-6 md:py-4">
                <div className="landing-label">Index</div>
                <div className="mt-2 text-sm text-[var(--landing-muted)]">Price Tracker</div>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};
