#!/usr/bin/env python3
"""
Fully optimized version of the listings upload script, incorporating suggestions for
maximum performance.
"""

import sys
import re
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict

try:
    # Use orjson for a significant speed boost in JSON parsing.
    # If not installed, run: pip install orjson
    import orjson as json
except ImportError:
    print("Warning: `orjson` not found. Falling back to standard `json` module.")
    print("For a significant speed-up, please run: pip install orjson")
    import json

import psycopg2
import psycopg2.extras
from tqdm import tqdm

# --- Configuration ---
DB_URL = 'postgresql://neondb_owner:npg_3oxSkPERbp0I@ep-tiny-cell-abmko6a4-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
SOURCE_JSON_FILE = 'listing_data_new.json'
BATCH_SIZE = 1000  # A balanced batch size

# --- Helper Functions ---

def parse_price(price_str: str) -> Optional[float]:
    """Extracts a numeric price from a formatted string like '1 200 €'."""
    if not price_str:
        return None
    cleaned = re.sub(r'[€$\s]', '', price_str).replace(',', '.')
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None

def pre_populate_common_attributes(cursor: Any) -> None:
    """
    Pre-populate common product attributes using INSERT ... ON CONFLICT for efficiency.
    NOTE: This requires a UNIQUE constraint on the `name_fi` column.
    Run this SQL command on your database:
    `ALTER TABLE product_attributes ADD CONSTRAINT product_attributes_name_fi_key UNIQUE (name_fi);`
    """
    common_attributes = [
        ('Kunto', 'Condition', 'select'),
        ('Merkki', 'Brand', 'text'),
        ('Muisti', 'Memory', 'select'),
        ('Tyyppi', 'Type', 'select'),
        ('Alusta', 'Platform', 'select'),
        ('Näytön koko', 'Screen Size', 'text'),
        ('Väri', 'Color', 'select'),
        ('Malli', 'Model', 'select'),
        ('Processor', 'Processor', 'text'),
        ('Storage', 'Storage', 'text'),
        ('Graphics', 'Graphics', 'text'),
        ('RAM', 'RAM', 'text'),
        ('Operating System', 'Operating System', 'text'),
    ]
    
    print("Pre-populating common attributes...")
    try:
        psycopg2.extras.execute_values(cursor, """
            INSERT INTO product_attributes (name, name_fi, data_type)
            VALUES %s
            ON CONFLICT (name_fi) DO NOTHING
        """, [(name_en, name_fi, data_type) for name_fi, name_en, data_type in common_attributes])
    except psycopg2.errors.UniqueViolation:
        print("Warning: Could not use ON CONFLICT. Ensure a UNIQUE constraint is on `product_attributes.name_fi`.")
        # Fallback to a less efficient method if the constraint is missing
        cursor.execute("SELECT name_fi FROM product_attributes")
        existing_attrs = {row[0] for row in cursor.fetchall()}
        for name_fi, name_en, data_type in common_attributes:
            if name_fi not in existing_attrs:
                cursor.execute(
                    "INSERT INTO product_attributes (name, name_fi, data_type) VALUES (%s, %s, %s)",
                    (name_en, name_fi, data_type)
                )

def build_caches(cursor: Any) -> Tuple[Dict, Dict]:
    """Build lookup caches for categories and attributes."""
    print("Building lookup caches...")
    
    # Category cache: {(name_fi, parent_id): category_id}
    category_cache = {}
    cursor.execute("SELECT id, name_fi, parent_id FROM categories")
    for cat_id, name_fi, parent_id in cursor.fetchall():
        category_cache[(name_fi, parent_id)] = cat_id
    
    # Attribute cache: {name_fi: attribute_id}
    attribute_cache = {}
    cursor.execute("SELECT id, name_fi FROM product_attributes")
    for attr_id, name_fi in cursor.fetchall():
        attribute_cache[name_fi] = attr_id
    
    return category_cache, attribute_cache

