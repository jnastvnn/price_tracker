import psycopg2
from tqdm import tqdm
import time

DB_URL = 'postgresql://neondb_owner:npg_3oxSkPERbp0I@ep-tiny-cell-abmko6a4-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

# Category mapping from Finnish names to IDs
CATEGORY_MAP = {
    'Elektroniikka ja kodinkoneet': 1,
    'Kodin pienkoneet': 2,
    'Kodinkoneet': 3,
    'Puhelimet ja tarvikkeet': 4,
    'Terveys ja hyvinvointi': 5,
    'Tietotekniikka': 6,
    'Valokuvaus ja video': 7,
    'Videopelit ja konsolit': 8,
    'Ääni ja kuva': 9,
    'Muu elektroniikka ja kodinkoneet': 10,
    'Matkapuhelimet': 11,
    'Puhelintarvikkeet': 12,
    'Muut puhelimet': 13,
    'Järjestelmäkamerat': 14,
    'Tarvikkeet': 15,
    'Muut valokuvaustarvikkeet': 16,
    'Objektiivit': 17,
    'Kompaktikamerat': 18,
    'Pelit': 19,
    'Pelikonsolit': 20,
    'Oheistuotteet': 21,
    'Kahvinkeittimet': 22,
    'Leivänpaahtimet': 23,
    'Monitoimikoneet ja yleiskoneet': 24,
    'Pölynimurit': 25,
    'Sauvasekoittimet ja vatkaimet': 26,
    'Silitysraudat': 27,
    'Yleiskoneet ja tehosekoittimet': 28,
    'Vedenkeittimet': 29,
    'Vohvelikoneet ja leivänpaahtajat': 30,
    'Muut kodin pienkoneet': 31,
    'Astianpesukoneet': 32,
    'Jääkaapit': 33,
    'Keittotasot': 34,
    'Kuivausrummut ja kuivauskaapit': 35,
    'Liedet': 36,
    'Liesituulettimet': 37,
    'Mikroaaltouunit': 38,
    'Pakastimet': 39,
    'Pyykinpesukoneet': 40,
    'Uunit': 41,
    'Muut kodinkoneet': 42,
    'Blu-ray-soittimet': 43,
    'DVD-soittimet': 44,
    'Kaapelit ja oheislaitteet': 45,
    'Kaiuttimet': 46,
    'Kotiteatterilaitteet': 47,
    'Kuulokkeet': 48,
    'Mediatoistimet ja digiboksit': 49,
    'MP3-soittimet ja muut kannettavat soittimet': 50,
    'PA-laitteet': 51,
    'Radiot': 52,
    'Stereot': 53,
    'TV': 54,
    'Vahvistimet ja viritinvahvistimet': 55,
    'VHS-soittimet': 56,
    'Projektorit ja kanvaasit': 57,
    'Kannettavat tietokoneet': 58,
    'Kiintolevyt ja tallennustila': 59,
    'Näytöt': 60,
    'Oheislaitteet': 61,
    'Ohjelmistot': 62,
    'Pöytäkoneet': 63,
    'Tabletit ja lukulaitteet': 64,
    'Tietokonekomponentit': 65,
    'Verkkolaitteet': 66,
    'Asemat': 67,
    'Emolevyt': 68,
    'Kotelot': 69,
    'Näytönohjaimet': 70,
    'Prosessorit': 71,
    'RAM-muisti': 72,
    'Äänikortit': 73,
    'Muut tietokonekomponentit': 74,
    'Näppäimistöt ja hiiret': 75,
    'Sovittimet': 76,
    'Tulostimet ja skannerit': 77,
    'Web-kamerat': 78,
    'Muut': 79,
}

def parse_categories_line(line):
    """Parse a line from listing_categories.txt"""
    if 'ERROR' in line:
        return None, []
    
    parts = line.split(': ', 1)
    if len(parts) != 2:
        return None, []
    
    listing_id = parts[0].strip()
    categories_str = parts[1].strip()
    
    if not categories_str:
        return listing_id, []
    
    categories = [cat.strip() for cat in categories_str.split(', ')]
    return listing_id, categories

def filter_known_categories(categories):
    """Filter out unknown categories, keeping only known ones"""
    known_categories = []
    for category in categories:
        if category in CATEGORY_MAP:
            known_categories.append(category)
        # Remove debug prints for performance
    return known_categories

def upload_categories(store_full_hierarchy=True):
    """
    Upload categories to database
    
    Args:
        store_full_hierarchy (bool): 
            True = Store all category levels (recommended)
            False = Store only the most specific (child) category
    """
    print(f"🔧 Mode: {'Full hierarchy' if store_full_hierarchy else 'Child categories only'}")
    
    # Read and process data in memory for speed
    print("📖 Reading category data...")
    start_time = time.time()
    
    with open('listing_categories.txt', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    records_to_insert = []
    skipped_listings = 0
    
    print("⚡ Processing category data...")
    for line in tqdm(lines, desc="Parsing lines", unit="lines"):
        listing_id, categories = parse_categories_line(line.strip())
        if listing_id is None:
            continue
        
        # Filter out unknown categories
        known_categories = filter_known_categories(categories)
        
        if not known_categories:
            skipped_listings += 1
            continue
        
        if store_full_hierarchy:
            # Store all levels of the hierarchy
            for level, category_name in enumerate(known_categories, 1):
                category_id = CATEGORY_MAP[category_name]
                records_to_insert.append((category_id, level, listing_id))
        else:
            # Store only the most specific (last) category
            if known_categories:
                category_name = known_categories[-1]  # Last = most specific
                category_id = CATEGORY_MAP[category_name]
                records_to_insert.append((category_id, 1, listing_id))
    
    processing_time = time.time() - start_time
    print(f"✅ Processing complete in {processing_time:.2f}s")
    print(f"📊 Records to insert: {len(records_to_insert):,}")
    
    # Upload to database with optimized batch processing
    print("🚀 Uploading to database...")
    upload_start = time.time()
    
    with psycopg2.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            # Clear existing data
            print("🧹 Clearing existing data...")
            cur.execute('DELETE FROM listing_categories;')
            
            # Use larger batch size for better performance
            batch_size = 5000  # Increased from 1000
            total_batches = (len(records_to_insert) + batch_size - 1) // batch_size
            
            print(f"📦 Uploading in {total_batches} batches of {batch_size:,} records...")
            
            for i in tqdm(range(0, len(records_to_insert), batch_size), 
                         desc="Uploading batches", unit="batch"):
                batch = records_to_insert[i:i + batch_size]
                
                # Use execute_values for better performance than executemany
                from psycopg2.extras import execute_values
                execute_values(
                    cur,
                    'INSERT INTO listing_categories (category_id, level, listing_id) VALUES %s',
                    batch,
                    template=None,
                    page_size=batch_size
                )
            
            conn.commit()
    
    upload_time = time.time() - upload_start
    total_time = time.time() - start_time
    
    print(f"\n✅ Upload completed in {upload_time:.2f}s")
    print(f"⏱️  Total time: {total_time:.2f}s")
    print(f"📈 Successfully uploaded {len(records_to_insert):,} category records")
    print(f"⚠️  Skipped {skipped_listings:,} listings with no known categories")
    print(f"🚀 Average speed: {len(records_to_insert)/total_time:.0f} records/second")

if __name__ == '__main__':
    # Choose your strategy:
    # True = Full hierarchy (recommended for e-commerce)
    # False = Child categories only (faster but less flexible)
    upload_categories(store_full_hierarchy=True) 