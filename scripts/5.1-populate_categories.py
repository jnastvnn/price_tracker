#!/usr/bin/env python3
"""
Reads category data from 'listing_data.json', builds a hierarchical structure,
previews it, and then populates the 'categories' table in the database.
"""

import json
import psycopg2
import sys
from typing import Dict, List, Optional, Any

# --- Configuration ---
DB_URL = 'postgresql://neondb_owner:npg_3oxSkPERbp0I@ep-tiny-cell-abmko6a4-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
SOURCE_JSON_FILE = 'scripts/4-extracted_listing_details.json'

# --- Translation Mapping (Finnish to English) ---
# Best-effort translation for common terms found in the data.
CATEGORY_TRANSLATIONS: Dict[str, str] = {
    'Elektroniikka ja kodinkoneet': 'Electronics and Appliances',
    'Kodin pienkoneet': 'Small Home Appliances',
    'Kodinkoneet': 'Home Appliances',
    'Puhelimet ja tarvikkeet': 'Phones and Accessories',
    'Terveys ja hyvinvointi': 'Health and Well-being',
    'Tietotekniikka': 'Information Technology',
    'Valokuvaus ja video': 'Photography and Video',
    'Videopelit ja konsolit': 'Video Games and Consoles',
    'Ääni ja kuva': 'Audio and Video',
    'Muu elektroniikka ja kodinkoneet': 'Other Electronics and Appliances',
    'Matkapuhelimet': 'Mobile Phones',
    'Puhelintarvikkeet': 'Phone Accessories',
    'Muut puhelimet': 'Other Phones',
    'Järjestelmäkamerat': 'System Cameras',
    'Tarvikkeet': 'Accessories',
    'Muut valokuvaustarvikkeet': 'Other Photography Accessories',
    'Objektiivit': 'Lenses',
    'Kompaktikamerat': 'Compact Cameras',
    'Pelit': 'Games',
    'Pelikonsolit': 'Game Consoles',
    'Oheistuotteet': 'Merchandise',
    'Kahvinkeittimet': 'Coffee Makers',
    'Leivänpaahtimet': 'Toasters',
    'Monitoimikoneet ja yleiskoneet': 'Food Processors and Mixers',
    'Pölynimurit': 'Vacuum Cleaners',
    'Silitysraudat': 'Irons',
    'Yleiskoneet ja tehosekoittimet': 'Mixers and Blenders',
    'Vedenkeittimet': 'Kettles',
    'Astianpesukoneet': 'Dishwashers',
    'Jääkaapit': 'Refrigerators',
    'Liedet': 'Stoves',
    'Liesituulettimet': 'Extractor Hoods',
    'Mikroaaltouunit': 'Microwave Ovens',
    'Pakastimet': 'Freezers',
    'Pyykinpesukoneet': 'Washing Machines',
    'Uunit': 'Ovens',
    'Muut kodinkoneet': 'Other Home Appliances',
    'Blu-ray-soittimet': 'Blu-ray Players',
    'DVD-soittimet': 'DVD Players',
    'Kaapelit ja oheislaitteet': 'Cables and Peripherals',
    'Kaiuttimet': 'Speakers',
    'Kotiteatterilaitteet': 'Home Theater Systems',
    'Kuulokkeet': 'Headphones',
    'Mediatoistimet ja digiboksit': 'Media Players and Set-top Boxes',
    'MP3-soittimet ja muut kannettavat soittimet': 'MP3 Players and Portable Audio',
    'PA-laitteet': 'PA Equipment',
    'Radiot': 'Radios',
    'Stereot': 'Stereos',
    'TV': 'TV',
    'Vahvistimet ja viritinvahvistimet': 'Amplifiers and Receivers',
    'Kannettavat tietokoneet': 'Laptops',
    'Kiintolevyt ja tallennustila': 'Hard Drives and Storage',
    'Näytöt': 'Monitors',
    'Oheislaitteet': 'Peripherals',
    'Ohjelmistot': 'Software',
    'Pöytäkoneet': 'Desktop Computers',
    'Tabletit ja lukulaitteet': 'Tablets and E-readers',
    'Tietokonekomponentit': 'Computer Components',
    'Verkkolaitteet': 'Networking Equipment',
    'Muut': 'Other',
    'Sauvasekoittimet ja sähkövatkaimet': 'Hand Blenders and Electric Mixers',
    'Tehosekoittimet ja blenderit': 'Blenders',
    'Vohveliraudat ja voileipägrillit': 'Waffle Irons and Sandwich Grills',
    'Keittolevyt': 'Hobs',
    'Laskimet': 'Calculators',
    'Hybridikamerat': 'Hybrid Cameras',
    'Kameralaukut': 'Camera Bags',
    'Videokamerat': 'Camcorders',
    'Videonauhurit': 'VCRs',
    'Videotykit ja valkokankaat': 'Projectors and Screens',
    'Vaatteet, kosmetiikka ja asusteet': 'Clothing, Cosmetics and Accessories',
    'Kellot ja rannekellot': 'Watches and Wristwatches',
    'Kuivausrummut ja kuivauskaapit': 'Dryers and Drying Cabinets',
    'Keittotasot': 'Hobs',
    'Vohvelikoneet ja leivänpaahtajat': 'Waffle Irons and Toasters',
    'VHS-soittimet': 'VHS Players',
    'Projektorit ja kanvaasit': 'Projectors and Screens',
}

