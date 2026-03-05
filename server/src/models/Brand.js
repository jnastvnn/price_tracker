import BaseModel from './BaseModel.js';
import { ATTRIBUTE_IDS, STATUS } from '../constants/index.js';

class Brand extends BaseModel {
  static tableName = 'brands';

  constructor(data = {}) {
    super(data);
    this.id = data.id || null;
    this.name = data.name || '';
    // Add other brand-specific properties here
  }
  
  static async findBrandsWithStats(categoryId = null) {
    let query = `
      WITH brand_data AS (
        SELECT la.value_text AS brand, l.price_numeric
        FROM listings l
        JOIN listing_attributes la ON l.id = la.listing_id
        WHERE la.attribute_id = $1 AND l.status = $2 AND l.price_numeric IS NOT NULL
          AND la.value_text IS NOT NULL AND TRIM(la.value_text) != ''`;
    const params = [ATTRIBUTE_IDS.BRAND, STATUS.SUCCESS];
    if (categoryId) {
      query += ` AND EXISTS (SELECT 1 FROM listing_categories lc WHERE lc.listing_id = l.id AND lc.category_id = $3)`;
      params.push(categoryId);
    }
    query += `
      )
      SELECT brand, COUNT(*) AS listing_count, ROUND(AVG(price_numeric)::numeric, 2) AS average_price
      FROM brand_data GROUP BY brand ORDER BY listing_count DESC, brand ASC`;
    return await this.executeQuery(query, params);
  }

  static async getBrandPriceHistory(brandName, categoryId = null) {
    let query = `
      SELECT l.price_numeric, l.post_time
      FROM listings l
      JOIN listing_attributes la ON l.id = la.listing_id`;
    const params = [brandName, ATTRIBUTE_IDS.BRAND];
    if (categoryId) {
      query += `
      JOIN listing_categories lc ON l.id = lc.listing_id
      WHERE la.attribute_id = $2 AND la.value_text = $1 AND lc.category_id = $3
        AND l.status = $4 AND l.price_numeric IS NOT NULL`;
      params.push(categoryId, STATUS.SUCCESS);
    } else {
      query += `
      WHERE la.attribute_id = $2 AND la.value_text = $1 AND l.status = $3
        AND l.price_numeric IS NOT NULL`;
      params.push(STATUS.SUCCESS);
    }
    query += ` ORDER BY l.post_time ASC`;
    return await this.executeQuery(query, params);
  }

  /**
   * Model-level analytics for a brand within a category.
   * Returns: model, listing_count, avg_price, min_price, max_price, avg_sell_time_days
   */
  static async getModelAnalytics(brandName, categoryId) {
    const query = `
      SELECT 
        la_model.value_text AS model,
        COUNT(DISTINCT l.id) AS listing_count,
        ROUND(AVG(l.price_numeric)::numeric, 2) AS avg_price,
        ROUND(MIN(l.price_numeric)::numeric, 2) AS min_price,
        ROUND(MAX(l.price_numeric)::numeric, 2) AS max_price,
        ROUND(
          PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (l.sold_time - l.post_time)) / 86400
          )
          FILTER (WHERE l.is_sold AND l.sold_time IS NOT NULL AND l.post_time IS NOT NULL)
          ::numeric, 2
        ) AS avg_sell_time_days
      FROM listings l
      JOIN listing_attributes la_brand ON l.id = la_brand.listing_id 
        AND la_brand.attribute_id = $1
      LEFT JOIN listing_attributes la_model ON l.id = la_model.listing_id 
        AND la_model.attribute_id = $2
      JOIN listing_categories lc ON l.id = lc.listing_id
      WHERE la_brand.value_text = $3
        AND lc.category_id = $4
        AND l.status = $5
        AND l.price_numeric IS NOT NULL
        AND la_model.value_text IS NOT NULL
      GROUP BY la_model.value_text
      ORDER BY listing_count DESC, avg_price DESC
      LIMIT 50
    `;

    const params = [
      ATTRIBUTE_IDS.BRAND,
      ATTRIBUTE_IDS.MODEL,
      brandName,
      categoryId,
      STATUS.SUCCESS
    ];

    return await this.executeQuery(query, params);
  }

