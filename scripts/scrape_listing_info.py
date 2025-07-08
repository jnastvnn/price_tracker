import requests
from bs4 import BeautifulSoup
from bs4.element import Tag
import json
import re
from datetime import datetime
import pytz
import time

BASE_URL = 'https://www.tori.fi/recommerce/forsale/item/'

def extract_text_content(element):
    """
    Safely extract text content from a BeautifulSoup element.
    Uses the same method as category extraction for consistency.
    """
    if isinstance(element, Tag):
        raw_html = str(element)
        soup = BeautifulSoup(raw_html, 'html.parser')
        return soup.get_text(strip=True)
    return ""

def scrape_listing(listing_id):
    """
    Scrape a single listing and return structured data.
    """
    url = f"{BASE_URL}{listing_id}"
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        # Extract title
        title_element = soup.find(attrs={"data-testid": "object-title"})
        title = extract_text_content(title_element)
        
        # Extract description
        desc_element = soup.find(class_="import-decoration relative about-section-default")
        description = extract_text_content(desc_element)
        
        # Extract price
        price_element = soup.find(class_="h2")
        price = extract_text_content(price_element)
        
        # Extract categories
        categories = []
        cat_div = soup.find('div', class_='flex space-x-8')
        if isinstance(cat_div, Tag):
            raw_html = str(cat_div)
            category_soup = BeautifulSoup(raw_html, 'html.parser')
            category_links = category_soup.find_all('a', class_='s-text-link')
            categories = [link.get_text(strip=True) for link in category_links if link.get_text(strip=True) != 'Tori']
        
        # Extract details from "Lisätietoja" section
        details = {}
        lisatietoja_section = soup.find('section', attrs={"aria-label": "Lisätietoja"})
        
        if isinstance(lisatietoja_section, Tag):
            raw_html = str(lisatietoja_section)
            details_soup = BeautifulSoup(raw_html, 'html.parser')
            detail_spans = details_soup.find_all('span', class_='flex gap-8 border rounded-full py-8 px-16')
            
            for span in detail_spans:
                if isinstance(span, Tag):
                    text_content = span.get_text(strip=True)
                    if ':' in text_content:
                        key, value = text_content.split(':', 1)
                        details[key.strip()] = value.strip()
        
        # Extract post time
        post_time_element = soup.find(attrs={"data-testid": "object-info"})
        post_time_raw = extract_text_content(post_time_element)
        
        # Convert post time to UTC
        post_time_utc = None
        if post_time_raw:
            try:
                # Try different parsing strategies
                if post_time_raw.isdigit():
                    # If it's a timestamp
                    post_time_dt = datetime.fromtimestamp(int(post_time_raw), pytz.timezone('Europe/Helsinki'))
                    post_time_utc = post_time_dt.astimezone(pytz.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
                else:
                    # If it's a formatted date string, try to parse it
                    # Common Finnish formats: "4.7.2025 klo 12.34" or similar
                    date_match = re.search(r'(\d{1,2})\.(\d{1,2})\.(\d{4})\s+klo\s+(\d{1,2})\.(\d{2})', post_time_raw)
                    if date_match:
                        day, month, year, hour, minute = date_match.groups()
                        helsinki_tz = pytz.timezone('Europe/Helsinki')
                        post_time_dt = helsinki_tz.localize(datetime(int(year), int(month), int(day), int(hour), int(minute)))
                        post_time_utc = post_time_dt.astimezone(pytz.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
                    else:
                        # If parsing fails, keep the original format and note the timezone
                        post_time_utc = f"{post_time_raw} (Helsinki timezone - parsing failed)"
            except Exception as e:
                post_time_utc = f"{post_time_raw} (conversion error: {str(e)})"
        
        return {
            "listing_id": listing_id,
            "title": title,
            "description": description,
            "price": price,
            "categories": categories,
            "details": details,
            "url": url,
            "is_sold": False,
            "sold_time": "",
            "status": "success",
            "post_time": post_time_utc
        }
        
    except Exception as e:
        return {
            "listing_id": listing_id,
            "error": str(e),
            "url": url,
            "status": "error"
        }

def main():
    """
    Main function to scrape all listings and save results.
    """
    # Start timer
    start_time = time.time()
    start_datetime = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"=== SCRAPING STARTED at {start_datetime} ===")
    
    # Configuration
    MAX_LISTINGS = None  # Set to a number (e.g., 100) to limit processing, or None for all
    
    # Load listing IDs from the main scraped file
    try:
        with open('scripts/listing_ids_combined.txt') as f:
            scraped_ids = set(line.strip() for line in f if line.strip())
        print(f"Found {len(scraped_ids)} total active listings in listing_ids_combined.txt")
    except FileNotFoundError:
        print("Error: `listing_ids_combined.txt` not found. Please run the ID scraper first.")
        return

    # Load listing IDs that are already in the database
    try:
        with open('scripts/listings_from_db.txt') as f:
            db_ids = set(line.strip() for line in f if line.strip())
        print(f"Found {len(db_ids)} listings already in the database (from listings_from_db.txt)")
    except FileNotFoundError:
        print("Warning: `scripts/listings_from_db.txt` not found. Assuming no listings are in the database.")
        db_ids = set()

    # Determine which IDs are new and need to be scraped
    new_ids_to_scrape = list(scraped_ids - db_ids)
    print(f"Found {len(new_ids_to_scrape)} new listings to scrape.")

    if not new_ids_to_scrape:
        print("No new listings to scrape. Exiting.")
        return
        
    ids = new_ids_to_scrape
    
    # Limit to first X listings if specified
    if MAX_LISTINGS:
        ids = ids[:MAX_LISTINGS]
        print(f"Processing first {len(ids)} listings (limited by MAX_LISTINGS={MAX_LISTINGS})")
    else:
        print(f"Processing all {len(ids)} new listings")
    
    results = []
    
    # Process each listing
    for i, listing_id in enumerate(ids, 1):
        print(f"\n[{i}/{len(ids)}] Processing listing {listing_id}...")
        result = scrape_listing(listing_id)
        results.append(result)
        
        # Print progress
        if result["status"] == "success":
            title_preview = result["title"][:50] + "..." if len(result["title"]) > 50 else result["title"]
            print(f"✓ {listing_id}: {title_preview} | Price: {result['price']} | Posted: {result['post_time']} | {len(result['categories'])} categories | {len(result['details'])} details")
        else:
            print(f"✗ {listing_id}: ERROR - {result['error']}")
        
        # Print JSON for this listing
        #print(json.dumps(result, ensure_ascii=False, indent=2))
        #print("-" * 40)
    
    # Save results to JSON
    output_filename = f'listing_data_new_{len(results)}_items.json' if MAX_LISTINGS else 'listing_data_new.json'
    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    # Print JSON to console
    print(f"\n=== JSON OUTPUT ===")
    print(json.dumps(results, ensure_ascii=False, indent=2))
    
    # Calculate timing
    end_time = time.time()
    end_datetime = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    duration = end_time - start_time
    minutes = int(duration // 60)
    seconds = duration % 60
    avg_time_per_listing = duration / len(ids) if ids else 0
    
    # Generate summary
    successful = len([r for r in results if r["status"] == "success"])
    failed = len([r for r in results if r["status"] == "error"])
    
    print(f"\n=== SCRAPING COMPLETE ===")
    print(f"Started: {start_datetime}")
    print(f"Ended: {end_datetime}")
    print(f"Total duration: {minutes}m {seconds:.2f}s")
    print(f"Average time per listing: {avg_time_per_listing:.2f}s")
    print(f"Total listings processed: {len(ids)}")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print(f"Results saved to: {output_filename}")

if __name__ == "__main__":
    main() 