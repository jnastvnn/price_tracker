import Listing from '../models/Listing.js';

const ListingController = {
  // GET /api/listings
  async list(req, res) {
    const result = await Listing.findListingsGroupedByModel(req.query);
    res.json({ success: true, data: result });
  },

  // GET /api/listings/:id
  async getOne(req, res) {
    const { id } = req.params;
    const listing = await Listing.findSuccessfulById(id);

    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    res.json({ success: true, data: listing.toDisplayFormat() });
  },

  // GET /api/listings/brands
  async brands(req, res) {
    const { category } = req.query;
    if (!category) {
      return res.status(400).json({ success: false, error: 'Category parameter is required' });
    }

    const brands = await Listing.findBrandsByCategory(category);
    res.json({ success: true, data: brands });
  },

  // GET /api/listings/search-by-attributes
  async searchByAttributes(req, res) {
    const { attributeValue } = req.query;
    if (!attributeValue) {
      return res.status(400).json({ 
        success: false, 
        error: 'attributeValue parameter is required' 
      });
    }

    const result = await Listing.searchByAttributes(req.query);
    // Convert listing data to display format
    result.listings = result.listings.map(listing => listing.toDisplayFormat());
    
    res.json({ success: true, data: result });
  }
};

export default ListingController; 