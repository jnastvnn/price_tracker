import psycopg2

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
    'Hybridikamerat': 80
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

# Read the scraped data and find unknown categories
unknown_categories = set()
category_counts = {}

with open('listing_categories.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for line in lines:
    listing_id, categories = parse_categories_line(line.strip())
    if listing_id is None:
        continue
    
    for category_name in categories:
        if category_name in category_counts:
            category_counts[category_name] += 1
        else:
            category_counts[category_name] = 1
            
        if category_name not in CATEGORY_MAP:
            unknown_categories.add(category_name)

print("Unknown categories found in scraped data:")
for cat in sorted(unknown_categories):
    print(f"  - {cat} (appears {category_counts[cat]} times)")

print(f"\nTotal unknown categories: {len(unknown_categories)}")
print(f"Total known categories: {len([cat for cat in category_counts.keys() if cat in CATEGORY_MAP])}") 