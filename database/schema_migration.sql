-- Database Schema Migration Script
-- Price Tracker - Improved Listing Database Layout

-- ================================================
-- 1. CREATE CORE LISTINGS TABLE
-- ================================================

CREATE TABLE listings (
    id BIGSERIAL PRIMARY KEY,
    listing_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    price_raw VARCHAR(50),           -- Original price string "120 €"
    price_numeric DECIMAL(10,2),     -- Parsed numeric value 120.00
    currency VARCHAR(3) DEFAULT 'EUR',
    url VARCHAR(1000),
    is_sold BOOLEAN DEFAULT FALSE,
    sold_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    post_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes
CREATE INDEX idx_listings_listing_id ON listings(listing_id);
CREATE INDEX idx_listings_price ON listings(price_numeric);
CREATE INDEX idx_listings_post_time ON listings(post_time);
CREATE INDEX idx_listings_is_sold ON listings(is_sold);
CREATE INDEX idx_listings_status ON listings(status);

-- ================================================
-- 2. IMPROVE EXISTING CATEGORIES TABLE
-- ================================================

-- Add new columns to existing categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS category_path VARCHAR(500);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS full_name_en VARCHAR(500);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS item_count INTEGER DEFAULT 0;

-- Add new indexes
CREATE INDEX IF NOT EXISTS idx_categories_path ON categories(category_path);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_level ON categories(level);

-- ================================================
-- 3. LISTING-CATEGORY RELATIONSHIP TABLE
-- ================================================

CREATE TABLE listing_categories (
    id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT REFERENCES listings(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id),
    category_level INTEGER NOT NULL,  -- 0=root, 1=subcategory, 2=sub-subcategory
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_listing_categories_listing ON listing_categories(listing_id);
CREATE INDEX idx_listing_categories_category ON listing_categories(category_id);
CREATE UNIQUE INDEX idx_listing_categories_unique ON listing_categories(listing_id, category_id);

-- ================================================
-- 4. DYNAMIC PRODUCT ATTRIBUTES (EAV PATTERN)
-- ================================================

-- Attribute definitions
CREATE TABLE product_attributes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    name_fi VARCHAR(100),
    data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('text', 'integer', 'decimal', 'boolean', 'select')),
    is_required BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Predefined attribute values for select types
CREATE TABLE attribute_values (
    id SERIAL PRIMARY KEY,
    attribute_id INTEGER REFERENCES product_attributes(id) ON DELETE CASCADE,
    value VARCHAR(255) NOT NULL,
    value_fi VARCHAR(255),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- Listing attribute values
CREATE TABLE listing_attributes (
    id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT REFERENCES listings(id) ON DELETE CASCADE,
    attribute_id INTEGER REFERENCES product_attributes(id),
    value_text VARCHAR(500),
    value_integer INTEGER,
    value_decimal DECIMAL(15,4),
    value_boolean BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_listing_attributes_listing ON listing_attributes(listing_id);
CREATE INDEX idx_listing_attributes_attribute ON listing_attributes(attribute_id);
CREATE INDEX idx_listing_attributes_value_text ON listing_attributes(value_text);

-- ================================================
-- 5. CATEGORY-ATTRIBUTE RELATIONSHIPS
-- ================================================

CREATE TABLE category_attributes (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    attribute_id INTEGER REFERENCES product_attributes(id) ON DELETE CASCADE,
    is_required BOOLEAN DEFAULT FALSE,
    is_filterable BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX idx_category_attributes_unique ON category_attributes(category_id, attribute_id);

-- ================================================
-- 6. POPULATE INITIAL DATA
-- ================================================

-- Insert product attributes based on analysis
INSERT INTO product_attributes (name, name_fi, data_type, sort_order) VALUES
('Kunto', 'Kunto', 'select', 1),
('Merkki', 'Merkki', 'text', 2),
('Tyyppi', 'Tyyppi', 'select', 3),
('Alusta', 'Alusta', 'select', 4),
('Näytön koko', 'Näytön koko', 'text', 5),
('Muisti', 'Muisti', 'select', 6),
('Malli', 'Malli', 'select', 7),
('Väri', 'Väri', 'select', 8);

-- Insert Kunto (Condition) values
INSERT INTO attribute_values (attribute_id, value, value_fi, sort_order) 
SELECT id, value, value, sort_order FROM product_attributes 
CROSS JOIN (VALUES 
    ('Uusi', 1),
    ('Kuin uusi', 2),
    ('Hyvä', 3),
    ('Kohtalainen', 4),
    ('Vaatii korjausta', 5)
) AS v(value, sort_order)
WHERE name = 'Kunto';

-- Insert common memory sizes
INSERT INTO attribute_values (attribute_id, value, sort_order)
SELECT id, value, sort_order FROM product_attributes 
CROSS JOIN (VALUES 
    ('16 GB', 1),
    ('32 GB', 2),
    ('64 GB', 3),
    ('128 GB', 4),
    ('256 GB', 5),
    ('512 GB', 6),
    ('1 TB', 7),
    ('Muu', 99)
) AS v(value, sort_order)
WHERE name = 'Muisti';

-- Insert common gaming platforms
INSERT INTO attribute_values (attribute_id, value, sort_order)
SELECT id, value, sort_order FROM product_attributes 
CROSS JOIN (VALUES 
    ('PC', 1),
    ('PlayStation 5', 2),
    ('PlayStation 4', 3),
    ('Xbox Series X/S', 4),
    ('Xbox One', 5),
    ('Nintendo Switch', 6),
    ('Nintendo 3DS', 7),
    ('PlayStation 3', 8),
    ('Xbox 360', 9),
    ('PlayStation 2', 10),
    ('PlayStation 1', 11),
    ('Nintendo 64', 12),
    ('Super Nintendo', 13),
    ('Nintendo 8-bit', 14),
    ('PSP', 15),
    ('PlayStation Vita', 16)
) AS v(value, sort_order)
WHERE name = 'Alusta';

-- ================================================
-- 7. PERFORMANCE OPTIMIZATIONS
-- ================================================

-- Materialized view for popular categories
CREATE MATERIALIZED VIEW popular_categories AS
SELECT 
    c.id,
    c.name,
    c.name_fi,
    c.category_path,
    c.level,
    COUNT(lc.listing_id) as active_listings,
    AVG(l.price_numeric) as avg_price,
    MIN(l.price_numeric) as min_price,
    MAX(l.price_numeric) as max_price
FROM categories c
LEFT JOIN listing_categories lc ON c.id = lc.category_id
LEFT JOIN listings l ON lc.listing_id = l.id AND l.is_sold = FALSE AND l.status = 'active'
GROUP BY c.id, c.name, c.name_fi, c.category_path, c.level
ORDER BY active_listings DESC;

-- Index on materialized view
CREATE UNIQUE INDEX idx_popular_categories_id ON popular_categories(id);

-- Price statistics by category
CREATE MATERIALIZED VIEW category_price_stats AS
SELECT 
    c.id as category_id,
    c.name as category_name,
    c.level,
    COUNT(l.id) as listing_count,
    ROUND(AVG(l.price_numeric), 2) as avg_price,
    ROUND(MIN(l.price_numeric), 2) as min_price,
    ROUND(MAX(l.price_numeric), 2) as max_price,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY l.price_numeric), 2) as median_price,
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY l.price_numeric), 2) as q1_price,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY l.price_numeric), 2) as q3_price
FROM categories c
JOIN listing_categories lc ON c.id = lc.category_id
JOIN listings l ON lc.listing_id = l.id
WHERE l.is_sold = FALSE AND l.price_numeric > 0 AND l.status = 'active'
GROUP BY c.id, c.name, c.level
HAVING COUNT(l.id) >= 5;  -- Only categories with at least 5 listings

