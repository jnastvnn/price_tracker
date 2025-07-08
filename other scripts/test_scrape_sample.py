import requests
from bs4 import BeautifulSoup
from bs4.element import Tag

BASE_URL = 'https://www.tori.fi/recommerce/forsale/item/'

# Test with just the first 3 IDs
with open('listing_ids.txt') as f:
    test_ids = [line.strip() for line in f if line.strip()][:3]

for listing_id in test_ids:
    url = f"{BASE_URL}{listing_id}"
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        print(f"\n=== Testing {listing_id} ===")
        
        # Extract categories
        cat_div = soup.find('div', class_='flex space-x-8')
        if isinstance(cat_div, Tag):
            raw_html = str(cat_div)
            category_soup = BeautifulSoup(raw_html, 'html.parser')
            category_links = category_soup.find_all('a', class_='s-text-link')
            categories = [link.get_text(strip=True) for link in category_links if link.get_text(strip=True) != 'Tori']
        else:
            categories = []
        
        # Extract details
        details = {}
        lisatietoja_section = soup.find('section', attrs={"aria-label": "Lisätietoja"})
        
        if isinstance(lisatietoja_section, Tag):
            raw_html = str(lisatietoja_section)
            details_soup = BeautifulSoup(raw_html, 'html.parser')
            detail_spans = details_soup.find_all('span', class_='flex gap-8 border rounded-full py-8 px-16')
            
            print(f"Found {len(detail_spans)} detail spans")
            for i, span in enumerate(detail_spans):
                if isinstance(span, Tag):
                    text_content = span.get_text(strip=True)
                    print(f"  Span {i}: '{text_content}'")
                    if ':' in text_content:
                        key, value = text_content.split(':', 1)
                        key = key.strip()
                        value = value.strip()
                        details[key] = value
                        print(f"    Parsed: {key} = {value}")
        
        print(f"Categories: {categories}")
        print(f"Details: {details}")
        
    except Exception as e:
        print(f"Error processing {listing_id}: {e}")

print("\nTest completed!") 