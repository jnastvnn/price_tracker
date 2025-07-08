import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// GET price history for a specific brand (optionally filtered by category)
router.get('/:brandName/prices', async (req, res) => {
  const { brandName } = req.params;
  const { categoryId } = req.query; // Optional category filter
  
  let query = `
    SELECT l.price_numeric, l.post_time
    FROM listings l
    JOIN listing_attributes la ON l.id = la.listing_id
  `;
  
  const params = [decodeURIComponent(brandName)];
  
  // Add category filter if provided
  if (categoryId) {
    query += `
    JOIN listing_categories lc ON l.id = lc.listing_id
    WHERE la.attribute_id = 2
      AND la.value_text = $1
      AND lc.category_id = $2
      AND l.price_numeric IS NOT NULL
    `;
    params.push(categoryId);
  } else {
    query += `
    WHERE la.attribute_id = 2
      AND la.value_text = $1
      AND l.price_numeric IS NOT NULL
    `;
  }
  
  query += `ORDER BY l.post_time ASC;`;

  try {
    const { rows } = await pool.query(query, params);
    console.log(`Fetched ${rows.length} price records for brand: ${brandName}${categoryId ? ` in category ${categoryId}` : ''}`);
    res.json(rows);
  } catch (err) {
    console.error(`Error fetching price history for brand ${brandName}:`, err);
    res.status(500).json({ error: 'Failed to fetch price history' });
  }
});

export default router; 