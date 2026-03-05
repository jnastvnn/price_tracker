import Listing from '../models/Listing.js';
import AppError from '../utils/AppError.js';
import ResponseFormatter from '../utils/ResponseFormatter.js';

const ListingController = {
  // GET /api/listings
  async list(req, res) {
    const result = await Listing.findListingsGroupedByModel(req.query);
    return ResponseFormatter.success(res, result);
  },
  
  // GET /api/listings/by-model-key (grouped)
  async listByModelKey(req, res) {
    const result = await Listing.findListingsGroupedByModelKey(req.query);
    return ResponseFormatter.success(res, result);
  },

  // GET /api/listings/:id
  async getOne(req, res) {
    const { id } = req.params;
    const listing = await Listing.findSuccessfulById(id);

    if (!listing) {
      throw new AppError(404, 'Listing not found');
    }

    return ResponseFormatter.success(res, listing.toDisplayFormat());
  },

  // GET /api/listings/brands
  async brands(req, res) {
    const { category } = req.query;
    if (!category) {
      throw new AppError(400, 'Category parameter is required');
    }

    const brands = await Listing.findBrandsByCategory(category);
    return ResponseFormatter.success(res, brands);
  },

  // GET /api/listings/search-by-attributes
  async searchByAttributes(req, res) {
    const { attributeValue } = req.query;
    if (!attributeValue) {
      throw new AppError(400, 'attributeValue parameter is required');
    }

    const result = await Listing.searchByAttributes(req.query);
    // Convert listing data to display format
    result.listings = result.listings.map(listing => listing.toDisplayFormat());
    
    return ResponseFormatter.success(res, result);
  },

  // GET /api/listings/by-model-key?modelKey=iphone12pro&category=123
  async byModelKey(req, res) {
    const { modelKey } = req.query;
    if (!modelKey) {
      throw new AppError(400, 'modelKey parameter is required');
    }
    const result = await Listing.findByModelKey(req.query);
    return ResponseFormatter.success(res, result);
  }
};

export default ListingController; 