def get_existing_listing_ids(cursor: Any) -> set:
    """Get all existing listing IDs to avoid duplicates."""
    print("Loading existing listing IDs...")
    cursor.execute("SELECT listing_id FROM listings")
    return {row[0] for row in cursor.fetchall()}

def prepare_listing_batch(listings_batch: List[Dict], existing_ids: set) -> Tuple[List, List, List]:
    """Prepare a batch of listings for bulk insert."""
    listings_data = []
    categories_data = []
    attributes_data = []
    
    for listing in listings_batch:
        listing_id = listing.get('listing_id')
        if not listing_id or listing_id in existing_ids:
            continue
            
        price_str = listing.get('price', '')
        price_numeric = parse_price(price_str if price_str is not None else '')
        post_time = listing.get('post_time')
        
        if post_time:
            try:
                post_time = datetime.fromisoformat(post_time.replace(' UTC', '+00:00'))
            except (ValueError, TypeError):
                post_time = None
        
        # This correctly creates a list of tuples, which is the required format
        # for execute_values and executemany.
        listings_data.append((
            listing_id,
            listing.get('title', ''),
            listing.get('description', ''),
            price_str,
            price_numeric,
            listing.get('url', ''),
            listing.get('is_sold', False),
            listing.get('status', 'active'),
            post_time
        ))
        
        categories = listing.get('categories', [])
        if categories:
            for i, category_name_fi in enumerate(categories):
                categories_data.append((listing_id, category_name_fi, i))
        
        details = listing.get('details', {})
        for attr_name_fi, attr_value in details.items():
            if attr_name_fi and attr_value:
                attributes_data.append((listing_id, attr_name_fi, str(attr_value)))
    
    return listings_data, categories_data, attributes_data

def bulk_insert_listings(cursor: Any, listings_data: List) -> Dict[str, int]:
    """
    Bulk insert listings and return mapping of listing_id to db_id
    using INSERT ... RETURNING for high efficiency.
    """
    if not listings_data:
        return {}
    
    inserted_rows = psycopg2.extras.execute_values(cursor, """
        INSERT INTO listings (
            listing_id, title, description, price_raw, price_numeric, 
            url, is_sold, status, post_time
        ) VALUES %s
        RETURNING id, listing_id
    """, listings_data, fetch=True)
    
    return {listing_id: db_id for db_id, listing_id in inserted_rows}

def bulk_insert_categories(cursor: Any, categories_data: List, listing_id_map: Dict, category_cache: Dict):
    """
    Bulk insert listing categories with optimized hierarchical lookup.
    """
    if not categories_data:
        return

    category_relations = []
    listings_categories = defaultdict(list)
    for listing_id, category_name_fi, level in categories_data:
        if listing_id in listing_id_map:
            listings_categories[listing_id].append((category_name_fi, level))
    
    for listing_id, categories in listings_categories.items():
        db_listing_id = listing_id_map[listing_id]
        categories.sort(key=lambda x: x[1])
        current_parent_id = None
        
        for category_name_fi, level in categories:
            category_key = (category_name_fi, current_parent_id)
            category_id = category_cache.get(category_key)
            
            if category_id:
                category_relations.append((db_listing_id, category_id, level))
                current_parent_id = category_id
            else:
                break
    
    if category_relations:
        psycopg2.extras.execute_values(cursor, """
            INSERT INTO listing_categories (listing_id, category_id, category_level)
            VALUES %s
        """, category_relations)