  /**
   * Listing velocity for a brand within a category.
   * Returns counts for last 7/30/90 days and derived per-week/month/quarter.
   */
  static async getListingVelocity(brandName, categoryId) {
    const query = `
      SELECT 
        COUNT(DISTINCT CASE 
          WHEN l.post_time >= NOW() - INTERVAL '7 days' THEN l.id 
        END) AS listings_last_7_days,
        COUNT(DISTINCT CASE 
          WHEN l.post_time >= NOW() - INTERVAL '30 days' THEN l.id 
        END) AS listings_last_30_days,
        COUNT(DISTINCT CASE 
          WHEN l.post_time >= NOW() - INTERVAL '90 days' THEN l.id 
        END) AS listings_last_90_days
      FROM listings l
      JOIN listing_attributes la ON l.id = la.listing_id
      JOIN listing_categories lc ON l.id = lc.listing_id
      WHERE la.attribute_id = $1
        AND la.value_text = $2
        AND lc.category_id = $3
        AND l.status = $4
    `;

    const params = [ATTRIBUTE_IDS.BRAND, brandName, categoryId, STATUS.SUCCESS];
    const result = await this.executeQuery(query, params);

    const row = result && result[0] ? result[0] : {
      listings_last_7_days: 0,
      listings_last_30_days: 0,
      listings_last_90_days: 0
    };

    return {
      raw: row,
      per_week: Math.round(Number(row.listings_last_7_days || 0)),
      per_month: Math.round(Number(row.listings_last_30_days || 0)),
      per_quarter: Math.round(Number(row.listings_last_90_days || 0))
    };
  }

  /**
   * Condition breakdown for a brand within a category.
   * Returns: condition, count, percentage, avg_price
   */
  static async getConditionBreakdown(brandName, categoryId) {
    const CONDITION_ID = 1;

    const query = `
      WITH total AS (
        SELECT COUNT(DISTINCT l.id) as total_count
        FROM listings l
        JOIN listing_attributes la_brand ON l.id = la_brand.listing_id 
          AND la_brand.attribute_id = $1
        JOIN listing_categories lc ON l.id = lc.listing_id
        WHERE la_brand.value_text = $2
          AND lc.category_id = $3
          AND l.status = $4
      )
      SELECT 
        COALESCE(la_cond.value_text, 'Unknown') AS condition,
        COUNT(DISTINCT l.id) AS count,
        ROUND((COUNT(DISTINCT l.id)::numeric / NULLIF(total.total_count, 0) * 100)::numeric, 1) AS percentage,
        ROUND(AVG(l.price_numeric)::numeric, 2) AS avg_price
      FROM listings l
      JOIN listing_attributes la_brand ON l.id = la_brand.listing_id 
        AND la_brand.attribute_id = $1
      LEFT JOIN listing_attributes la_cond ON l.id = la_cond.listing_id 
        AND la_cond.attribute_id = $5
      JOIN listing_categories lc ON l.id = lc.listing_id
      CROSS JOIN total
      WHERE la_brand.value_text = $2
        AND lc.category_id = $3
        AND l.status = $4
      GROUP BY la_cond.value_text, total.total_count
      ORDER BY count DESC
    `;

    const params = [
      ATTRIBUTE_IDS.BRAND,
      brandName,
      categoryId,
      STATUS.SUCCESS,
      CONDITION_ID
    ];

    return await this.executeQuery(query, params);
  }

  /**
   * Market position for a brand within a category.
   * Returns: brand_listing_count, brand_avg_price, category_listing_count,
   *          category_avg_price, market_share_percentage, price_vs_category_percent
   */
  static async getMarketPosition(brandName, categoryId) {
    const query = `
      WITH brand_stats AS (
        SELECT 
          COUNT(DISTINCT l.id) AS brand_listing_count,
          ROUND(AVG(l.price_numeric)::numeric, 2) AS brand_avg_price
        FROM listings l
        JOIN listing_attributes la ON l.id = la.listing_id
        JOIN listing_categories lc ON l.id = lc.listing_id
        WHERE la.attribute_id = $1
          AND la.value_text = $2
          AND lc.category_id = $3
          AND l.status = $4
          AND l.price_numeric IS NOT NULL
      ),
      category_stats AS (
        SELECT 
          COUNT(DISTINCT l.id) AS category_listing_count,
          ROUND(AVG(l.price_numeric)::numeric, 2) AS category_avg_price
        FROM listings l
        JOIN listing_categories lc ON l.id = lc.listing_id
        WHERE lc.category_id = $3
          AND l.status = $4
          AND l.price_numeric IS NOT NULL
      )
      SELECT 
        brand_stats.brand_listing_count,
        brand_stats.brand_avg_price,
        category_stats.category_listing_count,
        category_stats.category_avg_price,
        ROUND(
          (brand_stats.brand_listing_count::numeric / 
           NULLIF(category_stats.category_listing_count, 0) * 100)::numeric, 
          2
        ) AS market_share_percentage,
        ROUND(
          ((brand_stats.brand_avg_price / NULLIF(category_stats.category_avg_price, 1) - 1) * 100)::numeric,
          1
        ) AS price_vs_category_percent
      FROM brand_stats
      CROSS JOIN category_stats
    `;

    const params = [ATTRIBUTE_IDS.BRAND, brandName, categoryId, STATUS.SUCCESS];
    const result = await this.executeQuery(query, params);
    return result && result[0] ? result[0] : null;
  }

