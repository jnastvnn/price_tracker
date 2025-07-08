# Database Schema Analysis & Recommendations

## Current Schema Analysis

### Existing Categories Table
```sql
CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    name VARCHAR NOT NULL,
    name_fi VARCHAR,
    slug VARCHAR NOT NULL,
    parent_id INTEGER REFERENCES categories(id),
    level INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Listing Data Analysis Results

- **Total listings analyzed**: 1,000
- **Unique categories**: 64
- **Category combinations**: 62 unique hierarchical paths
- **Detail field types**: 8 (Kunto, Merkki, Tyyppi, Alusta, Näytön koko, Muisti, Malli, Väri)
- **Price range**: 1€ - 990€ (median: 40€)
- **Category depth**: 2-3 levels (e.g., "Elektroniikka ja kodinkoneet > Tietotekniikka > Oheislaitteet")

## Recommended Database Schema

### 1. Core Listings Table
```sql
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

-- Indexes for performance
CREATE INDEX idx_listings_listing_id ON listings(listing_id);
CREATE INDEX idx_listings_price ON listings(price_numeric);
CREATE INDEX idx_listings_post_time ON listings(post_time);
CREATE INDEX idx_listings_is_sold ON listings(is_sold);
```

### 2. Improved Categories Table
```sql
-- Keep existing structure but add improvements
ALTER TABLE categories ADD COLUMN category_path VARCHAR(500);
ALTER TABLE categories ADD COLUMN full_name_en VARCHAR(500);
ALTER TABLE categories ADD COLUMN item_count INTEGER DEFAULT 0;

-- Update to include materialized path for better querying
CREATE INDEX idx_categories_path ON categories(category_path);
CREATE INDEX idx_categories_parent ON categories(parent_id);
```

### 3. Listing-Category Relationship
```sql
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
```

### 4. Dynamic Product Attributes (EAV Pattern)
```sql
-- Attribute definitions
CREATE TABLE product_attributes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_fi VARCHAR(100),
    data_type VARCHAR(20) NOT NULL, -- 'text', 'integer', 'decimal', 'boolean', 'select'
    is_required BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Predefined attribute values for select types
CREATE TABLE attribute_values (
    id SERIAL PRIMARY KEY,
    attribute_id INTEGER REFERENCES product_attributes(id),
    value VARCHAR(255) NOT NULL,
    value_fi VARCHAR(255),
    sort_order INTEGER DEFAULT 0
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
```

### 5. Category-Attribute Relationships
```sql
-- Define which attributes are applicable to which categories
CREATE TABLE category_attributes (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id),
    attribute_id INTEGER REFERENCES product_attributes(id),
    is_required BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX idx_category_attributes_unique ON category_attributes(category_id, attribute_id);
```

## Data Migration Strategy

### 1. Populate Product Attributes
```sql
INSERT INTO product_attributes (name, name_fi, data_type) VALUES
('Kunto', 'Kunto', 'select'),
('Merkki', 'Merkki', 'text'),
('Tyyppi', 'Tyyppi', 'select'),
('Alusta', 'Alusta', 'select'),
('Näytön koko', 'Näytön koko', 'text'),
('Muisti', 'Muisti', 'select'),
('Malli', 'Malli', 'select'),
('Väri', 'Väri', 'select');
```

### 2. Populate Attribute Values for Select Types
```sql
-- Kunto values
INSERT INTO attribute_values (attribute_id, value, sort_order) 
SELECT id, unnest(ARRAY['Uusi', 'Kuin uusi', 'Hyvä', 'Kohtalainen', 'Vaatii korjausta']), 
       unnest(ARRAY[1, 2, 3, 4, 5])
FROM product_attributes WHERE name = 'Kunto';
```

## Performance Optimizations

### 1. Materialized Views for Common Queries
```sql
-- Popular categories with item counts
CREATE MATERIALIZED VIEW popular_categories AS
SELECT c.id, c.name, c.category_path, COUNT(lc.listing_id) as item_count
FROM categories c
LEFT JOIN listing_categories lc ON c.id = lc.category_id
LEFT JOIN listings l ON lc.listing_id = l.id AND l.is_sold = FALSE
GROUP BY c.id, c.name, c.category_path
ORDER BY item_count DESC;

-- Price statistics by category
CREATE MATERIALIZED VIEW category_price_stats AS
SELECT 
    c.id as category_id,
    c.name as category_name,
    COUNT(l.id) as listing_count,
    AVG(l.price_numeric) as avg_price,
    MIN(l.price_numeric) as min_price,
    MAX(l.price_numeric) as max_price,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY l.price_numeric) as median_price
FROM categories c
JOIN listing_categories lc ON c.id = lc.category_id
JOIN listings l ON lc.listing_id = l.id
WHERE l.is_sold = FALSE AND l.price_numeric > 0
GROUP BY c.id, c.name;
```

### 2. Partitioning Strategy
```sql
-- Partition listings by post_time for better performance
CREATE TABLE listings_partitioned (
    LIKE listings INCLUDING ALL
) PARTITION BY RANGE (post_time);

-- Create monthly partitions
CREATE TABLE listings_2025_01 PARTITION OF listings_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

## Key Improvements

1. **Normalized Price Storage**: Separate raw and numeric price for reliable sorting/filtering
2. **Flexible Attribute System**: EAV pattern handles dynamic product attributes
3. **Hierarchical Categories**: Proper parent-child relationships with materialized paths
4. **Performance Indexes**: Strategic indexes for common query patterns
5. **Data Integrity**: Foreign key constraints and proper data types
6. **Scalability**: Partitioning strategy for large datasets
7. **Analytics Support**: Materialized views for common aggregations

## Migration Steps

1. Create new tables alongside existing schema
2. Migrate category data and build hierarchical relationships
3. Import listing data with proper price parsing
4. Map existing detail fields to the new attribute system
5. Create materialized views and indexes
6. Test performance and adjust as needed
7. Switch application to use new schema 