#!/usr/bin/env python3
"""
Example script showing how to import listing data into the improved database schema.
This demonstrates the benefits of the new normalized structure.
"""

import json
import psycopg2
import re
from datetime import datetime
from typing import Dict, List, Optional

# Database connection (update with your credentials)
DB_URL = 'postgresql://neondb_owner:npg_3oxSkPERbp0I@ep-tiny-cell-abmko6a4-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

def parse_price(price_str: str) -> Optional[float]:
    """Extract numeric price from string like '120 €'"""
    if not price_str:
        return None
    
    # Remove currency symbols and spaces, replace comma with dot
    cleaned = re.sub(r'[€$£\s]', '', price_str)
    cleaned = cleaned.replace(',', '.')
    
    try:
        return float(cleaned)
    except ValueError:
        return None

def find_or_create_category(cursor, category_name: str, parent_id: Optional[int] = None, level: int = 0) -> int:
    """Find existing category or create new one, return category ID"""
    
    # Check if category exists
    cursor.execute(
        "SELECT id FROM categories WHERE name = %s AND COALESCE(parent_id, 0) = COALESCE(%s, 0)",
        (category_name, parent_id)
    )
    result = cursor.fetchone()
    
    if result:
        return result[0]
    
    # Create new category
    slug = category_name.lower().replace(' ', '-').replace('ä', 'a').replace('ö', 'o').replace('å', 'a')
    
    cursor.execute("""
        INSERT INTO categories (name, slug, parent_id, level, is_active, updated_at)
        VALUES (%s, %s, %s, %s, TRUE, CURRENT_TIMESTAMP)
        RETURNING id
    """, (category_name, slug, parent_id, level))
    
    category_id = cursor.fetchone()[0]
    
    # Update category path
    if parent_id:
        cursor.execute("SELECT category_path FROM categories WHERE id = %s", (parent_id,))
        parent_path = cursor.fetchone()[0] or ''
        path = f"{parent_path} > {category_name}" if parent_path else category_name
    else:
        path = category_name
    
    cursor.execute(
        "UPDATE categories SET category_path = %s WHERE id = %s",
        (path, category_id)
    )
    
    return category_id

def get_attribute_id(cursor, attribute_name: str) -> Optional[int]:
    """Get attribute ID by name"""
    cursor.execute("SELECT id FROM product_attributes WHERE name = %s", (attribute_name,))
    result = cursor.fetchone()
    return result[0] if result else None

