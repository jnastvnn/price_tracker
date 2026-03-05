import Brand from '../models/Brand.js';
import AppError from '../utils/AppError.js';
import ResponseFormatter from '../utils/ResponseFormatter.js';

const BrandController = {
  // GET /api/brands/:brandName/prices
  async prices(req, res) {
    const { brandName } = req.params;
    const { categoryId } = req.query;
    const decodedBrandName = decodeURIComponent(brandName);
    const priceHistory = await Brand.getBrandPriceHistory(
      decodedBrandName,
      categoryId
    );
    return ResponseFormatter.success(res, priceHistory);
  },

  /**
   * Get complete analytics for a brand within a category
   * GET /brands/:brandName/analytics?categoryId=X
   */
  async getAnalytics(req, res) {
    const { brandName } = req.params;
    const { categoryId } = req.query;
    
    if (!categoryId) {
      throw new AppError(400, 'categoryId query parameter is required');
    }
    
    const decodedBrandName = decodeURIComponent(brandName);
    const analytics = await Brand.getAnalytics(decodedBrandName, categoryId);
    
    return ResponseFormatter.success(res, analytics);
  },

  /**
   * Get coarse geographic bins for a brand's listings.
   * GET /brands/:brandName/coordinates?categoryId=X&south=..&west=..&north=..&east=..
   */
  async getCoordinates(req, res) {
    const { brandName } = req.params;
    const {
      categoryId,
      south,
      west,
      north,
      east,
      startDate,
      endDate,
      minCount,
      limit
    } = req.query;
    
    const decodedBrandName = decodeURIComponent(brandName);
    const bins = await Brand.getCoordinates(decodedBrandName, categoryId, {
      south,
      west,
      north,
      east,
      startDate,
      endDate,
      minCount,
      limit
    });
    
    return ResponseFormatter.success(
      res,
      {
        bin_size: '1 day',
        bins: bins.map((row) => ({
          day: row.day_bin instanceof Date
            ? row.day_bin.toISOString().slice(0, 10)
            : String(row.day_bin),
          postal_region: row.postal_region,
          listing_count: parseInt(row.listing_count, 10),
          avg_price: row.avg_price === null ? null : parseFloat(row.avg_price)
        }))
      }
    );
  },

  /**
   * Get categories where a brand has listings
   * GET /brands/:brandName/categories
   */
  async getCategories(req, res) {
    const { brandName } = req.params;
    
    const decodedBrandName = decodeURIComponent(brandName);
    const categories = await Brand.getBrandCategories(decodedBrandName);
    
    return ResponseFormatter.success(
      res,
      categories.map(c => ({
        id: c.category_id,
        name: c.category_name,
        listing_count: parseInt(c.listing_count, 10)
      }))
    );
  }
};

export default BrandController;