CREATE UNIQUE INDEX idx_category_price_stats_id ON category_price_stats(category_id);

-- ================================================
-- 8. UTILITY FUNCTIONS
-- ================================================

-- Function to parse price from string
CREATE OR REPLACE FUNCTION parse_price(price_str TEXT)
RETURNS DECIMAL(10,2) AS $$
BEGIN
    -- Remove currency symbol and spaces, replace comma with dot
    RETURN CAST(
        REGEXP_REPLACE(
            REGEXP_REPLACE(price_str, '[€$£\s]', '', 'g'),
            ',', '.', 'g'
        ) AS DECIMAL(10,2)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to build category path
CREATE OR REPLACE FUNCTION build_category_path(cat_id INTEGER)
RETURNS TEXT AS $$
DECLARE
    path TEXT := '';
    current_id INTEGER := cat_id;
    current_name TEXT;
    parent_id INTEGER;
BEGIN
    LOOP
        SELECT name, parent_id INTO current_name, parent_id 
        FROM categories WHERE id = current_id;
        
        IF current_name IS NULL THEN
            EXIT;
        END IF;
        
        IF path = '' THEN
            path := current_name;
        ELSE
            path := current_name || ' > ' || path;
        END IF;
        
        IF parent_id IS NULL THEN
            EXIT;
        END IF;
        
        current_id := parent_id;
    END LOOP;
    
    RETURN path;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- 9. TRIGGERS FOR AUTOMATIC UPDATES
-- ================================================

-- Update updated_at timestamp on listings
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_listings_updated_at 
    BEFORE UPDATE ON listings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update category item counts
CREATE OR REPLACE FUNCTION update_category_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE categories SET item_count = item_count + 1 WHERE id = NEW.category_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE categories SET item_count = item_count - 1 WHERE id = OLD.category_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_category_count_trigger
    AFTER INSERT OR DELETE ON listing_categories
    FOR EACH ROW 
    EXECUTE FUNCTION update_category_count();

-- ================================================
-- 10. SAMPLE QUERIES FOR TESTING
-- ================================================

-- Example: Find all electronics with price between 50-200€
/*
SELECT l.title, l.price_numeric, c.name as category
FROM listings l
JOIN listing_categories lc ON l.id = lc.listing_id
JOIN categories c ON lc.category_id = c.id
WHERE l.price_numeric BETWEEN 50 AND 200
    AND c.name LIKE '%Elektroniikka%'
    AND l.is_sold = FALSE
ORDER BY l.price_numeric;
*/

-- Example: Find all gaming items with condition "Hyvä"
/*
SELECT l.title, l.price_numeric, av.value as condition
FROM listings l
JOIN listing_attributes la ON l.id = la.listing_id
JOIN product_attributes pa ON la.attribute_id = pa.id
JOIN attribute_values av ON la.value_text = av.value AND av.attribute_id = pa.id
WHERE pa.name = 'Kunto' AND av.value = 'Hyvä'
    AND EXISTS (
        SELECT 1 FROM listing_categories lc 
        JOIN categories c ON lc.category_id = c.id 
        WHERE lc.listing_id = l.id AND c.name LIKE '%Videopelit%'
    )
ORDER BY l.price_numeric;
*/

-- Refresh materialized views (run periodically)
/*
REFRESH MATERIALIZED VIEW popular_categories;
REFRESH MATERIALIZED VIEW category_price_stats;
*/ 