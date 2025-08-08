import BaseModel from './BaseModel.js';
import { STATUS } from '../constants/index.js';

/**
 * Listing Domain Model
 * Represents a marketplace listing with status, pricing, and attribute data
 */
class Listing extends BaseModel {
  static tableName = 'listings';

  constructor(data = {}) {
    super(data);
    
    // Core properties
    this.id = data.id || null;
    this.listing_id = data.listing_id || '';
    this.title = data.title || '';
    this.description = data.description || '';
    this.price_numeric = data.price_numeric || null;
    this.currency = data.currency || 'EUR';
    this.status = data.status || 'pending';
    this.url = data.url || '';
    this.post_time = data.post_time || null;
    this.is_sold = data.is_sold !== undefined ? data.is_sold : false;
    this.seller_name = data.seller_name || '';
    this.location = data.location || '';
    this.views_count = data.views_count || 0;
    this.tsv = data.tsv || null; // Full-text search vector
    
    // Computed properties (not stored in database)
    this.attributes = data.attributes || {};
    this.categories = data.categories || [];
    this.images = data.images || [];
    this.price_history = data.price_history || [];
  }

  /**
   * Validation rules
   */
  validateRequired() {
    const errors = {};
    
    if (!this.listing_id || this.listing_id.trim().length === 0) {
      errors.listing_id = 'Listing ID is required';
    }
    
    if (!this.title || this.title.trim().length === 0) {
      errors.title = 'Title is required';
    }
    
    if (this.title && this.title.length > 500) {
      errors.title = 'Title must be 500 characters or less';
    }
    
    if (this.price_numeric !== null && (isNaN(this.price_numeric) || this.price_numeric < 0)) {
      errors.price_numeric = 'Price must be a positive number';
    }
    
    if (!['pending', 'success', 'failed'].includes(this.status)) {
      errors.status = 'Status must be one of: pending, success, failed';
    }
    
    if (this.url && !this.isValidUrl(this.url)) {
      errors.url = 'Invalid URL format';
    }
    
    if (!['EUR', 'USD', 'SEK', 'NOK', 'DKK'].includes(this.currency)) {
      errors.currency = 'Unsupported currency';
    }
    
    return errors;
  }

  /**
   * Business Logic Methods
   */
  
  /**
   * Check if listing is successfully processed
   */
  isSuccessful() {
    return this.status === 'success';
  }

  /**
   * Check if listing has failed processing
   */
  isFailed() {
    return this.status === 'failed';
  }

  /**
   * Check if listing is still pending
   */
  isPending() {
    return this.status === 'pending';
  }

  /**
   * Check if listing is sold
   */
  isSold() {
    return this.is_sold === true;
  }

  /**
   * Check if listing is active (successful and not sold)
   */
  isActive() {
    return this.isSuccessful() && !this.isSold();
  }

