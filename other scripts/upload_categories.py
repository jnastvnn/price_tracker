import psycopg2
import re

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
    'Hybridikamerat': 80  # Adding this as it appears in the data but not in the original list
}

def create_slug(name):
    """Create a URL-friendly slug from category name"""
    # Convert to lowercase and replace special characters
    slug = re.sub(r'[äÄ]', 'a', name.lower())
    slug = re.sub(r'[öÖ]', 'o', slug)
    slug = re.sub(r'[åÅ]', 'a', slug)
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug.strip())
    return slug

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

def add_new_category(cur, category_name, parent_id=None):
    """Add a new category to the categories table and return its ID"""
    # Get the next available ID
    cur.execute('SELECT COALESCE(MAX(id), 0) + 1 FROM categories')
    new_id = cur.fetchone()[0]
    
    # Create slug
    slug = create_slug(category_name)
    
    # Determine level based on parent
    level = 1 if parent_id is None else 2
    if parent_id:
        cur.execute('SELECT level FROM categories WHERE id = %s', (parent_id,))
        parent_level = cur.fetchone()
        if parent_level:
            level = parent_level[0] + 1
    
    # Insert the new category with all required fields
    cur.execute('''
        INSERT INTO categories (id, name, name_fi, slug, parent_id, level) 
        VALUES (%s, %s, %s, %s, %s, %s)
    ''', (new_id, category_name, category_name, slug, parent_id, level))
    
    print(f"Added new category: {category_name} with ID {new_id} (parent: {parent_id}, level: {level})")
    return new_id

def upload_categories():
    # Read the scraped data
    with open('listing_categories.txt', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    records_to_insert = []
    
    with psycopg2.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            # Clear existing data from listing_categories (optional - remove if you want to append)
            cur.execute('DELETE FROM listing_categories;')
            
            for line in lines:
                listing_id, categories = parse_categories_line(line.strip())
                if listing_id is None:
                    continue
                
                parent_id = None
                for level, category_name in enumerate(categories, 1):
                    if category_name in CATEGORY_MAP:
                        category_id = CATEGORY_MAP[category_name]
                    else:
                        # Add new category to database and update our mapping
                        category_id = add_new_category(cur, category_name, parent_id)
                        CATEGORY_MAP[category_name] = category_id
                    
                    records_to_insert.append((category_id, level, listing_id))
                    parent_id = category_id  # This category becomes parent for the next level
            
            # Insert all listing category records
            cur.executemany(
                'INSERT INTO listing_categories (category_id, level, listing_id) VALUES (%s, %s, %s)',
                records_to_insert
            )
            
            conn.commit()
            print(f"Successfully uploaded {len(records_to_insert)} category records to the database")

if __name__ == '__main__':
    upload_categories() 