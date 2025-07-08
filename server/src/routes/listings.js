import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// Get all listings
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;
    
    let selectClause = 'SELECT id, created_at, title, price_numeric, currency, status';
    let fromClause = 'FROM listings';
    let whereClause = 'WHERE status = \'success\'';
    let orderByClause = 'ORDER BY created_at DESC';
    let queryParams = [];

    if (search) {
      // Use '&' (AND) for a strict search, with prefix matching on the last term.
      const terms = search.trim().split(/\s+/).filter(Boolean);
      if (terms.length > 0) {
        const lastTerm = terms.pop();
        // Manually quote each term to handle special characters and numbers safely,
        // then join with the AND operator.
        const tsQueryString = terms.map(term => `'${term}'`).concat(`'${lastTerm}':*`).join(' & ');
        const tsQuery = `to_tsquery('finnish', $1)`;

        queryParams.push(tsQueryString);
        whereClause = `WHERE tsv @@ ${tsQuery}`;
        // Ranking is not needed for a strict AND search, so we keep the default ordering.
      }
    }
    // Get all listings
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search, categoryId } = req.query; // Add categoryId
    const offset = (page - 1) * limit;

    let selectClause = 'SELECT id, created_at, title, price_numeric, currency, status';
    let fromClause = 'FROM listings';
    let whereClauses = ["status = 'success'"]; // Start with the base filter
    let orderByClause = 'ORDER BY created_at DESC';
    let queryParams = [];

    if (search) {
      const terms = search.trim().split(/\s+/).filter(Boolean);
      if (terms.length > 0) {
        const lastTerm = terms.pop();
        const tsQueryString = terms.map(term => `'${term}'`).concat(`'${lastTerm}':*`).join(' & ');
        queryParams.push(tsQueryString);
        whereClauses.push(`tsv @@ to_tsquery('finnish', $${queryParams.length})`);
      }
    }

    if (categoryId) {
      // This subquery finds all listings that belong to the specified category OR any of its children
      const categorySubQuery = `
        id IN (
          SELECT lc.listing_id FROM listing_categories lc
          WHERE lc.category_id IN (
            WITH RECURSIVE category_tree AS (
                SELECT id FROM categories WHERE id = $${queryParams.length + 1}
                UNION ALL
                SELECT c.id FROM categories c JOIN category_tree ct ON c.parent_id = ct.id
            )
            SELECT id FROM category_tree
          )
        )
      `;
      queryParams.push(categoryId);
      whereClauses.push(categorySubQuery);
    }

    const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) ${fromClause} ${whereClause}`;
    const countResult = await pool.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);

    // Get the actual listings with all clauses
    const listingsQuery = `${selectClause} ${fromClause} ${whereClause} ${orderByClause} LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    const listingsResult = await pool.query(listingsQuery, [...queryParams, limit, offset]);

    res.json({
      listings: listingsResult.rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching listings:', err);
    res.status(500).json({
      error: 'Failed to fetch listings',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});
    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) ${fromClause} ${whereClause}`;
    const countResult = await pool.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);
    
    // Get the actual listings with all clauses
    const listingsQuery = `${selectClause} ${fromClause} ${whereClause} ${orderByClause} LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    const listingsResult = await pool.query(listingsQuery, [...queryParams, limit, offset]);
    console.log(listingsResult);
    res.json({
      listings: listingsResult.rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching listings:', err);
    res.status(500).json({ 
      error: 'Failed to fetch listings',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// Get single listing by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid listing ID' });
    }
    
    const { rows } = await pool.query('SELECT * FROM listings WHERE id = $1', [id]);
    console.log(rows);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching listing:', err);
    res.status(500).json({ 
      error: 'Failed to fetch listing',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

export default router; 