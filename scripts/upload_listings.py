#!/usr/bin/env python3
"""
Reads listing data from a JSON file and uploads it to the database,
handling hierarchical categories and dynamic product attributes.
Includes a progress bar and robust error handling.
"""

import json
import psycopg2
import sys
import re
from datetime import datetime
from typing import Dict, List, Optional, Any
from tqdm import tqdm

# --- Configuration ---
DB_URL = 'postgresql://neondb_owner:npg_3oxSkPERbp0I@ep-tiny-cell-abmko6a4-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
SOURCE_JSON_FILE = 'listing_data.json'

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

def get_category_id(cursor: Any, name_fi: str, parent_id: Optional[int] = None) -> Optional[int]:
    """Retrieves a category ID by its Finnish name and parent ID."""
    query = "SELECT id FROM categories WHERE name_fi = %s"
    params: List[Any] = [name_fi]
    if parent_id is None:
        query += " AND parent_id IS NULL"
    else:
        query += " AND parent_id = %s"
        params.append(parent_id)
    
    cursor.execute(query, tuple(params))
    result = cursor.fetchone()
    return result[0] if result else None

def find_or_create_attribute(cursor: Any, attr_name_fi: str) -> int:
    """Finds an attribute by its Finnish name or creates it if it doesn't exist."""
    # Attempt to find the attribute first
    cursor.execute("SELECT id FROM product_attributes WHERE name_fi = %s", (attr_name_fi,))
    result = cursor.fetchone()
    if result:
        return result[0]

    # If not found, create it
    print(f"  -> Attribute '{attr_name_fi}' not found. Creating it...")
    # A simple English name generation for the slug/name field
    name_en = attr_name_fi.replace('ä', 'a').replace('ö', 'o').replace('å', 'a')
    
    cursor.execute("""
        INSERT INTO product_attributes (name, name_fi, data_type)
        VALUES (%s, %s, 'text')
        RETURNING id
    """, (name_en, attr_name_fi))
    
    return cursor.fetchone()[0]


# --- Main Import Logic ---

def upload_single_listing(cursor: Any, listing_data: Dict) -> None:
    """Uploads a single listing and its related data to the database."""
    
    # 1. Skip if listing already exists
    cursor.execute("SELECT id FROM listings WHERE listing_id = %s", (listing_data.get('listing_id'),))
    if cursor.fetchone():
        return # Skip this listing

    # 2. Insert into `listings` table
    price_str = listing_data.get('price', '')
    price_numeric = parse_price(price_str if price_str is not None else '')
    post_time = listing_data.get('post_time')
    if post_time:
        try:
            post_time = datetime.fromisoformat(post_time.replace(' UTC', '+00:00'))
        except (ValueError, TypeError):
            post_time = None

    cursor.execute("""
        INSERT INTO listings (
            listing_id, title, description, price_raw, price_numeric, url, 
            is_sold, status, post_time
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        listing_data.get('listing_id'),
        listing_data.get('title'),
        listing_data.get('description'),
        listing_data.get('price'),
        price_numeric,
        listing_data.get('url'),
        listing_data.get('is_sold', False),
        listing_data.get('status', 'active'),
        post_time
    ))
    listing_db_id = cursor.fetchone()[0]

    # 3. Handle categories
    categories = listing_data.get('categories', [])
    if categories:
        parent_category_id = None
        for i, category_name_fi in enumerate(categories):
            category_id = get_category_id(cursor, category_name_fi, parent_category_id)
            if category_id:
                cursor.execute("""
                    INSERT INTO listing_categories (listing_id, category_id, category_level)
                    VALUES (%s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (listing_db_id, category_id, i))
                parent_category_id = category_id
            else:
                # If a category isn't found, we stop processing this hierarchy for this listing
                # This can be adjusted to be more lenient if needed
                break

    # 4. Handle product attributes
    details = listing_data.get('details', {})
    for attr_name_fi, attr_value in details.items():
        if not attr_name_fi or not attr_value:
            continue
        
        attribute_id = find_or_create_attribute(cursor, attr_name_fi)
        
        # We store everything as text for simplicity based on the current EAV setup.
        # This can be expanded to use value_integer, etc., if data types are known.
        cursor.execute("""
            INSERT INTO listing_attributes (listing_id, attribute_id, value_text)
            VALUES (%s, %s, %s)
        """, (listing_db_id, attribute_id, str(attr_value)))


def main():
    """Main script execution."""
    print(f"Reading listings from '{SOURCE_JSON_FILE}'...")
    try:
        with open(SOURCE_JSON_FILE, 'r', encoding='utf-8') as f:
            listings_to_upload = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: Source file '{SOURCE_JSON_FILE}' not found.")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"❌ Error: Could not parse JSON from '{SOURCE_JSON_FILE}'.")
        sys.exit(1)

    print(f"Found {len(listings_to_upload)} listings to process.")

    # Connect to the database and upload
    print("Connecting to the database...")
    try:
        with psycopg2.connect(DB_URL) as conn:
            with conn.cursor() as cur:
                
                error_count = 0
                # Initialize progress bar
                with tqdm(total=len(listings_to_upload), desc="Uploading Listings", unit="listing") as pbar:
                    for listing in listings_to_upload:
                        try:
                            upload_single_listing(cur, listing)
                        except Exception as e:
                            # Log error and continue
                            error_count += 1
                            # print(f"\n⚠️ Error processing listing {listing.get('listing_id', 'N/A')}: {e}")
                            conn.rollback() # Rollback the single failed transaction
                        else:
                            conn.commit() # Commit successful transaction
                        finally:
                            pbar.update(1)

                print("\n✅ Upload process complete.")
                if error_count > 0:
                    print(f"⚠️ Finished with {error_count} errors. See logs above.")

    except Exception as e:
        print(f"❌ A critical error occurred during database connection or processing: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 