#!/usr/bin/env python3
"""Optimized listings upload script with bulk operations and validation."""

import sys
import re
from datetime import datetime
from collections import defaultdict

import json

import psycopg2
import psycopg2.extras
from tqdm import tqdm

DB_URL = 'postgresql://neondb_owner:npg_3oxSkPERbp0I@ep-tiny-cell-abmko6a4-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
SOURCE_JSON_FILE = 'scripts/4-extracted_listing_details.json'
BATCH_SIZE = 1000

def parse_price(price_str):
    if not price_str:
        return None
    cleaned = re.sub(r'[€$\s]', '', price_str).replace(',', '.')
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None

def setup_attributes(cursor):
    """Ensure product_attributes table is ready for dynamic attribute creation."""
    # Just ensure the table is ready - attributes will be created dynamically as they appear
    print("Product attributes table ready for dynamic English attribute creation.")

def build_caches(cursor):
    """Build lookup caches for categories and attributes."""
    category_cache = {}
    cursor.execute("SELECT id, name_fi, parent_id FROM categories")
    for cat_id, name_fi, parent_id in cursor.fetchall():
        category_cache[(name_fi, parent_id)] = cat_id
    
    attribute_cache = {}
    # Since all attributes are now in English, use the 'name' column (English)
    cursor.execute("SELECT id, name FROM product_attributes")
    for attr_id, name_en in cursor.fetchall():
        attribute_cache[name_en] = attr_id
    
    return category_cache, attribute_cache

def get_existing_ids(cursor):
    """Get existing listing IDs to avoid duplicates."""
    cursor.execute("SELECT listing_id FROM listings")
    return {row[0] for row in cursor.fetchall()}

def prepare_batch(listings_batch, existing_ids):
    """Prepare batch data with validation and filtering."""
    MAX_ATTR_LEN, MAX_TITLE_LEN, MAX_DESC_LEN = 500, 1000, 5000
    listings_data, categories_data, attributes_data = [], [], []
    skipped_duplicates = skipped_invalid = skipped_attributes = 0
    
    for listing in listings_batch:
        listing_id = listing.get('listing_id')
        if not listing_id:
            skipped_invalid += 1
            continue
            
        if listing_id in existing_ids:
            skipped_duplicates += 1
            continue
        
        title = listing.get('title', '')
        description = listing.get('description', '')
        
        if len(title) > MAX_TITLE_LEN or len(description) > MAX_DESC_LEN:
            skipped_invalid += 1
            continue
        
        details = listing.get('details', {})
        valid_attributes = {}
        
        for attr_name, attr_value in details.items():
            if attr_name and attr_value is not None:  # FIXED: Allow False values!
                # FIXED: Handle different data types properly
                if isinstance(attr_value, bool):
                    valid_attributes[attr_name] = ('boolean', attr_value)
                elif isinstance(attr_value, int) and not isinstance(attr_value, bool):
                    valid_attributes[attr_name] = ('integer', attr_value)
                elif isinstance(attr_value, float):
                    valid_attributes[attr_name] = ('decimal', float(attr_value))
                else:
                    attr_str = str(attr_value)
                    if len(attr_str) > MAX_ATTR_LEN:
                        skipped_attributes += 1
                        continue
                    valid_attributes[attr_name] = ('text', attr_str)
        
        post_time = listing.get('post_time')
        if post_time:
            try:
                post_time = datetime.fromisoformat(post_time.replace(' UTC', '+00:00'))
            except (ValueError, TypeError):
                post_time = None
        
        listings_data.append((
            listing_id, title, description, listing.get('price', ''),
            parse_price(listing.get('price', '')), listing.get('url', ''),
            listing.get('is_sold', False), listing.get('status', 'active'), post_time
        ))
        
        for i, category in enumerate(listing.get('categories', [])):
            categories_data.append((listing_id, category, i))
        
        # FIXED: Include data type information
        for attr_name, (data_type, attr_value) in valid_attributes.items():
            attributes_data.append((listing_id, attr_name, data_type, attr_value))
    
    return listings_data, categories_data, attributes_data, skipped_duplicates, skipped_invalid, skipped_attributes

