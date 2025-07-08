import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// GET price history for a specific model (optionally filtered by category)
router.get('/:modelName/prices', async (req, res) => {
  const { modelName } = req.params;
  const { categoryId } = req.query; // Optional category filter
  
  let query = `
    SELECT l.price_numeric, l.post_time
    FROM listings l
    JOIN listing_attributes la ON l.id = la.listing_id
  `;
  
  const params = [decodeURIComponent(modelName)];
  
  // Add category filter if provided
  if (categoryId) {
    query += `
    JOIN listing_categories lc ON l.id = lc.listing_id
    WHERE (la.attribute_id = 9 or la.attribute_id = 6)
      AND la.value_text = $1
      AND lc.category_id = $2
      AND l.price_numeric IS NOT NULL
    `;
    params.push(categoryId);
  } else {
    query += `
    WHERE (la.attribute_id = 9 or la.attribute_id = 6)
      AND la.value_text = $1
      AND l.price_numeric IS NOT NULL
    `;
  }
  
  query += `ORDER BY l.post_time ASC;`;

  try {
    const { rows } = await pool.query(query, params);
    console.log(`Fetched ${rows.length} price records for model: ${modelName}${categoryId ? ` in category ${categoryId}` : ''}`);
    res.json(rows);
  } catch (err) {
    console.error(`Error fetching price history for model ${modelName}:`, err);
    res.status(500).json({ error: 'Failed to fetch price history' });
  }
});

export default router;
