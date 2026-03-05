import Category from '../models/Category.js';
import AppError from '../utils/AppError.js';
import ResponseFormatter from '../utils/ResponseFormatter.js';

const CategoryController = {
  // GET /api/categories
  async listLevel1(req, res) {
    const categories = await Category.findByLevel(1);
    const displayCategories = categories.map(cat => cat.toDisplayFormat());
    return ResponseFormatter.success(res, displayCategories);
  },

  // GET /api/categories/:id
  async getOne(req, res) {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      throw new AppError(404, 'Category not found');
    }
    
    // Enrich with breadcrumbs
    category.breadcrumbs = await Category.findCategoryPath(id);
    return ResponseFormatter.success(res, category.toDisplayFormat());
  },

  // GET /api/categories/:id/subcategories
  async subcategories(req, res) {
    const { id } = req.params;
    const categories = await Category.findChildren(id);
    const displayCategories = categories
      .filter(cat => cat.is_active)
      .map(cat => cat.toDisplayFormat());
    return ResponseFormatter.success(res, displayCategories);
  },

  // GET /api/categories/:id/models
  async modelsWithAvgPrice(req, res) {
    const { id } = req.params;
    const modelsData = await Category.findModelsWithAvgPrice(id, req.query);
    const models = modelsData.map(model => ({
      ...model,
      price_reliability: calculatePriceReliability(model.listing_count),
      is_popular: model.listing_count >= 5,
      formatted_price: formatPrice(model.average_price)
    }));
    return ResponseFormatter.success(res, models);
  },

  // GET /api/categories/:id/brands
  async brandsWithAvgPrice(req, res) {
    const { id } = req.params;
    const brandsData = await Category.findBrandsWithAvgPrice(id, req.query);
    const brands = brandsData.map(brand => ({
      ...brand,
      price_reliability: calculatePriceReliability(brand.listing_count),
      is_popular: brand.listing_count >= 5,
      formatted_price: formatPrice(brand.average_price)
    }));
    return ResponseFormatter.success(res, brands);
  },
  
  // GET /api/categories/:id/stats
  async getStats(req, res) {
    const { id } = req.params;
    const stats = await Category.getCategoryStats(id);
    if (!stats) {
      throw new AppError(404, 'No stats found for this category');
    }
    const enhancedStats = {
      ...stats,
      has_sufficient_data: stats.total_listings >= 10,
      price_reliability: calculatePriceReliability(stats.total_listings),
      market_activity: calculateMarketActivity(stats.total_listings, stats.unique_brands),
      last_updated: new Date().toISOString()
    };
    return ResponseFormatter.success(res, enhancedStats);
  },
  
  // GET /api/categories/tree
  async getTree(req, res) {
    const { rootId } = req.query;
    const treeData = await Category.findCategoryTree(rootId || null);
    const categoryTree = buildHierarchicalTree(treeData);
    return ResponseFormatter.success(res, categoryTree);
  }
};

// --- Business Logic Helpers ---

function calculatePriceReliability(listingCount) {
  if (listingCount === 0) return 0;
  if (listingCount < 5) return 0.3;
  if (listingCount < 15) return 0.6;
  if (listingCount < 50) return 0.8;
  return 1.0;
}

function calculateMarketActivity(totalListings, uniqueBrands) {
  if (totalListings === 0) return 'inactive';
  if (totalListings < 10) return 'low';
  if (totalListings < 50 && uniqueBrands < 5) return 'moderate';
  if (totalListings >= 50 && uniqueBrands >= 5) return 'high';
  return 'moderate';
}

function formatPrice(price, currency = 'EUR') {
  if (price === null || price === undefined) return 'No price data';
  const formatter = new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  return formatter.format(price);
}

function buildHierarchicalTree(categories) {
  const categoryMap = new Map();
  const rootCategories = [];

  categories.forEach(category => {
    const categoryNode = { ...category.toDisplayFormat(), children: [] };
    categoryMap.set(category.id, categoryNode);
  });

  categories.forEach(category => {
    if (category.parent_id) {
      const parent = categoryMap.get(category.parent_id);
      if (parent) {
        parent.children.push(categoryMap.get(category.id));
      }
    } else {
      rootCategories.push(categoryMap.get(category.id));
    }
  });

  return rootCategories;
}

export default CategoryController; 
