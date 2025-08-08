import BaseModel from './BaseModel.js';

/**
 * ProductModel Domain Model
 * Represents a product model with brand association and category classification
 */
class ProductModel extends BaseModel {
  static tableName = 'product_models';

  constructor(data = {}) {
    super(data);
    
    // Core properties
    this.id = data.id || null;
    this.name = data.name || '';
    this.brand_id = data.brand_id || null;
    this.category_id = data.category_id || null;
    this.model_number = data.model_number || '';
    this.description = data.description || '';
    this.specifications = data.specifications || {};
    this.release_year = data.release_year || null;
    this.discontinuation_year = data.discontinuation_year || null;
    this.is_active = data.is_active !== undefined ? data.is_active : true;
    this.average_price = data.average_price || null;
    this.listing_count = data.listing_count || 0;
    
    // Computed properties (not stored in database)
    this.brand = data.brand || null;
    this.category = data.category || null;
    this.variants = data.variants || [];
    this.price_history = data.price_history || [];
  }

  /**
   * Validation rules
   */
  validateRequired() {
    const errors = {};
    
    if (!this.name || this.name.trim().length === 0) {
      errors.name = 'Product model name is required';
    }
    
    if (this.name && this.name.length > 255) {
      errors.name = 'Product model name must be 255 characters or less';
    }
    
    if (!this.brand_id) {
      errors.brand_id = 'Brand is required';
    }
    
    if (!this.category_id) {
      errors.category_id = 'Category is required';
    }
    
    if (this.release_year && (this.release_year < 1900 || this.release_year > new Date().getFullYear() + 1)) {
      errors.release_year = 'Release year must be between 1900 and next year';
    }
    
    if (this.discontinuation_year && this.release_year && this.discontinuation_year < this.release_year) {
      errors.discontinuation_year = 'Discontinuation year cannot be before release year';
    }
    
    if (this.average_price && (isNaN(this.average_price) || this.average_price < 0)) {
      errors.average_price = 'Average price must be a positive number';
    }
    
    return errors;
  }

  /**
   * Business Logic Methods
   */
  
  /**
   * Check if product model is currently discontinued
   */
  isDiscontinued() {
    return this.discontinuation_year !== null && this.discontinuation_year <= new Date().getFullYear();
  }

  /**
   * Check if product model is recently released (within last 2 years)
   */
  isRecentlyReleased() {
    if (!this.release_year) return false;
    return this.release_year >= new Date().getFullYear() - 2;
  }

  /**
   * Check if product model is vintage (older than 15 years)
   */
  isVintage() {
    if (!this.release_year) return false;
    return this.release_year <= new Date().getFullYear() - 15;
  }

  /**
   * Get product age in years
   */
  getAgeInYears() {
    if (!this.release_year) return null;
    return new Date().getFullYear() - this.release_year;
  }

  /**
   * Get product lifecycle status
   */
  getLifecycleStatus() {
    if (this.isDiscontinued()) return 'discontinued';
    if (this.isRecentlyReleased()) return 'new';
    if (this.isVintage()) return 'vintage';
    return 'active';
  }

  /**
   * Get full product name including brand
   */
  getFullName() {
    if (this.brand && this.brand.name) {
      return `${this.brand.name} ${this.name}`;
    }
    return this.name;
  }

  /**
   * Get specification value by key
   */
  getSpecification(key) {
    return this.specifications[key] || null;
  }

  /**
   * Set specification value
   */
  setSpecification(key, value) {
    this.specifications[key] = value;
    return this;
  }

  /**
   * Check if model has sufficient market data for price analysis
   */
  hasSufficientMarketData() {
    return this.listing_count >= 5;
  }

  /**
   * Calculate price reliability score based on listing count
   */
  getPriceReliabilityScore() {
    if (this.listing_count === 0) return 0;
    if (this.listing_count < 5) return 0.3;
    if (this.listing_count < 15) return 0.6;
    if (this.listing_count < 50) return 0.8;
    return 1.0;
  }