  /**
   * Get formatted price with currency
   */
  getFormattedPrice() {
    if (this.price_numeric === null) return 'Price not available';
    
    const formatter = new Intl.NumberFormat('fi-FI', {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
    
    return formatter.format(this.price_numeric);
  }

  /**
   * Get price in specified currency (basic conversion)
   */
  getPriceInCurrency(targetCurrency) {
    if (!this.price_numeric) return null;
    if (this.currency === targetCurrency) return this.price_numeric;
    
    // Basic currency conversion rates (should be from external service in production)
    const rates = {
      'EUR': { 'USD': 1.09, 'SEK': 11.5, 'NOK': 11.8, 'DKK': 7.46 },
      'USD': { 'EUR': 0.92, 'SEK': 10.55, 'NOK': 10.82, 'DKK': 6.84 },
      'SEK': { 'EUR': 0.087, 'USD': 0.095, 'NOK': 1.03, 'DKK': 0.65 }
    };
    
    if (rates[this.currency] && rates[this.currency][targetCurrency]) {
      return Math.round(this.price_numeric * rates[this.currency][targetCurrency] * 100) / 100;
    }
    
    return this.price_numeric; // Fallback to original price
  }

  /**
   * Check if URL is valid
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get listing age in days
   */
  getAgeInDays() {
    if (!this.post_time) return null;
    
    const postDate = new Date(this.post_time);
    const now = new Date();
    const diffTime = Math.abs(now - postDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if listing is recent (posted within last 7 days)
   */
  isRecent() {
    const age = this.getAgeInDays();
    return age !== null && age <= 7;
  }

  /**
   * Get attribute value by name
   */
  getAttribute(attributeName) {
    return this.attributes[attributeName] || null;
  }

  /**
   * Set attribute value
   */
  setAttribute(attributeName, value) {
    this.attributes[attributeName] = value;
    return this;
  }

  /**
   * Get brand from attributes
   */
  getBrand() {
    return this.getAttribute('Brand') || this.getAttribute('brand') || 'Unknown';
  }

  /**
   * Get model from attributes
   */
  getModel() {
    return this.getAttribute('Model') || this.getAttribute('model') || 'Unknown';
  }

  /**
   * Get primary category
   */
  getPrimaryCategory() {
    return this.categories.length > 0 ? this.categories[this.categories.length - 1] : null;
  }

  /**
   * Generate search-friendly text for full-text search
   */
  generateSearchText() {
    const parts = [
      this.title,
      this.description,
      this.getBrand(),
      this.getModel(),
      this.seller_name,
      this.location,
      ...Object.values(this.attributes).filter(v => typeof v === 'string')
    ].filter(Boolean);
    
    return parts.join(' ').toLowerCase();
  }

  /**
   * Business rules before save
   */
  beforeSave() {
    super.beforeSave();
    
    // Ensure price is properly formatted
    if (this.price_numeric !== null) {
      this.price_numeric = parseFloat(this.price_numeric);
    }
    
    // Set default currency if not provided
    if (!this.currency) {
      this.currency = 'EUR';
    }
    
    // Increment views count if this is an update
    if (!this.isNew) {
      this.views_count = (this.views_count || 0) + 1;
    }
    
    // Validate and clean URL
    if (this.url && !this.url.startsWith('http')) {
      this.url = 'https://' + this.url;
    }
  }

  /**
   * Convert to database format
   */
  toDatabase() {
    const data = super.toDatabase();
    
    // Remove computed properties
    delete data.attributes;
    delete data.categories;
    delete data.images;
    delete data.price_history;
    
    return data;
  }

  /**
   * Format for API response
   */
  toDisplayFormat() {
    return {
      id: this.id,
      listing_id: this.listing_id,
      title: this.title,
      description: this.description,
      price_numeric: this.price_numeric,
      formatted_price: this.getFormattedPrice(),
      currency: this.currency,
      status: this.status,
      url: this.url,
      post_time: this.post_time,
      is_sold: this.is_sold,
      seller_name: this.seller_name,
      location: this.location,
      views_count: this.views_count,
      brand: this.getBrand(),
      model: this.getModel(),
      primary_category: this.getPrimaryCategory(),
      age_days: this.getAgeInDays(),
      is_recent: this.isRecent(),
      is_active: this.isActive(),
      attributes: this.attributes,
      categories: this.categories,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  /**
   * Mark listing as sold
   */
  markAsSold() {
    this.is_sold = true;
    this.status = 'success'; // Ensure status is success when sold
    return this;
  }

  /**
   * Mark listing as active
   */
  markAsActive() {
    this.is_sold = false;
    this.status = 'success';
    return this;
  }

  /**
   * Mark listing as failed
   */
  markAsFailed() {
    this.status = 'failed';
    return this;
  }

  /**
   * Add category to listing
   */
  addCategory(category) {
    if (!this.categories.includes(category)) {
      this.categories.push(category);
    }
    return this;
  }

  /**
   * Remove category from listing
   */
  removeCategory(category) {
    this.categories = this.categories.filter(c => c !== category);
    return this;
  }

  // --- Data Access Methods (Static) ---

  static async findListingsGroupedByModel(filters = {}) {
    const { page = 1, limit = 10, search, category, brands, minPrice, maxPrice } = filters;
    const offset = (page - 1) * limit;
    const queryParams = [];
    const whereConditions = [
      "l.status = 'success'", 
      'l.price_numeric IS NOT NULL', 
      'la_model.value_text IS NOT NULL'
    ];
    const joins = [
      'LEFT JOIN listing_attributes la_brand ON l.id = la_brand.listing_id AND la_brand.attribute_id = 6',
      'LEFT JOIN listing_attributes la_model ON l.id = la_model.listing_id AND la_model.attribute_id = 2'
    ];
  
    // Keep category as parameter (not hardcoded)
    if (category) {
      joins.push('JOIN listing_categories lc ON l.id = lc.listing_id');
      whereConditions.push(`lc.category_id = $${queryParams.length + 1}`);
      queryParams.push(category);
    }
  
    // Keep existing search logic
    if (search) {
      const terms = search.trim().split(/\s+/).filter(Boolean);
      if (terms.length > 0) {
        const tsQueryString = terms.map(t => `'${t}'`).join(' & ') + ':*';
        whereConditions.push(`l.tsv @@ to_tsquery('finnish', $${queryParams.length + 1})`);
        queryParams.push(tsQueryString);
      }
    }
  
    // Keep existing brands filter
    if (brands) {
      const brandArray = Array.isArray(brands) ? brands : [brands];
      const placeholders = brandArray.map((_, i) => `$${queryParams.length + i + 1}`).join(',');
      whereConditions.push(`la_brand.value_text IN (${placeholders})`);
      queryParams.push(...brandArray);
    }
  
    // Keep existing price filters
    if (minPrice) {
      whereConditions.push(`l.price_numeric >= $${queryParams.length + 1}`);
      queryParams.push(minPrice);
    }
    if (maxPrice) {
      whereConditions.push(`l.price_numeric <= $${queryParams.length + 1}`);
      queryParams.push(maxPrice);
    }
  
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const joinClause = joins.join(' ');
    
    // Simplified query structure - matches your SQL
    const listingsQuery = `
      SELECT 
        COALESCE(la_model.value_text, 'Unknown Model') AS model,
        STRING_AGG(DISTINCT la_brand.value_text, ', ' ORDER BY la_brand.value_text) AS brands,
        COUNT(l.id) AS listing_count,
        ROUND(AVG(l.price_numeric)::numeric, 0) AS average_price
      FROM listings l ${joinClause} ${whereClause}
      GROUP BY la_model.value_text
      ORDER BY listing_count DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
  
    // Keep count query for pagination
    const countQuery = `
      SELECT COUNT(*) AS total FROM (
        SELECT 1 FROM listings l ${joinClause} ${whereClause} GROUP BY la_model.value_text
      ) grouped_results`;
  
    queryParams.push(limit, offset);
    const [countResult, listingsResult] = await Promise.all([
      this.executeCountQuery(countQuery, queryParams.slice(0, -2)),
      this.executeQuery(listingsQuery, queryParams)
    ]);
  
    const totalItems = countResult;
    const totalPages = Math.ceil(totalItems / limit);
    
    // Keep pagination object
    return {
      listings: listingsResult,
      pagination: {
        currentPage: parseInt(page, 10),
        totalPages,
        totalItems,
        itemsPerPage: parseInt(limit, 10),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? Number(page) + 1 : null,
        prevPage: page > 1 ? Number(page) - 1 : null
      }
    };
  }

  static async findSuccessfulById(id) {
    const results = await this.findWhere({ id, status: STATUS.SUCCESS });
    return results.length > 0 ? results[0] : null;
  }

  static async findBrandsByCategory(categoryId) {
    const query = `
      WITH brand_data AS (
        SELECT la.value_text AS brand, l.price_numeric
        FROM listings l
        JOIN listing_categories lc ON l.id = lc.listing_id
        JOIN listing_attributes la ON l.id = la.listing_id
        WHERE lc.category_id = $1
          AND la.attribute_id = 6 AND l.status = 'success'
          AND l.price_numeric IS NOT NULL AND la.value_text IS NOT NULL AND TRIM(la.value_text) != ''
      )
      SELECT brand, COUNT(*) AS listing_count, ROUND(AVG(price_numeric)::numeric, 2) AS average_price
      FROM brand_data GROUP BY brand ORDER BY listing_count DESC, brand ASC`;
    return await this.executeQuery(query, [categoryId]);
  }

  static async searchByAttributes(filters = {}) {
    const { attributeValue, attributeId, categoryId, page = 1, limit = 10, minPrice, maxPrice } = filters;
    const offset = (page - 1) * limit;
    const queryParams = [attributeValue];
    let query = `
      SELECT DISTINCT l.id, l.listing_id, l.title, l.description, l.price_numeric, l.currency, l.url,
        l.post_time, l.created_at, la_model.value_text as model, la_brand.value_text as brand
      FROM listings l
      JOIN listing_attributes la_search ON l.id = la_search.listing_id
      LEFT JOIN listing_attributes la_model ON l.id = la_model.listing_id AND la_model.attribute_id = 2
      LEFT JOIN listing_attributes la_brand ON l.id = la_brand.listing_id AND la_brand.attribute_id = 6`;
    const whereConditions = ["l.status = 'success'", 'l.price_numeric IS NOT NULL', 'la_search.value_text = $1'];

    if (attributeId) {
      whereConditions.push(`la_search.attribute_id = $${queryParams.length + 1}`);
      queryParams.push(attributeId);
    }
    if (categoryId) {
      query += ` JOIN listing_categories lc ON l.id = lc.listing_id`;
      whereConditions.push(`lc.category_id = $${queryParams.length + 1}`);
      queryParams.push(categoryId);
    }
    if (minPrice) {
      whereConditions.push(`l.price_numeric >= $${queryParams.length + 1}`);
      queryParams.push(minPrice);
    }
    if (maxPrice) {
      whereConditions.push(`l.price_numeric <= $${queryParams.length + 1}`);
      queryParams.push(maxPrice);
    }

    query += ` WHERE ${whereConditions.join(' AND ')} ORDER BY l.post_time DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    const countQuery = `
      SELECT COUNT(DISTINCT l.id) as total
      FROM listings l
      JOIN listing_attributes la_search ON l.id = la_search.listing_id
      ${categoryId ? 'JOIN listing_categories lc ON l.id = lc.listing_id' : ''}
      WHERE ${whereConditions.join(' AND ')}`;

    queryParams.push(limit, offset);
    const [countResult, listingsResult] = await Promise.all([
      this.executeCountQuery(countQuery, queryParams.slice(0, -2)),
      this.executeQuery(query, queryParams)
    ]);

    const totalItems = countResult;
    const totalPages = Math.ceil(totalItems / limit);
    return {
      listings: listingsResult.map(row => new this(row)),
      pagination: {
        currentPage: parseInt(page, 10),
        totalPages,
        totalItems,
        itemsPerPage: parseInt(limit, 10),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? Number(page) + 1 : null,
        prevPage: page > 1 ? Number(page) - 1 : null
      }
    };
  }
}

export default Listing; 