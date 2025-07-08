import psycopg2
import sys

DB_URL = 'postgresql://neondb_owner:npg_3oxSkPERbp0I@ep-tiny-cell-abmko6a4-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

# Improved schema SQL (summarized for brevity, can be expanded as needed)
SCHEMA_SQL = '''
-- Drop old tables if they exist
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS related_listings CASCADE;
DROP TABLE IF EXISTS transaction_options CASCADE;
DROP TABLE IF EXISTS condition_details CASCADE;
DROP TABLE IF EXISTS item_history CASCADE;
DROP TABLE IF EXISTS listing_attributes CASCADE;
DROP TABLE IF EXISTS attribute_values CASCADE;
DROP TABLE IF EXISTS product_attributes CASCADE;
DROP TABLE IF EXISTS category_attributes CASCADE;
DROP TABLE IF EXISTS listing_categories CASCADE;
DROP TABLE IF EXISTS listings CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS search_queries CASCADE;

-- Create improved schema (core tables only, add more as needed)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    name_fi VARCHAR,
    slug VARCHAR NOT NULL,
    parent_id INTEGER REFERENCES categories(id),
    level INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    category_path VARCHAR(500),
    item_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE listings (
    id BIGSERIAL PRIMARY KEY,
    listing_id VARCHAR(50) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price_raw VARCHAR(50),
    price_numeric DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'EUR',
    url TEXT,
    is_sold BOOLEAN DEFAULT FALSE,
    sold_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    post_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE listing_categories (
    id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT REFERENCES listings(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id),
    category_level INTEGER NOT NULL,  -- 0=root, 1=subcategory, 2=sub-subcategory
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE attribute_values (
    id SERIAL PRIMARY KEY,
    attribute_id INTEGER REFERENCES product_attributes(id) ON DELETE CASCADE,
    value VARCHAR(255) NOT NULL,
    value_fi VARCHAR(255),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

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

CREATE TABLE category_attributes (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    attribute_id INTEGER REFERENCES product_attributes(id) ON DELETE CASCADE,
    is_required BOOLEAN DEFAULT FALSE,
    is_filterable BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0
);

-- Add indexes for performance
CREATE INDEX idx_listings_listing_id ON listings(listing_id);
CREATE INDEX idx_listings_price ON listings(price_numeric);
CREATE INDEX idx_listings_post_time ON listings(post_time);
CREATE INDEX idx_listings_is_sold ON listings(is_sold);
CREATE INDEX idx_listings_status ON listings(status);

CREATE INDEX idx_listing_categories_listing ON listing_categories(listing_id);
CREATE INDEX idx_listing_categories_category ON listing_categories(category_id);
CREATE UNIQUE INDEX idx_listing_categories_unique ON listing_categories(listing_id, category_id);

CREATE INDEX idx_listing_attributes_listing ON listing_attributes(listing_id);
CREATE INDEX idx_listing_attributes_attribute ON listing_attributes(attribute_id);
CREATE INDEX idx_listing_attributes_value_text ON listing_attributes(value_text);

CREATE UNIQUE INDEX idx_category_attributes_unique ON category_attributes(category_id, attribute_id);

-- Add more tables (item_history, condition_details, etc.) as needed
'''

def main():
    print("Connecting to database...")
    try:
        with psycopg2.connect(DB_URL) as conn:
            with conn.cursor() as cur:
                print("Dropping old tables and creating new schema...")
                cur.execute(SCHEMA_SQL)
                conn.commit()
                print("✅ Database schema initialized successfully.")
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 