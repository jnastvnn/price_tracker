#!/usr/bin/env python3
"""
This script scrapes listing data from tori.fi and translates Finnish text to English using NLLB-200-distilled-600M.
GPU acceleration enabled for RTX 3070.
"""

import requests
from bs4 import BeautifulSoup, Tag
import json
import re
from datetime import datetime
import pytz
import time
import os
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
import torch
from transformers import MarianMTModel, MarianTokenizer
# Constants
BASE_URL = 'https://www.tori.fi/recommerce/forsale/item/'
MAX_TRANSLATION_CHARS = 512  # Max characters per translation chunk
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Load category translations
CATEGORY_TRANSLATIONS = {}
try:
    script_dir = os.path.dirname(__file__)
    with open(os.path.join(script_dir, 'categories.json'), 'r', encoding='utf-8') as f:
        CATEGORY_TRANSLATIONS = {item['name_fi']: item['name'] for item in json.load(f)}
    print("✅ Category translations loaded.")
except (FileNotFoundError, json.JSONDecodeError) as e:
    print(f"⚠️ Category translation unavailable: {str(e)}")


def initialize_qwen_translator():
    """Initialize Qwen translation via Ollama API."""
    print("🔧 Initializing Qwen translator via Ollama...")
    try:
        def translate_text(text: str) -> list:
            try:
                # Ollama API endpoint (assumes Ollama is running locally)
                OLLAMA_URL = "http://localhost:11434/api/generate"
                
                # Prepare the prompt for Qwen
                prompt = f"""
                /no_think Translate the following Finnish text to English. 
                Provide ONLY the English translation, no additional text.

                Finnish: {text[:MAX_TRANSLATION_CHARS]}
                English: """
                
                payload = {
                    "model": "hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_M",  # or "qwen:14b" for larger model
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "top_p": 0.8,
                        "top_k": 20,
                        "min_p": 0,
                        "num_predict": 8192,
                        "num_ctx": 8192,
        }  # Lower temp for more consistent translations
                }
                
                response = requests.post(
                    OLLAMA_URL,
                    json=payload,
                    timeout=60  # Longer timeout for translation
                )
                response.raise_for_status()
                
                result = response.json()
                translation = result["response"].strip()
                
                # Clean up any artifacts
                translation = re.sub(r'^English:\s*', '', translation)
                if "</think>" in translation:
                    translation = translation.split("</think>\n\n")[-1]
                    print(translation)
                return [{"translation_text": translation}]
                
            except Exception as e:
                print(f"Translation error: {str(e)}")
                return [{"translation_text": ""}]
        
        print("✅ Qwen translator ready (via Ollama)")
        return translate_text
        
    except Exception as e:
        print(f"❌ Failed to initialize Qwen translator: {str(e)}")
        return lambda text: [{"translation_text": ""}]

def extract_text_content(element):
    """
    Safely extract text content from the BeautifulSoup element.
    """
    if isinstance(element, Tag):
        raw_html = str(element)
        soup = BeautifulSoup(raw_html, 'html.parser')
        return soup.get_text(strip=True)
    return ""

def parse_storage_to_gb(storage_str):
    """
    Parses a storage string (e.g., "256 GB", "1 TB") into an integer in GB.
    """
    if not storage_str or not isinstance(storage_str, str):
        return None
    
    normalized_str = storage_str.lower().strip()
    
    if normalized_str == 'muu':
        return None
    
    numeric_match = re.search(r'(\d+\.?\d*)', normalized_str)
    if not numeric_match:
        return None
        
    value = float(numeric_match.group(1))
    
    if 'tb' in normalized_str or 'tera' in normalized_str:
        return int(value * 1000)
    elif 'gb' in normalized_str or 'giga' in normalized_str:
        return int(value)
    elif 'mb' in normalized_str or 'mega' in normalized_str:
        return int(value / 1000)
    
    return None