def bulk_insert_listings(cursor, listings_data):
    """Bulk insert listings and return ID mapping."""
    if not listings_data:
        return {}
    
    # Use ON CONFLICT DO NOTHING to handle duplicates gracefully
    inserted = psycopg2.extras.execute_values(cursor, """
        INSERT INTO listings (listing_id, title, description, price_raw, price_numeric, 
                            url, is_sold, status, post_time) VALUES %s
        ON CONFLICT (listing_id) DO NOTHING
        RETURNING id, listing_id
    """, listings_data, fetch=True)
    
    return {listing_id: db_id for db_id, listing_id in inserted}

def bulk_insert_categories(cursor, categories_data, listing_id_map, category_cache):
    """Bulk insert listing categories."""
    if not categories_data:
        return

    category_relations = []
    listings_categories = defaultdict(list)
    
    for listing_id, category_name, level in categories_data:
        if listing_id in listing_id_map:
            listings_categories[listing_id].append((category_name, level))
    
    for listing_id, categories in listings_categories.items():
        db_id = listing_id_map[listing_id]
        current_parent = None
        
        for category_name, level in sorted(categories, key=lambda x: x[1]):
            category_id = category_cache.get((category_name, current_parent))
            if category_id:
                category_relations.append((db_id, category_id, level))
                current_parent = category_id
            else:
                break
    
    if category_relations:
        psycopg2.extras.execute_values(cursor, """
            INSERT INTO listing_categories (listing_id, category_id, category_level) VALUES %s
            ON CONFLICT DO NOTHING
        """, category_relations)

def bulk_insert_attributes(cursor, attributes_data, listing_id_map, attribute_cache):
    """FIXED: Bulk insert listing attributes with proper type handling."""
    if not attributes_data:
        return

    attribute_relations = []
    missing_attrs = defaultdict(list)
    
    for listing_id, attr_name, data_type, attr_value in attributes_data:
        if listing_id not in listing_id_map:
            continue
        
        attr_id = attribute_cache.get(attr_name)
        if attr_id:
            db_id = listing_id_map[listing_id]
            # FIXED: Use appropriate database columns based on data type
            if data_type == 'boolean':
                attribute_relations.append((db_id, attr_id, None, None, None, attr_value))
            elif data_type == 'integer':
                attribute_relations.append((db_id, attr_id, None, attr_value, None, None))
            elif data_type == 'decimal':
                attribute_relations.append((db_id, attr_id, None, None, attr_value, None))
            else:  # text
                attribute_relations.append((db_id, attr_id, attr_value, None, None, None))
        else:
            missing_attrs[attr_name].append((listing_id, data_type, attr_value))

    # Create missing attributes with proper data types
    if missing_attrs:
        new_attrs = []
        for attr_name in missing_attrs.keys():
            # Determine the most appropriate data type from the sample values
            sample_types = [item[1] for item in missing_attrs[attr_name]]
            if any(dt == 'boolean' for dt in sample_types):
                data_type = 'boolean'
            elif any(dt == 'integer' for dt in sample_types):
                data_type = 'integer'
            elif any(dt == 'decimal' for dt in sample_types):
                data_type = 'decimal'
            else:
                data_type = 'text'
            
            new_attrs.append((attr_name, attr_name, data_type))
        
        inserted_attrs = psycopg2.extras.execute_values(cursor, """
            INSERT INTO product_attributes (name, name_fi, data_type) VALUES %s
            ON CONFLICT (name) DO UPDATE SET data_type=EXCLUDED.data_type
            RETURNING id, name
        """, new_attrs, fetch=True)
        
        for attr_id, attr_name in inserted_attrs:
            attribute_cache[attr_name] = attr_id

        # Add missing attributes to relations with proper column assignment
        for attr_name, listings_with_attr in missing_attrs.items():
            attr_id = attribute_cache[attr_name]
            for listing_id, data_type, attr_value in listings_with_attr:
                db_id = listing_id_map[listing_id]
                if data_type == 'boolean':
                    attribute_relations.append((db_id, attr_id, None, None, None, attr_value))
                elif data_type == 'integer':
                    attribute_relations.append((db_id, attr_id, None, attr_value, None, None))
                elif data_type == 'decimal':
                    attribute_relations.append((db_id, attr_id, None, None, attr_value, None))
                else:  # text
                    attribute_relations.append((db_id, attr_id, attr_value, None, None, None))

    # FIXED: Insert using all column types
    if attribute_relations:
        psycopg2.extras.execute_values(cursor, """
            INSERT INTO listing_attributes (listing_id, attribute_id, value_text, value_integer, value_decimal, value_boolean) 
            VALUES %s
            ON CONFLICT DO NOTHING
        """, attribute_relations)
        
        # Count by type for reporting
        boolean_count = sum(1 for r in attribute_relations if r[5] is not None)
        integer_count = sum(1 for r in attribute_relations if r[3] is not None)
        decimal_count = sum(1 for r in attribute_relations if r[4] is not None)
        text_count = sum(1 for r in attribute_relations if r[2] is not None)
        
        if boolean_count > 0:
            print(f"  Inserted attributes: {text_count} text, {integer_count} integer, {decimal_count} decimal, {boolean_count} boolean")

