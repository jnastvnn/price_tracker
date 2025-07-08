import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// GET all level 1 categories
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name FROM categories WHERE level = 1 ORDER BY sort_order ASC, name ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching level 1 categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET category details by ID
router.get('/:id', async (req, res) => {
  const { id: categoryId } = req.params;

  try {
    const { rows } = await pool.query(
      "SELECT id, name, name_fi, level, parent_id FROM categories WHERE id = $1",
      [categoryId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching category details:', err);
    res.status(500).json({ error: 'Failed to fetch category details' });
  }
});

// GET subcategories for a given category
router.get('/:id/subcategories', async (req, res) => {
  const { id: categoryId } = req.params;

  try {
    const { rows } = await pool.query(
      "SELECT id, name, name_fi FROM categories WHERE parent_id = $1 ORDER BY sort_order ASC, name ASC",
      [categoryId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching subcategories:', err);
    res.status(500).json({ error: 'Failed to fetch subcategories' });
  }
});

// GET all models and their average price for a given category
router.get('/:id/models', async (req, res) => {
  const { id: categoryId } = req.params;

  const query = `
    SELECT
      la.value_text AS model,
      COUNT(l.id) AS listing_count,
      AVG(l.price_numeric) AS average_price
    FROM listings l
    JOIN listing_categories lc ON l.id = lc.listing_id
    JOIN listing_attributes la ON l.id = la.listing_id
    WHERE
      lc.category_id = $1
      AND (la.attribute_id = 9 or la.attribute_id = 6) -- Corresponds to the 'Model' attribute
      AND l.status = 'success'
      AND l.price_numeric IS NOT NULL
    GROUP BY la.value_text
    ORDER BY model ASC;
  `;

  try {
    const { rows } = await pool.query(query, [categoryId]);
    console.log(rows);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching models for category:', err);
    res.status(500).json({ error: 'Failed to fetch model data' });
  }
});

// GET all brands and their average price for a given category
router.get('/:id/brands', async (req, res) => {
  const { id: categoryId } = req.params;

  const query = `
    SELECT
      la.value_text AS brand,
      COUNT(l.id) AS listing_count,
      AVG(l.price_numeric) AS average_price
    FROM listings l
    JOIN listing_categories lc ON l.id = lc.listing_id
    JOIN listing_attributes la ON l.id = la.listing_id
    WHERE
      lc.category_id = $1
      AND la.attribute_id = 3 -- Corresponds to the 'Merkki' (Brand) attribute
      AND l.status = 'success'
      AND l.price_numeric IS NOT NULL
    GROUP BY la.value_text
    ORDER BY brand ASC;
  `;

  try {
    const { rows } = await pool.query(query, [categoryId]);
    console.log(`Fetched ${rows.length} brands for category ${categoryId}`);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching brands for category:', err);
    res.status(500).json({ error: 'Failed to fetch brand data' });
  }
});

export default router;