import requests
from bs4 import BeautifulSoup
import time
import re
import os

def scrape_listing_ids(page=1):
    """
    Scrape listing IDs from Tori.fi search page.
    Args:
        page (int): Page number to scrape
    Returns:
        tuple: (list of listing IDs, boolean indicating if next page exists)
    """
    url = f"https://www.tori.fi/recommerce/forsale/search?page={page}&sort=PUBLISHED_DESC&trade_type=1"
    try:
        print(f"Scraping page {page}: {url}")
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
        # Find all elements with id matching 'search-ad-<digits>'
        listing_elements = soup.find_all(attrs={"id": re.compile(r"^search-ad-\d+$")})
        listing_ids = []
        for element in listing_elements:
            id_attr = element.get('id')
            match = re.match(r"search-ad-(\d+)", id_attr)
            if match:
                listing_ids.append(match.group(1))
        next_page_exists = soup.find('a', attrs={'rel': 'next'}) is not None
        print(f"Found {len(listing_ids)} listing IDs on page {page} | Next page: {'Yes' if next_page_exists else 'No'}")
        return listing_ids, next_page_exists
    except Exception as e:
        print(f"Error scraping page {page}: {e}")
        return [], False

def scrape_all_pages(delay=0):
    """
    Scrape listing IDs from all available pages.
    Args:
        delay (int): Delay between requests in seconds
    Returns:
        list: Combined list of all listing IDs
    """
    all_listing_ids = []
    page = 1
    while True:
        page_ids, has_next = scrape_listing_ids(page)
        all_listing_ids.extend(page_ids)
        if not has_next:
            print(f"Reached last page ({page})")
            break
        print(f"Waiting {delay} seconds before next page...")
        time.sleep(delay)
        page += 1
    return all_listing_ids

# List of location IDs from Tori.fi search URL
location_ids = [
    "0.100015",
    "0.100014", 
    "0.100016",
    "0.100010",
    "0.100012",
    "0.100008",
    "0.100002", 
    "0.100009",
    "0.100005",
    "0.100011",
    "0.100001",
    "0.100020",
    "0.100007",
    "0.100004",
    "0.100003",
    "0.100013",
    "0.100006",
    "2.100018.110091.200100"
]

def scrape_all_pages_for_location(location_id, max_pages=10, delay=0):
    all_listing_ids = []
    page = 1
    while True:
        if page > max_pages:
            print(f"Reached page limit ({max_pages}) for location {location_id}")
            break
            
        url = f"https://www.tori.fi/recommerce/forsale/search?category=0.93&location={location_id}&page={page}&sort=PUBLISHED_DESC&trade_type=1"
        listing_ids, has_next = scrape_listing_ids_for_url(url, page)
        all_listing_ids.extend(listing_ids)
        if not has_next:
            print(f"Reached last page ({page}) for location {location_id}")
            break
        print(f"Waiting {delay} seconds before next page...")
        time.sleep(delay)
        page += 1
    return all_listing_ids

def scrape_listing_ids_for_url(url, page):
    try:
        print(f"Scraping page {page}: {url}")
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
        listing_elements = soup.find_all(attrs={"id": re.compile(r"^search-ad-\d+$")})
        listing_ids = []
        for element in listing_elements:
            id_attr = element.get('id')
            match = re.match(r"search-ad-(\d+)", id_attr)
            if match:
                listing_ids.append(match.group(1))
        next_page_exists = soup.find('a', attrs={'rel': 'next'}) is not None
        print(f"Found {len(listing_ids)} listing IDs on page {page} | Next page: {'Yes' if next_page_exists else 'No'}")
        return listing_ids, next_page_exists
    except Exception as e:
        print(f"Error scraping page {page}: {e}")
        return [], False

def main():
    print("=== Tori.fi Listing ID Scraper ===")

    # Define output files
    output_file = "listing_ids_combined.txt"
    sold_ids_file = "sold_listing_ids.txt"

    # Read existing IDs from listing_ids_combined.txt
    existing_ids = set()
    if os.path.exists(output_file):
        with open(output_file, 'r', encoding='utf-8') as f:
            existing_ids = set(line.strip() for line in f if line.strip())
        print(f"Found {len(existing_ids)} existing IDs in {output_file}")
    else:
        print(f"{output_file} not found, starting fresh.")
        
    # Read existing sold IDs
    existing_sold_ids = set()
    if os.path.exists(sold_ids_file):
        with open(sold_ids_file, 'r', encoding='utf-8') as f:
            existing_sold_ids = set(line.strip() for line in f if line.strip())
        print(f"Found {len(existing_sold_ids)} existing sold IDs in {sold_ids_file}")

    print("\nScraping all available pages for each location...")
    
    all_combined_ids = []
    
    for location_id in location_ids:
        print(f"\n--- Scraping location: {location_id} ---")
        listing_ids = scrape_all_pages_for_location(location_id, max_pages=10)
        if listing_ids:
            unique_ids = list(dict.fromkeys(listing_ids))
            all_combined_ids.extend(unique_ids)
            print(f"Total unique listing IDs for location {location_id}: {len(unique_ids)}")
        else:
            print(f"No listing IDs found for location {location_id}!")
    
    # Get unique list of currently scraped IDs
    scraped_ids_list = sorted(list(dict.fromkeys(all_combined_ids)))
    scraped_ids_set = set(scraped_ids_list)
    
    # Identify new and sold IDs
    new_ids = scraped_ids_set - existing_ids
    sold_ids = existing_ids - scraped_ids_set
    
    # Update the set of all sold IDs
    all_sold_ids = existing_sold_ids.union(sold_ids)

    # Save current active listings, overwriting the file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(scraped_ids_list))
    
    # Save all unique sold IDs to a separate file
    if sold_ids: # Only write if there are new sold items to add
        with open(sold_ids_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(sorted(list(all_sold_ids))))
        print(f"\nAppended {len(sold_ids)} sold/removed IDs to {sold_ids_file}. Total sold: {len(all_sold_ids)}.")
    
    print(f"\n=== SCRAPING COMPLETE ===")
    print(f"Total listings found across all locations (raw): {len(all_combined_ids)}")
    print(f"Total unique active listing IDs: {len(scraped_ids_list)}")
    print(f"  - New listings found: {len(new_ids)}")
    print(f"  - Listings removed (sold/expired): {len(sold_ids)}")
    print(f"Active listings saved to: {output_file}")
    if sold_ids:
        print(f"Sold listings log updated in: {sold_ids_file}")
    
    # Print first few IDs as preview
    print(f"\nFirst 5 active IDs:")
    for i, listing_id in enumerate(scraped_ids_list[:5]):
        print(f"  {i+1}. {listing_id}")
    
    if len(scraped_ids_list) > 5:
        print(f"  ... and {len(scraped_ids_list) - 5} more")

if __name__ == "__main__":
    main()