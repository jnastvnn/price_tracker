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
  
  // Domain logic methods can be added here
  
  // --- Data Access Methods (Static) ---

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
}

export default Brand; 