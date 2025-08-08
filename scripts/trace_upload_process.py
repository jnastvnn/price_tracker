import json
import psycopg2
from collections import defaultdict

DB_URL = 'postgresql://neondb_owner:npg_3oxSkPERbp0I@ep-tiny-cell-abmko6a4-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
SOURCE_JSON_FILE = 'scripts/4-extracted_listing_details.json'

def simulate_prepare_batch_logic(listings_batch, existing_ids):
    """Simulate the exact logic from the upload script to see what gets filtered out."""
    MAX_ATTR_LEN, MAX_TITLE_LEN, MAX_DESC_LEN = 500, 1000, 5000
    valid_listings = []
    skipped_duplicates = 0
    skipped_invalid = 0
    skipped_no_id = 0
    
    for listing in listings_batch:
        listing_id = listing.get('listing_id')
        
        # Check 1: No listing ID
        if not listing_id:
            skipped_no_id += 1
            continue
            
        # Check 2: Already exists
        if listing_id in existing_ids:
            skipped_duplicates += 1
            continue
        
        # Check 3: Title/description too long
        title = listing.get('title', '')
        description = listing.get('description', '')
        
        if len(title) > MAX_TITLE_LEN or len(description) > MAX_DESC_LEN:
            skipped_invalid += 1
            continue
        
        # If we get here, it should be processed
        valid_listings.append(listing_id)
    
    return valid_listings, skipped_duplicates, skipped_invalid, skipped_no_id

def main():
    print("=== TRACING UPLOAD PROCESS ===")
    
    # Load JSON data
    try:
        with open(SOURCE_JSON_FILE, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        print(f"Loaded JSON file: {len(json_data)} listings")
    except Exception as e:
        print(f"Error loading JSON: {e}")
        return
    
    # Analyze JSON structure first
    print("\n1. JSON ANALYSIS:")
    listing_ids = []
    no_id_count = 0
    
    for listing in json_data:
        listing_id = listing.get('listing_id')
        if listing_id:
            listing_ids.append(listing_id)
        else:
            no_id_count += 1
    
    unique_ids = set(listing_ids)
    duplicate_count = len(listing_ids) - len(unique_ids)
    
    print(f"   Total entries: {len(json_data)}")
    print(f"   Entries with listing_id: {len(listing_ids)}")
    print(f"   Entries without listing_id: {no_id_count}")
    print(f"   Unique listing IDs: {len(unique_ids)}")
    print(f"   Duplicate IDs: {duplicate_count}")
    
    # Show some duplicates
    if duplicate_count > 0:
        id_counts = defaultdict(int)
        for lid in listing_ids:
            id_counts[lid] += 1
        
        duplicates = {lid: count for lid, count in id_counts.items() if count > 1}
        print(f"   Sample duplicates: {dict(list(duplicates.items())[:5])}")
    
    # Get existing IDs from database
    print("\n2. DATABASE ANALYSIS:")
    try:
        with psycopg2.connect(DB_URL) as conn:
            with conn.cursor() as cur:
                # Get existing IDs (simulate what upload script does)
                cur.execute("SELECT listing_id FROM listings")
                existing_ids = {row[0] for row in cur.fetchall()}
                print(f"   Existing IDs in database: {len(existing_ids)}")
                
                # Get today's uploads
                cur.execute("""
                    SELECT listing_id FROM listings 
                    WHERE created_at >= '2025-07-21'
                """)
                todays_uploads = {row[0] for row in cur.fetchall()}
                print(f"   Today's uploads: {len(todays_uploads)}")
                
    except Exception as e:
        print(f"Database error: {e}")
        return
    
    # Simulate the upload process step by step
    print("\n3. SIMULATING UPLOAD PROCESS:")
    
    # Simulate batch processing (like the real script)
    BATCH_SIZE = 1000
    total_valid = 0
    total_duplicates = 0
    total_invalid = 0
    total_no_id = 0
    
    for i in range(0, len(json_data), BATCH_SIZE):
        batch = json_data[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        
        valid_listings, skipped_dups, skipped_invalid, skipped_no_id = simulate_prepare_batch_logic(batch, existing_ids)
        
        total_valid += len(valid_listings)
        total_duplicates += skipped_dups
        total_invalid += skipped_invalid
        total_no_id += skipped_no_id
        
        print(f"   Batch {batch_num}: {len(valid_listings)} valid, {skipped_dups} duplicates, {skipped_invalid} invalid, {skipped_no_id} no ID")
    
    print(f"\n   SIMULATION TOTALS:")
    print(f"   Should be processed: {total_valid}")
    print(f"   Skipped (duplicates): {total_duplicates}")
    print(f"   Skipped (invalid): {total_invalid}")
    print(f"   Skipped (no ID): {total_no_id}")
    print(f"   Total: {total_valid + total_duplicates + total_invalid + total_no_id}")
    
    # Compare with actual results
    print("\n4. COMPARISON WITH ACTUAL RESULTS:")
    actual_uploaded = len(todays_uploads & unique_ids)
    print(f"   Actually uploaded from JSON: {actual_uploaded}")
    print(f"   Expected to upload: {total_valid}")
    print(f"   Difference: {total_valid - actual_uploaded}")
    
    # Check specific cases
    print("\n5. DETAILED INVESTIGATION:")
    
    # Find listings that should have been uploaded but weren't
    json_ids_set = set(listing_ids)
    should_upload = json_ids_set - existing_ids  # Remove pre-existing
    actually_uploaded = todays_uploads & json_ids_set
    missing = should_upload - actually_uploaded
    
    print(f"   JSON unique IDs: {len(unique_ids)}")
    print(f"   Should upload (after removing existing): {len(should_upload)}")
    print(f"   Actually uploaded: {len(actually_uploaded)}")
    print(f"   Missing: {len(missing)}")
    
    if missing:
        # Check why some are missing
        sample_missing = list(missing)[:10]
        print(f"   Sample missing IDs: {sample_missing}")
        
        # Check if these missing IDs have issues
        missing_analysis = {
            'too_long_title': 0,
            'too_long_desc': 0,
            'no_title': 0,
            'other': 0
        }
        
        for listing in json_data:
            if listing.get('listing_id') in sample_missing:
                title = listing.get('title', '')
                desc = listing.get('description', '')
                
                if not title:
                    missing_analysis['no_title'] += 1
                elif len(title) > 1000:
                    missing_analysis['too_long_title'] += 1
                elif len(desc) > 5000:
                    missing_analysis['too_long_desc'] += 1
                else:
                    missing_analysis['other'] += 1
                    print(f"     Mystery: {listing.get('listing_id')} - {title[:50]}...")
        
        print(f"   Missing reasons: {missing_analysis}")
    
    # Final summary
    print(f"\n*** FINAL ANALYSIS ***")
    print(f"JSON entries: {len(json_data)}")
    print(f"Unique valid IDs in JSON: {len(unique_ids)}")
    print(f"Pre-existing in DB: {len(existing_ids & unique_ids)}")
    print(f"Should be new uploads: {len(unique_ids - existing_ids)}")
    print(f"Actually uploaded today: {len(actually_uploaded)}")
    print(f"Upload success rate: {len(actually_uploaded)/len(unique_ids - existing_ids)*100:.1f}%")

if __name__ == "__main__":
    main() 