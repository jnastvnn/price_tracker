-- Query performance indexes for grouped listings endpoints.
-- Run these on the production database as a privileged user.
-- Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lc_category_listing
ON listing_categories (category_id, listing_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_la_attr_listing_text_not_null
ON listing_attributes (attribute_id, listing_id, value_text)
WHERE value_text IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_success_price_not_null
ON listings (id, price_numeric)
WHERE status = 'success' AND price_numeric IS NOT NULL;

ANALYZE listing_categories;
ANALYZE listing_attributes;
ANALYZE listings;