  /**
   * Get formatted average price
   */
  getFormattedAveragePrice(currency = 'EUR') {
    if (!this.average_price) return 'No price data';
    
    const formatter = new Intl.NumberFormat('fi-FI', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
    
    return formatter.format(this.average_price);
  }

  /**
   * Generate search keywords for the product model
   */
  generateSearchKeywords() {
    const keywords = [
      this.name,
      this.model_number,
      this.brand?.name,
      this.category?.name,
      ...Object.values(this.specifications).filter(v => typeof v === 'string')
    ].filter(Boolean);
    
    return [...new Set(keywords.map(k => k.toLowerCase()))];
  }

  /**
   * Business rules before save
   */
  beforeSave() {
    super.beforeSave();
    
    // Ensure listing_count is a number
    this.listing_count = parseInt(this.listing_count) || 0;
    
    // Ensure average_price is properly formatted
    if (this.average_price !== null) {
      this.average_price = parseFloat(this.average_price);
    }
    
    // Validate year fields
    if (this.release_year) {
      this.release_year = parseInt(this.release_year);
    }
    
    if (this.discontinuation_year) {
      this.discontinuation_year = parseInt(this.discontinuation_year);
    }
    
    // Auto-generate model number if not provided
    if (!this.model_number && this.name) {
      this.model_number = this.name.replace(/\s+/g, '-').toUpperCase();
    }
  }

  /**
   * Convert to database format
   */
  toDatabase() {
    const data = super.toDatabase();
    
    // Remove computed properties
    delete data.brand;
    delete data.category;
    delete data.variants;
    delete data.price_history;
    
    // Ensure specifications is stored as JSON
    if (typeof data.specifications === 'object') {
      data.specifications = JSON.stringify(data.specifications);
    }
    
    return data;
  }

  /**
   * Format for API response
   */
  toDisplayFormat() {
    return {
      id: this.id,
      name: this.name,
      full_name: this.getFullName(),
      brand_id: this.brand_id,
      brand: this.brand,
      category_id: this.category_id,
      category: this.category,
      model_number: this.model_number,
      description: this.description,
      specifications: this.specifications,
      release_year: this.release_year,
      discontinuation_year: this.discontinuation_year,
      is_active: this.is_active,
      average_price: this.average_price,
      formatted_average_price: this.getFormattedAveragePrice(),
      listing_count: this.listing_count,
      age_years: this.getAgeInYears(),
      lifecycle_status: this.getLifecycleStatus(),
      is_discontinued: this.isDiscontinued(),
      is_recently_released: this.isRecentlyReleased(),
      is_vintage: this.isVintage(),
      has_sufficient_data: this.hasSufficientMarketData(),
      price_reliability_score: this.getPriceReliabilityScore(),
      search_keywords: this.generateSearchKeywords(),
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  /**
   * Add variant to product model
   */
  addVariant(variant) {
    this.variants.push(variant);
    return this;
  }

  /**
   * Remove variant from product model
   */
  removeVariant(variantId) {
    this.variants = this.variants.filter(v => v.id !== variantId);
    return this;
  }

  /**
   * Update market statistics
   */
  updateMarketStats(listingCount, averagePrice) {
    this.listing_count = listingCount;
    this.average_price = averagePrice;
    return this;
  }

  // --- Data Access Methods (Static) ---

  static async findByBrand(brandId) {
    return await this.findWhere({ brand_id: brandId }, '*', 'name ASC');
  }

  static async findByCategory(categoryId) {
    const query = `
      SELECT pm.*, b.name as brand_name
      FROM product_models pm
      JOIN brands b ON pm.brand_id = b.id
      WHERE pm.category_id = $1
      ORDER BY b.name ASC, pm.name ASC`;
    return await this.executeQuery(query, [categoryId]);
  }

  static async findWithBrand(modelId) {
    const query = `
      SELECT pm.*, b.name as brand_name, c.name as category_name
      FROM product_models pm
      LEFT JOIN brands b ON pm.brand_id = b.id
      LEFT JOIN categories c ON pm.category_id = c.id
      WHERE pm.id = $1`;
    const result = await this.executeQuery(query, [modelId]);
    return result[0] ? new this(result[0]) : null;
  }

  static async searchModels(searchTerm, categoryId = null) {
    let query = `
      SELECT pm.*, b.name as brand_name, c.name as category_name
      FROM product_models pm
      LEFT JOIN brands b ON pm.brand_id = b.id
      LEFT JOIN categories c ON pm.category_id = c.id
      WHERE (pm.name ILIKE $1 OR b.name ILIKE $1)`;
    const params = [`%${searchTerm}%`];
    if (categoryId) {
      query += ` AND pm.category_id = $2`;
      params.push(categoryId);
    }
    query += ` ORDER BY pm.name ASC`;
    return await this.executeQuery(query, params);
  }

  static async getModelStats(modelId) {
    const query = `
      SELECT 
        COUNT(l.id) as listing_count,
        ROUND(AVG(l.price_numeric)::numeric, 2) as average_price,
        MIN(l.price_numeric) as min_price,
        MAX(l.price_numeric) as max_price,
        MAX(l.created_at) as latest_listing
      FROM listings l
      JOIN listing_attributes la ON l.id = la.listing_id
      WHERE la.attribute_id = 2 AND la.value_text = (SELECT name FROM product_models WHERE id = $1)
        AND l.status = 'success' AND l.price_numeric IS NOT NULL`;
    const result = await this.executeQuery(query, [modelId]);
    return result[0] || null;
  }

  static async getModelPriceHistory(modelName, categoryId = null) {
    let baseQuery = `
      WITH model_listings AS (
        SELECT DISTINCT l.id, l.listing_id, l.price_numeric, l.post_time
        FROM listings l
        JOIN listing_attributes la ON l.id = la.listing_id
        JOIN product_attributes pa ON la.attribute_id = pa.id`;
    
    const params = [modelName];
    let whereConditions = [
      `pa.name = 'Model'`,
      `la.value_text = $1`,
      `l.status = 'success'`,
      `l.price_numeric IS NOT NULL`
    ];

    // Add category filter if provided
    if (categoryId) {
      baseQuery += `\n        JOIN listing_categories lc ON l.id = lc.listing_id`;
      whereConditions.push(`lc.category_id = $${params.length + 1}`);
      params.push(categoryId);
    }

    baseQuery += `\n        WHERE ${whereConditions.join(' AND ')}`;
    
    const fullQuery = `
      ${baseQuery}
      )
      SELECT 
        ml.listing_id,
        ml.price_numeric as price,
        ml.post_time,
        
        -- All attributes for this listing as JSON object
        JSON_OBJECT_AGG(
          pa.name, 
          COALESCE(
            la.value_text,
            la.value_integer::text,
            la.value_decimal::text,
            la.value_boolean::text
          )
        ) FILTER (WHERE pa.name NOT IN ('Model', 'Brand') AND (
          la.value_text IS NOT NULL OR 
          la.value_integer IS NOT NULL OR 
          la.value_decimal IS NOT NULL OR 
          la.value_boolean IS NOT NULL
        )) AS attributes

      FROM model_listings ml
      LEFT JOIN listing_attributes la ON ml.id = la.listing_id
      LEFT JOIN product_attributes pa ON la.attribute_id = pa.id
      GROUP BY ml.listing_id, ml.price_numeric, ml.post_time
      ORDER BY ml.post_time ASC`;

    return await this.executeQuery(fullQuery, params);
  }
}

export default ProductModel; 