def get_english_name(finnish_name: str) -> str:
    """Translates a Finnish category name to English using the map."""
    return CATEGORY_TRANSLATIONS.get(finnish_name, finnish_name)

def print_preview(category_tree: List[Dict[str, Any]], level: int = 0):
    """Prints a preview of the category hierarchy."""
    for category in category_tree:
        indent = "  " * level
        print(f"{indent}- {category['name_fi']} (Level: {level}, Parent: {category.get('parent_name', 'None')})")
        if 'children' in category:
            print_preview(category['children'], level + 1)

def build_category_tree(paths: set) -> List[Dict[str, Any]]:
    """Builds a hierarchical tree from a set of category paths."""
    tree = {}
    for path in sorted(list(paths)):
        parts = path.split(' > ')
        current_level = tree
        parent_name = None
        for i, part in enumerate(parts):
            if part not in current_level:
                current_level[part] = {
                    'name_fi': part,
                    'parent_name': parent_name,
                    'level': i,
                    'children': {}
                }
            parent_name = part
            current_level = current_level[part]['children']

    def dict_to_list(d: Dict) -> List[Dict[str, Any]]:
        return [
            {**v, 'children': dict_to_list(v['children'])}
            for k, v in d.items()
        ]

    return dict_to_list(tree)

def upload_categories(cursor: Any, category_tree: List[Dict[str, Any]], parent_id: Optional[int] = None):
    """Recursively uploads categories to the database."""
    for category in category_tree:
        name_fi = category['name_fi']
        level = category['level']
        
        # Check if category already exists
        cursor.execute(
            "SELECT id FROM categories WHERE name_fi = %s AND COALESCE(parent_id, 0) = COALESCE(%s, 0)",
            (name_fi, parent_id)
        )
        result = cursor.fetchone()
        
        if result:
            category_id = result[0]
        else:
            # Insert new category
            name_en = get_english_name(name_fi)
            slug = name_en.lower().replace(' ', '-').replace('&', 'and')
            
            cursor.execute("""
                INSERT INTO categories (name, name_fi, slug, parent_id, level)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (name_en, name_fi, slug, parent_id, level))
            category_id = cursor.fetchone()[0]

        # Process children
        if 'children' in category:
            upload_categories(cursor, category['children'], category_id)

def main():
    """Main script execution."""
    print(f"Reading categories from '{SOURCE_JSON_FILE}'...")
    try:
        with open(SOURCE_JSON_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: Source file '{SOURCE_JSON_FILE}' not found.")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"❌ Error: Could not parse JSON from '{SOURCE_JSON_FILE}'.")
        sys.exit(1)

    # Extract all unique category paths
    unique_paths = set()
    for item in data:
        categories = item.get('categories')
        if categories and isinstance(categories, list) and len(categories) > 0:
            unique_paths.add(' > '.join(categories))

    if not unique_paths:
        print("No category paths found in the JSON file. Exiting.")
        return

    print(f"Found {len(unique_paths)} unique category paths.")
    
    # Build and preview the hierarchy
    category_tree = build_category_tree(unique_paths)
    print("\n--- Category Hierarchy Preview ---")
    print_preview(category_tree)
    print("--------------------------------\n")

    # Connect to the database and upload
    print("Connecting to the database to upload categories...")
    try:
        with psycopg2.connect(DB_URL) as conn:
            with conn.cursor() as cur:
                print("Clearing 'categories' table...")
                cur.execute("TRUNCATE TABLE categories RESTART IDENTITY CASCADE;")
                
                print("Uploading new category data...")
                upload_categories(cur, category_tree)
                
                conn.commit()
                cur.execute("SELECT COUNT(*) FROM categories;")
                result = cur.fetchone()
                count = result[0] if result else 0
                print(f"\n✅ Successfully populated database with {count} categories.")

    except Exception as e:
        print(f"❌ An error occurred during database operation: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 