def bulk_insert_attributes(cursor: Any, attributes_data: List, listing_id_map: Dict, attribute_cache: Dict):
    """
    Bulk insert listing attributes with optimized handling of new attributes.
    This version uses a single-pass approach and bulk-creates any new attributes found.
    """
    if not attributes_data:
        return

    attribute_relations = []
    missing_attributes_map = defaultdict(list)
    
    for listing_id, attr_name_fi, attr_value in attributes_data:
        if listing_id not in listing_id_map:
            continue
        
        attribute_id = attribute_cache.get(attr_name_fi)
        
        if attribute_id:
            db_listing_id = listing_id_map[listing_id]
            attribute_relations.append((db_listing_id, attribute_id, str(attr_value)))
        else:
            missing_attributes_map[attr_name_fi].append((listing_id, attr_value))

    if missing_attributes_map:
        print(f"Creating {len(missing_attributes_map)} new attributes...")
        
        new_attributes_to_create = [
            (attr_name_fi.replace('ä', 'a').replace('ö', 'o').replace('å', 'a'), attr_name_fi, 'text')
            for attr_name_fi in missing_attributes_map.keys()
        ]
            
        inserted_attrs = psycopg2.extras.execute_values(cursor, """
            INSERT INTO product_attributes (name, name_fi, data_type)
            VALUES %s
            ON CONFLICT (name_fi) DO UPDATE SET name_fi=EXCLUDED.name_fi
            RETURNING id, name_fi
        """, new_attributes_to_create, fetch=True)
        
        for attr_id, name_fi in inserted_attrs:
            attribute_cache[name_fi] = attr_id

        for attr_name_fi, listings_with_attr in missing_attributes_map.items():
            attribute_id = attribute_cache[attr_name_fi]
            for listing_id, attr_value in listings_with_attr:
                db_listing_id = listing_id_map[listing_id]
                attribute_relations.append((db_listing_id, attribute_id, str(attr_value)))

    if attribute_relations:
        psycopg2.extras.execute_values(cursor, """
            INSERT INTO listing_attributes (listing_id, attribute_id, value_text)
            VALUES %s
        """, attribute_relations)

def main():
    """Main script execution with all optimizations."""
    print(f"Reading listings from '{SOURCE_JSON_FILE}'...")
    try:
        # Use orjson for faster loading by reading bytes
        with open(SOURCE_JSON_FILE, 'rb') as f:
            content = f.read()
            # Fallback to standard json if orjson fails or is not present
            all_listings = json.loads(content)
    except FileNotFoundError:
        print(f"❌ Error: Source file '{SOURCE_JSON_FILE}' not found.")
        sys.exit(1)
    except (json.JSONDecodeError, TypeError):
        print("Error decoding JSON. Ensure file is UTF-8 encoded if not using orjson.")
        sys.exit(1)

    print(f"Found {len(all_listings)} listings to process.")

    try:
        with psycopg2.connect(DB_URL) as conn:
            with conn.cursor() as cur:
                print("🔧 Starting setup phase...")
                
                pre_populate_common_attributes(cur)
                print("✅ Attributes pre-populated")
                
                category_cache, attribute_cache = build_caches(cur)
                print(f"✅ Loaded {len(category_cache)} categories and {len(attribute_cache)} attributes")
                
                existing_ids = get_existing_listing_ids(cur)
                print(f"✅ Found {len(existing_ids)} existing listings (will be skipped)")
                
                total_processed = 0
                total_errors = 0
                
                with tqdm(total=len(all_listings), desc="Processing Batches", unit="listing") as pbar:
                    for i in range(0, len(all_listings), BATCH_SIZE):
                        batch = all_listings[i:i + BATCH_SIZE]
                        batch_num = i//BATCH_SIZE + 1
                        
                        try:
                            listings_data, categories_data, attributes_data = prepare_listing_batch(
                                batch, existing_ids
                            )
                            
                            if listings_data:
                                listing_id_map = bulk_insert_listings(cur, listings_data)
                                bulk_insert_categories(cur, categories_data, listing_id_map, category_cache)
                                bulk_insert_attributes(cur, attributes_data, listing_id_map, attribute_cache)
                                
                                existing_ids.update(data[0] for data in listings_data)
                                total_processed += len(listings_data)
                            
                            conn.commit()
                            
                        except Exception as e:
                            print(f"\n❌ Error processing batch {batch_num}: {e}")
                            conn.rollback()
                            total_errors += len(batch)
                        
                        pbar.update(len(batch))
                
                print(f"\n✅ Upload complete!")
                print(f"📊 Processed: {total_processed} listings")
                print(f"⚠️ Errors/Skipped: {total_errors} listings")

    except psycopg2.Error as e:
        print(f"❌ Critical database error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 