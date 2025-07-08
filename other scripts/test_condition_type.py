import requests
from bs4 import BeautifulSoup
from bs4.element import Tag

BASE_URL = 'https://www.tori.fi/recommerce/forsale/item/'

# Test with just the first few IDs to see the structure
with open('listing_ids.txt') as f:
    test_ids = [line.strip() for line in f if line.strip()][:5]  # Just first 5 for testing

for listing_id in test_ids:
    url = f"{BASE_URL}{listing_id}"
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        print(f"\n=== Listing ID: {listing_id} ===")
        
        # Look for elements with aria-label="Lisätietoja"
        lisatietoja_elements = soup.find_all(attrs={"aria-label": "Lisätietoja"})
        
        if lisatietoja_elements:
            print(f"Found {len(lisatietoja_elements)} elements with aria-label='Lisätietoja':")
            for i, element in enumerate(lisatietoja_elements):
                if isinstance(element, Tag):
                    print(f"  Element {i}: {element.name}")
                    print(f"    HTML: {element}")
                    print(f"    Text: '{element.get_text(strip=True)}'")
                    
                    # Look for parent or sibling elements that might contain the data
                    if element.parent and isinstance(element.parent, Tag):
                        parent_text = element.parent.get_text(strip=True)
                        print(f"    Parent text: '{parent_text}'")
                        
                        # Look for divs with the class we're interested in within the parent
                        target_div = element.parent.find('div', class_='flex gap-8 border rounded-full py-8 px-16')
                        if target_div and isinstance(target_div, Tag):
                            print(f"    Found target div in parent: '{target_div.get_text(strip=True)}'")
                            print(f"    Target div HTML: {target_div}")
        else:
            print("No elements with aria-label='Lisätietoja' found")
            
        # Also check for variations of "Lisätietoja"
        variations = ["lisätietoja", "Lisätietoja", "LISÄTIETOJA"]
        for variation in variations:
            elements = soup.find_all(attrs={"aria-label": variation})
            if elements:
                print(f"Found {len(elements)} elements with aria-label='{variation}'")
                
        # Look for any aria-label attributes to see what's available
        all_aria_labels = soup.find_all(attrs={"aria-label": True})
        if all_aria_labels:
            unique_labels = set()
            for element in all_aria_labels:
                if isinstance(element, Tag):
                    label = element.get('aria-label', '')
                    if label:
                        unique_labels.add(label)
            
            print(f"All aria-label values found: {sorted(unique_labels)}")
        
    except Exception as e:
        print(f"Error processing {listing_id}: {e}")

print("\nTest completed! Check the output to understand the structure.") 