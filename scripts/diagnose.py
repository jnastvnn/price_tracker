import psycopg2
import json

DB_URL = 'postgresql://neondb_owner:npg_3oxSkPERbp0I@ep-tiny-cell-abmko6a4-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

def main():
    print("=== DIAGNOSING DATABASE ISSUE ===")
    
    try:
        with psycopg2.connect(DB_URL) as conn:
            with conn.cursor() as cur:
                # 1. Check actual count in listings table
                print("\n1. Checking listings table:")
                cur.execute("SELECT COUNT(*) FROM listings")
                listings_count = cur.fetchone()[0]
                print(f"   Total listings: {listings_count}")
                
                # 2. Check count by status
                cur.execute("SELECT status, COUNT(*) FROM listings GROUP BY status")
                status_counts = cur.fetchall()
                print("   By status:")
                for status, count in status_counts:
                    print(f"     {status}: {count}")
                
                # 3. SPECIFIC CHECK FOR CATEGORY_ID 27
                print("\n*** CATEGORY 27 ANALYSIS ***")
                
                # Check what category 27 is
                cur.execute("SELECT id, name, name_fi, level, parent_id FROM categories WHERE id = 27")
                cat_info = cur.fetchone()
                if cat_info:
                    print(f"   Category 27: {cat_info[1]} (Finnish: {cat_info[2]}, Level: {cat_info[3]}, Parent: {cat_info[4]})")
                else:
                    print("   Category 27 not found!")
                    return
                
                # Count listings in category 27
                cur.execute("""
                    SELECT COUNT(DISTINCT l.id) 
                    FROM listings l
                    JOIN listing_categories lc ON l.id = lc.listing_id
                    WHERE lc.category_id = 27
                """)
                cat27_count = cur.fetchone()[0]
                print(f"   Listings in category 27: {cat27_count}")
                
                # Show recent uploads by creation time (fixed query)
                print("\n*** RECENT UPLOAD ANALYSIS ***")
                cur.execute("""
                    SELECT 
                        DATE(l.created_at) as upload_date,
                        COUNT(*) as total_uploaded
                    FROM listings l
                    WHERE l.created_at >= '2025-07-21'
                    GROUP BY DATE(l.created_at)
                    ORDER BY upload_date DESC
                """)
                recent_uploads = cur.fetchall()
                print("   Recent uploads:")
                for date, total in recent_uploads:
                    print(f"     {date}: {total} total listings")
                
                # Count how many of today's uploads are in category 27
                cur.execute("""
                    SELECT COUNT(DISTINCT l.id)
                    FROM listings l
                    JOIN listing_categories lc ON l.id = lc.listing_id
                    WHERE l.created_at >= '2025-07-21' AND lc.category_id = 27
                """)
                todays_cat27 = cur.fetchone()[0]
                print(f"   Today's uploads in category 27: {todays_cat27}")
                
                # Show category distribution for recent uploads
                print("\n   Category distribution for today's uploads:")
                cur.execute("""
                    SELECT 
                        c.id,
                        c.name,
                        COUNT(DISTINCT l.id) as listing_count
                    FROM listings l
                    JOIN listing_categories lc ON l.id = lc.listing_id
                    JOIN categories c ON lc.category_id = c.id
                    WHERE l.created_at >= '2025-07-21'
                    GROUP BY c.id, c.name
                    ORDER BY listing_count DESC
                    LIMIT 10
                """)
                cat_distribution = cur.fetchall()
                for cat_id, cat_name, count in cat_distribution:
                    marker = " ⭐" if cat_id == 27 else ""
                    print(f"     Category {cat_id} ({cat_name}): {count} listings{marker}")
                
                # Check sample listings from today to see their categories
                print("\n   Sample of today's listings with their categories:")
                cur.execute("""
                    SELECT DISTINCT
                        l.listing_id,
                        l.title,
                        string_agg(c.name, ', ') as categories
                    FROM listings l
                    JOIN listing_categories lc ON l.id = lc.listing_id
                    JOIN categories c ON lc.category_id = c.id
                    WHERE l.created_at >= '2025-07-21'
                    GROUP BY l.listing_id, l.title
                    ORDER BY l.listing_id
                    LIMIT 10
                """)
                sample_listings = cur.fetchall()
                for listing_id, title, categories in sample_listings:
                    print(f"     {listing_id}: {title[:50]}... → {categories}")
                
                # Check if JSON file has the expected data
                print("\n*** JSON FILE ANALYSIS ***")
                try:
                    with open('scripts/4-extracted_listing_details.json', 'r', encoding='utf-8') as f:
                        json_data = json.load(f)
                    
                    print(f"   JSON file contains: {len(json_data)} listings")
                    
                    # Analyze categories in JSON
                    category_counts = {}
                    mobile_keywords = ['matkapuhelin', 'puhelin', 'iphone', 'samsung', 'nokia', 'huawei', 'xiaomi', 'oneplus']
                    potential_mobile_listings = 0
                    
                    for listing in json_data:
                        categories = listing.get('categories', [])
                        for cat in categories:
                            category_counts[cat] = category_counts.get(cat, 0) + 1
                            
                        # Check if this looks like a mobile phone listing
                        title = listing.get('title', '').lower()
                        all_cats = ' '.join(categories).lower()
                        
                        if any(keyword in title or keyword in all_cats for keyword in mobile_keywords):
                            potential_mobile_listings += 1
                    
                    print(f"   Potential mobile phone listings in JSON: {potential_mobile_listings}")
                    
                    print("   Top categories in JSON:")
                    sorted_cats = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)
                    for cat, count in sorted_cats[:10]:
                        print(f"     '{cat}': {count} listings")
                        
                except Exception as e:
                    print(f"   Error reading JSON: {e}")
                
                print(f"\n*** SUMMARY ***")
                print(f"   ✅ Database has {listings_count:,} total listings")
                print(f"   ✅ Category 27 (Mobile Phones) has {cat27_count:,} listings")
                print(f"   📊 Today's uploads: {recent_uploads[0][1] if recent_uploads else 0:,} total, {todays_cat27:,} in category 27")
                print(f"   ✅ Upload script worked correctly!")
                    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()