def import_listing(cursor, listing_data: Dict) -> Optional[int]:
    """Import a single listing into the database"""
    
    # Parse price
    price_numeric = parse_price(listing_data.get('price', ''))
    
    # Parse post time
    post_time = None
    if listing_data.get('post_time'):
        try:
            post_time = datetime.fromisoformat(listing_data['post_time'].replace(' UTC', '+00:00'))
        except ValueError:
            pass
    
    # Insert listing
    cursor.execute("""
        INSERT INTO listings (
            listing_id, title, description, price_raw, price_numeric, 
            url, is_sold, status, post_time
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        listing_data['listing_id'],
        listing_data.get('title', ''),
        listing_data.get('description', ''),
        listing_data.get('price', ''),
        price_numeric,
        listing_data.get('url', ''),
        listing_data.get('is_sold', False),
        listing_data.get('status', 'active'),
        post_time
    ))
    
    listing_db_id = cursor.fetchone()[0]
    
    # Handle categories (hierarchical)
    categories = listing_data.get('categories', [])
    if categories:
        parent_id = None
        for level, category_name in enumerate(categories):
            category_id = find_or_create_category(cursor, category_name, parent_id, level)
            
            # Link listing to category
            cursor.execute("""
                INSERT INTO listing_categories (listing_id, category_id, category_level)
                VALUES (%s, %s, %s)
                ON CONFLICT (listing_id, category_id) DO NOTHING
            """, (listing_db_id, category_id, level))
            
            parent_id = category_id
    
    # Handle product attributes (details)
    details = listing_data.get('details', {})
    for attr_name, attr_value in details.items():
        attr_id = get_attribute_id(cursor, attr_name)
        if not attr_id:
            continue  # Skip unknown attributes
        
        # Insert attribute value
        cursor.execute("""
            INSERT INTO listing_attributes (listing_id, attribute_id, value_text)
            VALUES (%s, %s, %s)
        """, (listing_db_id, attr_id, str(attr_value)))
    
    return listing_db_id

def import_listings_from_json(json_file: str, limit: Optional[int] = None):
    """Import listings from JSON file into database"""
    
    with open(json_file, 'r', encoding='utf-8') as f:
        listings = json.load(f)
    
    if limit:
        listings = listings[:limit]
    
    with psycopg2.connect(DB_URL) as conn:
        with conn.cursor() as cursor:
            imported_count = 0
            skipped_count = 0
            
            for listing in listings:
                try:
                    # Check if listing already exists
                    cursor.execute(
                        "SELECT id FROM listings WHERE listing_id = %s",
                        (listing['listing_id'],)
                    )
                    if cursor.fetchone():
                        skipped_count += 1
                        continue
                    
                    listing_id = import_listing(cursor, listing)
                    if listing_id:
                        imported_count += 1
                        if imported_count % 100 == 0:
                            print(f"Imported {imported_count} listings...")
                            conn.commit()  # Commit periodically
                    
                except Exception as e:
                    print(f"Error importing listing {listing.get('listing_id', 'unknown')}: {e}")
                    conn.rollback()
            
            conn.commit()
            print(f"\nImport complete!")
            print(f"Imported: {imported_count} listings")
            print(f"Skipped: {skipped_count} listings (already exist)")

def analyze_imported_data():
    """Run some analysis queries on the imported data"""
    
    with psycopg2.connect(DB_URL) as conn:
        with conn.cursor() as cursor:
            
            # Basic statistics
            cursor.execute("SELECT COUNT(*) FROM listings")
            result = cursor.fetchone()
            total_listings = result[0] if result else 0
            
            cursor.execute("SELECT COUNT(*) FROM categories")
            result = cursor.fetchone()
            total_categories = result[0] if result else 0
            
            cursor.execute("SELECT COUNT(DISTINCT attribute_id) FROM listing_attributes")
            result = cursor.fetchone()
            used_attributes = result[0] if result else 0
            
            print(f"\n=== Database Statistics ===")
            print(f"Total listings: {total_listings}")
            print(f"Total categories: {total_categories}")
            print(f"Used attributes: {used_attributes}")
            
            # Price statistics
            cursor.execute("""
                SELECT 
                    MIN(price_numeric) as min_price,
                    MAX(price_numeric) as max_price,
                    AVG(price_numeric) as avg_price,
                    COUNT(*) as priced_items
                FROM listings 
                WHERE price_numeric > 0
            """)
            
            price_stats = cursor.fetchone()
            print(f"\n=== Price Statistics ===")
            if price_stats and price_stats[3] > 0:
                min_price, max_price, avg_price, priced_items = price_stats
                print(f"Items with prices: {priced_items}")
                print(f"Price range: {min_price}€ - {max_price}€")
                print(f"Average price: {avg_price:.2f}€")
            else:
                print("No items with valid prices found")
            
            # Top categories
            cursor.execute("""
                SELECT c.name, c.level, COUNT(lc.listing_id) as item_count
                FROM categories c
                LEFT JOIN listing_categories lc ON c.id = lc.category_id
                GROUP BY c.id, c.name, c.level
                HAVING COUNT(lc.listing_id) > 0
                ORDER BY item_count DESC
                LIMIT 10
            """)
            
            print(f"\n=== Top Categories ===")
            results = cursor.fetchall()
            if results:
                for name, level, count in results:
                    indent = "  " * level
                    print(f"{indent}{name}: {count} items")
            else:
                print("No categories found")

if __name__ == "__main__":
    # Example usage
    print("Starting listing import...")
    
    # Import first 50 listings as example
    import_listings_from_json('listing_data_1000_items.json', limit=50)
    
    # Analyze the imported data
    analyze_imported_data()
    
    print("\nDone! Check your database for the imported data.")
    print("\nTo refresh materialized views, run:")
    print("REFRESH MATERIALIZED VIEW popular_categories;")
    print("REFRESH MATERIALIZED VIEW category_price_stats;") 