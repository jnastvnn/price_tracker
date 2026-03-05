import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { CategoryPage } from './pages/CategoryPage';
import { PriceHistoryPage } from './pages/PriceHistoryPage';
import { BrandPage } from './pages/BrandPage';

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/category/:categoryId" element={<CategoryPage />} />
        {/* Combine all price history routes into one for simplicity */}
        <Route path="/price-history/:model" element={<PriceHistoryPage />} />
        <Route path="/brand/:brandName" element={<BrandPage />} />
      </Routes>
    </div>
  );
}

export default App;