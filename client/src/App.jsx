import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { CategoryPage } from './pages/CategoryPage';
import { PriceHistoryPage } from './pages/PriceHistoryPage';

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/category/:categoryId" element={<CategoryPage />} />
        {/* Combine all price history routes into one for simplicity */}
        <Route path="/price-history/:model" element={<PriceHistoryPage />} />
      </Routes>
    </div>
  );
}

export default App;