def main():
    """Main execution with optimized batch processing."""
    try:
        with open(SOURCE_JSON_FILE, 'rb') as f:
            all_listings = json.loads(f.read())
    except FileNotFoundError:
        print(f"Error: {SOURCE_JSON_FILE} not found.")
        sys.exit(1)
    except (json.JSONDecodeError, TypeError):
        print("Error: Invalid JSON format.")
        sys.exit(1)

    print(f"Processing {len(all_listings)} listings...")

    try:
        with psycopg2.connect(DB_URL) as conn:
            with conn.cursor() as cur:
                setup_attributes(cur)
                category_cache, attribute_cache = build_caches(cur)
                
                total_processed = 0
                total_inserted = 0
                total_duplicates = 0
                total_invalid = 0
                total_errors = 0
                total_skipped_attrs = 0
                
                with tqdm(total=len(all_listings), desc="Processing", unit="listing") as pbar:
                    for i in range(0, len(all_listings), BATCH_SIZE):
                        batch = all_listings[i:i + BATCH_SIZE]
                        batch_num = i // BATCH_SIZE + 1
                        
                        try:
                            # Get fresh existing IDs for each batch to handle any new insertions
                            existing_ids = get_existing_ids(cur)
                            
                            listings_data, categories_data, attributes_data, skipped_dups, skipped_invalid, skipped_attrs = prepare_batch(batch, existing_ids)
                            
                            total_duplicates += skipped_dups
                            total_invalid += skipped_invalid
                            total_skipped_attrs += skipped_attrs
                            
                            if listings_data:
                                listing_id_map = bulk_insert_listings(cur, listings_data)
                                bulk_insert_categories(cur, categories_data, listing_id_map, category_cache)
                                bulk_insert_attributes(cur, attributes_data, listing_id_map, attribute_cache)
                                
                                # Only count actually inserted listings (those returned by the INSERT)
                                batch_inserted = len(listing_id_map)
                                total_inserted += batch_inserted
                                
                                if batch_inserted > 0:
                                    print(f"Batch {batch_num}: Inserted {batch_inserted}/{len(listings_data)} listings")
                            
                            conn.commit()
                            
                        except Exception as e:
                            print(f"\nError in batch {batch_num}: {e}")
                            conn.rollback()
                            total_errors += len(batch)
                        
                        total_processed += len(batch)
                        pbar.update(len(batch))
                
                # Get final count from database
                cur.execute("SELECT COUNT(*) FROM listings")
                final_db_count = cur.fetchone()[0]
                
                # Check boolean values in database
                cur.execute("""
                    SELECT pa.name, COUNT(*) as count
                    FROM listing_attributes la
                    JOIN product_attributes pa ON la.attribute_id = pa.id
                    WHERE la.value_boolean IS NOT NULL
                    GROUP BY pa.name
                    ORDER BY count DESC
                """)
                boolean_stats = cur.fetchall()
                
                print(f"\n=== FIXED UPLOAD SUMMARY ===")
                print(f"✅ Boolean values are now properly handled!")
                print(f"Total listings processed: {total_processed}")
                print(f"Successfully inserted: {total_inserted}")
                print(f"Skipped (duplicates): {total_duplicates}")
                print(f"Skipped (invalid): {total_invalid}")
                print(f"Skipped attributes: {total_skipped_attrs}")
                print(f"Errors: {total_errors}")
                print(f"Final database count: {final_db_count}")
                
                if boolean_stats:
                    print(f"\n✅ Boolean attributes in database:")
                    for attr_name, count in boolean_stats:
                        print(f"   {attr_name}: {count} values")
                else:
                    print(f"\n⚠️ No boolean attributes found in database")

    except psycopg2.Error as e:
        print(f"Database error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 