def scrape_listing(listing_id, translator):
    """
    Scrape a single listing and return structured data, including translations.
    """
    url = f"{BASE_URL}{listing_id}"
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        title_element = soup.find(attrs={"data-testid": "object-title"})
        title = extract_text_content(title_element)
        
        desc_element = soup.find(class_="import-decoration relative about-section-default")
        description = extract_text_content(desc_element)
        
        # Translate title and description
        title_en = ""
        description_en = ""
        try:
            if title:
                title_en = translator(title[:MAX_TRANSLATION_CHARS])[0]['translation_text']
            if description:
                description_en = translator(description[:MAX_TRANSLATION_CHARS])[0]['translation_text']
        except Exception as e:
            print(f"Warning: Translation failed for listing {listing_id}. Error: {e}")
            # Continue with empty translations if an error occurs
            
        price_element = soup.find(class_="h2")
        price = extract_text_content(price_element)
        
        categories = []
        categories_en = []
        cat_div = soup.find('div', class_='flex space-x-8')
        if isinstance(cat_div, Tag):
            raw_html = str(cat_div)
            category_soup = BeautifulSoup(raw_html, 'html.parser')
            category_links = category_soup.find_all('a', class_='s-text-link')
            for link in category_links:
                cat_fi = link.get_text(strip=True)
                if cat_fi != 'Tori':
                    categories.append(cat_fi)
                    categories_en.append(CATEGORY_TRANSLATIONS.get(cat_fi, cat_fi)) # Translate category
        
        details = {}
        detail_translations = {
            "Kunto": "Condition", "Merkki": "Brand", "Muisti": "Storage", "Tyyppi": "Type",
            "Alusta": "Platform", "Nayton koko": "Screen size", "Näytön koko": "Screen size",
            "Vari": "Color", "Väri": "Color", "Malli": "Model"
        }
        
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
                        key = key.strip()
                        value = value.strip()
                        translated_key = detail_translations.get(key, key)
                        details[translated_key] = value
        
        if 'Storage' in details:
            storage_gb = parse_storage_to_gb(details['Storage'])
            if storage_gb is not None:
                details['Storage'] = storage_gb
        
        post_time_element = soup.find(attrs={"data-testid": "object-info"})
        post_time_raw = extract_text_content(post_time_element)
        
        post_time_utc = None
        if post_time_raw:
            try:
                if post_time_raw.isdigit():
                    post_time_dt = datetime.fromtimestamp(int(post_time_raw), pytz.timezone('Europe/Helsinki'))
                    post_time_utc = post_time_dt.astimezone(pytz.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
                else:
                    date_match = re.search(r'(\d{1,2})\.(\d{1,2})\.(\d{4})\s+klo\s+(\d{1,2})\.(\d{2})', post_time_raw)
                    if date_match:
                        day, month, year, hour, minute = date_match.groups()
                        helsinki_tz = pytz.timezone('Europe/Helsinki')
                        post_time_dt = helsinki_tz.localize(datetime(int(year), int(month), int(day), int(hour), int(minute)))
                        post_time_utc = post_time_dt.astimezone(pytz.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
                    else:
                        post_time_utc = f"{post_time_raw} (Helsinki timezone - parsing failed)"
            except Exception as e:
                post_time_utc = f"{post_time_raw} (conversion error: {str(e)})";
        
        return {
            "listing_id": listing_id,
            "title": title,
            "title_en": title_en,
            "description": description,
            "description_en": description_en,
            "price": price,
            "categories": categories,
            "categories_en": categories_en, # Add translated categories
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
    start_time = time.time()
    start_datetime = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"=== SCRAPING STARTED at {start_datetime} ===")

    translator = initialize_qwen_translator()

    MAX_LISTINGS = None
    SAVE_INTERVAL = 5
    
    try:
        with open('scripts/listing_ids_combined.txt') as f:
            scraped_ids = set(line.strip() for line in f if line.strip())
        print(f"Found {len(scraped_ids)} total active listings in listing_ids_combined.txt")
    except FileNotFoundError:
        print("Error: `listing_ids_combined.txt` not found. Please run the ID scraper first.")
        return

    try:
        with open('scripts/listings_from_db.txt') as f:
            db_ids = set(line.strip() for line in f if line.strip())
        print(f"Found {len(db_ids)} listings already in the database (from listings_from_db.txt)")
    except FileNotFoundError:
        print("Warning: `scripts/listings_from_db.txt` not found. Assuming no listings are in the database.")
        db_ids = set()

    new_ids_to_scrape = list(scraped_ids - db_ids)
    print(f"Found {len(new_ids_to_scrape)} new listings to scrape.")

    if not new_ids_to_scrape:
        print("No new listings to scrape. Exiting.")
        return
        
    ids = new_ids_to_scrape
    
    if MAX_LISTINGS:
        ids = ids[:MAX_LISTINGS]
        print(f"Processing first {len(ids)} listings (limited by MAX_LISTINGS={MAX_LISTINGS})")
    else:
        print(f"Processing all {len(ids)} new listings")
    
    output_filename = 'scripts/3-scraped_listing_data-gwen.json'
    
    existing_results = []
    processed_ids = set()
    try:
        with open(output_filename, 'r', encoding='utf-8') as f:
            existing_results = json.load(f)
        processed_ids = {str(result.get('listing_id', '')) for result in existing_results}
        print(f"Found existing results file with {len(existing_results)} listings. Resuming from where we left off.")
    except FileNotFoundError:
        print("No existing results file found. Starting fresh.")
    except json.JSONDecodeError:
        print("Warning: Existing results file is corrupted. Starting fresh.")
        existing_results = []
        processed_ids = set()
    
    ids_to_process = [listing_id for listing_id in ids if listing_id not in processed_ids]
    print(f"After filtering already processed listings: {len(ids_to_process)} listings remaining to process")
    
    if not ids_to_process:
        print("All listings have already been processed. Exiting.")
        return
    
    results = existing_results.copy()
    new_results = []
    
    for i, listing_id in enumerate(ids_to_process, 1):
        print(f"\n[{i}/{len(ids_to_process)}] Processing listing {listing_id}...")
        result = scrape_listing(listing_id, translator)
        results.append(result)
        new_results.append(result)
        
        if result["status"] == "success":
            title_preview = result["title"][:50] + "..." if len(result["title"]) > 50 else result["title"]
            print(f"✓ {listing_id}: {title_preview} | Price: {result['price']} | Posted: {result['post_time']} | {len(result['categories'])} categories | {len(result['details'])} details")
        else:
            print(f"✗ {listing_id}: ERROR - {result['error']}")
        
        if i % SAVE_INTERVAL == 0:
            print(f"\n🔄 SAVING PROGRESS: {i} listings processed...")
            with open(output_filename, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            print(f"✅ Progress saved to {output_filename}")
    
    print(f"\n🔄 SAVING FINAL RESULTS...")
    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    if new_results:
        print(f"\n=== NEW RESULTS JSON OUTPUT ===")
        print(json.dumps(new_results, ensure_ascii=False, indent=2))
    
    end_time = time.time()
    end_datetime = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    duration = end_time - start_time
    minutes = int(duration // 60)
    seconds = duration % 60
    avg_time_per_listing = duration / len(ids_to_process) if ids_to_process else 0
    
    successful_new = len([r for r in new_results if r["status"] == "success"])
    failed_new = len([r for r in new_results if r["status"] == "error"])
    total_successful = len([r for r in results if r["status"] == "success"])
    total_failed = len([r for r in results if r["status"] == "error"])
    
    print(f"\n=== SCRAPING COMPLETE ===")
    print(f"Started: {start_datetime}")
    print(f"Ended: {end_datetime}")
    print(f"Total duration: {minutes}m {seconds:.2f}s")
    print(f"Average time per listing: {avg_time_per_listing:.2f}s")
    print(f"New listings processed this session: {len(ids_to_process)}")
    print(f"New successful: {successful_new}")
    print(f"New failed: {failed_new}")
    print(f"Total listings in file: {len(results)}")
    print(f"Total successful: {total_successful}")
    print(f"Total failed: {total_failed}")
    print(f"Results saved to: {output_filename}")

if __name__ == "__main__":
    main()