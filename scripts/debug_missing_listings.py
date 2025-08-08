import json
import psycopg2

DB_URL = 'postgresql://neondb_owner:npg_3oxSkPERbp0I@ep-tiny-cell-abmko6a4-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
SOURCE_JSON_FILE = 'scripts/4-extracted_listing_details.json'

def main():
    print("=== DEBUGGING MISSING LISTINGS ===")
    
    # Load JSON data
    try:
        with open(SOURCE_JSON_FILE, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        print(f"JSON file contains: {len(json_data)} listings")
    except Exception as e:
        print(f"Error loading JSON: {e}")
        return
    
    # Get all listing IDs from JSON
    json_listing_ids = set()
    json_listings_by_id = {}
    
    for listing in json_data:
        listing_id = listing.get('listing_id')
        if listing_id:
            json_listing_ids.add(listing_id)
            json_listings_by_id[listing_id] = listing
    
    print(f"Unique listing IDs in JSON: {len(json_listing_ids)}")
    
    # Connect to database
    try:
        with psycopg2.connect(DB_URL) as conn:
            with conn.cursor() as cur:
                # Get all listing IDs from database that were uploaded today
                cur.execute("""
                    SELECT listing_id, id, created_at
                    FROM listings 
                    WHERE created_at >= '2025-07-21'
                    ORDER BY created_at DESC
                """)
                db_results = cur.fetchall()
                
                db_listing_ids = {row[0] for row in db_results}
                print(f"Listings uploaded today in DB: {len(db_listing_ids)}")
                
                # Find missing listings
                missing_from_db = json_listing_ids - db_listing_ids
                print(f"Missing from database: {len(missing_from_db)}")
                
                if missing_from_db:
                    print("\nAnalyzing missing listings...")
                    
                    # Sample missing listings
                    sample_missing = list(missing_from_db)[:10]
                    print(f"Sample missing listing IDs: {sample_missing}")
                    
                    # Check characteristics of missing listings
                    missing_reasons = {
                        'no_listing_id': 0,
                        'too_long_title': 0,
                        'too_long_description': 0,
                        'invalid_data': 0,
                        'other': 0
                    }
                    
                    for listing_id in list(missing_from_db)[:100]:  # Check first 100
                        listing = json_listings_by_id.get(listing_id)
                        if not listing:
                            missing_reasons['no_listing_id'] += 1
                            continue
                            
                        title = listing.get('title', '')
                        description = listing.get('description', '')
                        
                        if len(title) > 1000:
                            missing_reasons['too_long_title'] += 1
                        elif len(description) > 5000:
                            missing_reasons['too_long_description'] += 1
                        elif not title or not listing_id:
                            missing_reasons['invalid_data'] += 1
                        else:
                            missing_reasons['other'] += 1
                    
                    print("Potential reasons for missing listings (sample of 100):")
                    for reason, count in missing_reasons.items():
                        if count > 0:
                            print(f"  {reason}: {count}")
                
                # Check which JSON listings made it to the database
                found_in_db = json_listing_ids & db_listing_ids
                print(f"\nListings from JSON found in DB: {len(found_in_db)}")
                
                # Check category assignments for found listings
                if found_in_db:
                    sample_found = list(found_in_db)[:10]
                    placeholders = ','.join(['%s'] * len(sample_found))
                    
                    cur.execute(f"""
                        SELECT 
                            l.listing_id,
                            l.title,
                            string_agg(c.name, ', ') as categories
                        FROM listings l
                        LEFT JOIN listing_categories lc ON l.id = lc.listing_id
                        LEFT JOIN categories c ON lc.category_id = c.id
                        WHERE l.listing_id IN ({placeholders})
                        GROUP BY l.listing_id, l.title
                        ORDER BY l.listing_id
                    """, sample_found)
                    
                    sample_results = cur.fetchall()
                    print("\nSample listings that made it to DB:")
                    for listing_id, title, categories in sample_results:
                        print(f"  {listing_id}: {title[:50]}... → {categories or 'No categories'}")
                
                # Check for duplicates in JSON
                all_ids = [listing.get('listing_id') for listing in json_data if listing.get('listing_id')]
                duplicate_ids = set([x for x in all_ids if all_ids.count(x) > 1])
                if duplicate_ids:
                    print(f"\nDuplicate IDs in JSON: {len(duplicate_ids)}")
                    print(f"Sample duplicates: {list(duplicate_ids)[:10]}")
                
                # Final summary
                print(f"\n*** SUMMARY ***")
                print(f"JSON listings: {len(json_data)}")
                print(f"Unique JSON listing IDs: {len(json_listing_ids)}")
                print(f"Successfully inserted: {len(found_in_db)}")
                print(f"Missing/Failed: {len(missing_from_db)}")
                print(f"Success rate: {len(found_in_db)/len(json_listing_ids)*100:.1f}%")
                
    except Exception as e:
        print(f"Database error: {e}")

if __name__ == "__main__":
    main() 