  /**
   * Get geographic distribution for a brand as coarse daily bins.
   * Returns one-day bins grouped by 3-digit postal region.
   */
  static async getCoordinates(brandName, categoryId = null, options = {}) {
    const MAX_BIN_LIMIT = 20000;
    const DEFAULT_BIN_LIMIT = 5000;
    const limit = Math.min(
      MAX_BIN_LIMIT,
      Math.max(1, Number(options.limit) || DEFAULT_BIN_LIMIT)
    );
    const minCount = Math.max(1, Math.min(25, Number(options.minCount) || 1));

    const south = Number.isFinite(Number(options.south)) ? Number(options.south) : null;
    const west = Number.isFinite(Number(options.west)) ? Number(options.west) : null;
    const north = Number.isFinite(Number(options.north)) ? Number(options.north) : null;
    const east = Number.isFinite(Number(options.east)) ? Number(options.east) : null;
    const hasViewportBounds =
      south !== null &&
      west !== null &&
      north !== null &&
      east !== null;

    const params = [ATTRIBUTE_IDS.BRAND, brandName, STATUS.SUCCESS];
    const joins = [];
    const whereConditions = [
      `la.attribute_id = $1`,
      `la.value_text = $2`,
      `l.status = $3`,
      `l.latitude IS NOT NULL`,
      `l.longitude IS NOT NULL`,
      `l.postal_code IS NOT NULL`,
      `TRIM(l.postal_code) <> ''`
    ];

    if (categoryId) {
      joins.push(`JOIN listing_categories lc ON l.id = lc.listing_id`);
      whereConditions.push(`lc.category_id = $${params.length + 1}`);
      params.push(categoryId);
    }

    if (hasViewportBounds) {
      whereConditions.push(`l.latitude BETWEEN $${params.length + 1} AND $${params.length + 2}`);
      params.push(south, north);
      whereConditions.push(`l.longitude BETWEEN $${params.length + 1} AND $${params.length + 2}`);
      params.push(west, east);
    }

    if (options.startDate) {
      whereConditions.push(`COALESCE(l.post_time, l.created_at) >= $${params.length + 1}::timestamptz`);
      params.push(options.startDate);
    }

    if (options.endDate) {
      whereConditions.push(`COALESCE(l.post_time, l.created_at) < $${params.length + 1}::timestamptz`);
      params.push(options.endDate);
    }

    const minCountParamIndex = params.length + 1;
    const limitParamIndex = params.length + 2;

    const query = `
      SELECT
        date_trunc('day', COALESCE(l.post_time, l.created_at))::date AS day_bin,
        LEFT(TRIM(l.postal_code), 3) AS postal_region,
        COUNT(*)::int AS listing_count,
        ROUND(AVG(l.price_numeric)::numeric, 2) AS avg_price
      FROM listings l
      JOIN listing_attributes la ON l.id = la.listing_id
      ${joins.join('\n')}
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY day_bin, postal_region
      HAVING COUNT(*) >= $${minCountParamIndex}
      ORDER BY day_bin ASC, postal_region ASC
      LIMIT $${limitParamIndex}
    `;

    params.push(minCount, limit);
    return await this.executeQuery(query, params);
  }

  /**
   * Get categories where a brand has listings.
   * Returns: category_id, category_name, listing_count
   */
  static async getBrandCategories(brandName) {
    const query = `
      SELECT 
        c.id AS category_id,
        c.name AS category_name,
        COUNT(DISTINCT l.id) AS listing_count
      FROM listings l
      JOIN listing_attributes la ON l.id = la.listing_id
      JOIN listing_categories lc ON l.id = lc.listing_id
      JOIN categories c ON lc.category_id = c.id
      WHERE la.attribute_id = $1
        AND la.value_text = $2
        AND l.status = $3
      GROUP BY c.id, c.name
      ORDER BY listing_count DESC, c.name ASC
    `;

    const params = [ATTRIBUTE_IDS.BRAND, brandName, STATUS.SUCCESS];
    return await this.executeQuery(query, params);
  }

  /**
   * Get complete analytics for a brand within a category.
   * Returns all analytics in a single response.
   */
  static async getAnalytics(brandName, categoryId) {
    const [
      modelAnalytics,
      velocity,
      conditionBreakdown,
      marketPosition
    ] = await Promise.all([
      this.getModelAnalytics(brandName, categoryId),
      this.getListingVelocity(brandName, categoryId),
      this.getConditionBreakdown(brandName, categoryId),
      this.getMarketPosition(brandName, categoryId)
    ]);

    return {
      brand_name: brandName,
      category_id: categoryId,
      models: modelAnalytics,
      velocity,
      condition_breakdown: conditionBreakdown,
      market_position: marketPosition
    };
  }
}

export default Brand; 
