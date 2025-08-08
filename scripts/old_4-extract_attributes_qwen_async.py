import json
import asyncio
import aiohttp
import time
import os
from datetime import datetime
import re
import copy
 

# Ollama API configuration
OLLAMA_BASE_URL = "http://localhost:11434"
MODEL_NAME = "hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_M"

# Concurrency settings - conservative for RTX 3070
MAX_CONCURRENT_REQUESTS = 3  # Conservative limit for GPU memory
REQUEST_TIMEOUT = 60  # Increased timeout for concurrent requests

async def call_ollama(session, prompt, max_retries=3):
    """
    Call Ollama API with the given prompt using async HTTP.
    """
    url = f"{OLLAMA_BASE_URL}/api/generate"
    
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "keep_alive": "5m",         # ✅ Moved to top level
        "options": {
            "temperature": 0.7,
            "top_p": 0.8,
            "top_k": 20,
            "min_p": 0,
            "num_predict": 1024,     # Response length limit
            "num_ctx": 1024,    
        }
    }
    
    for attempt in range(max_retries):
        try:
            timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)
            async with session.post(url, json=payload, timeout=timeout) as response:
                response.raise_for_status()
                
                result = await response.json()
                if "response" in result:
                    return result["response"].strip()
                else:
                    print(f"Warning: Unexpected response format: {result}")
                    return None
                    
        except asyncio.TimeoutError:
            print(f"Attempt {attempt + 1} timed out")
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
            else:
                print(f"Failed to get response after {max_retries} attempts (timeout)")
                return None
        except aiohttp.ClientError as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
            else:
                print(f"Failed to get response after {max_retries} attempts")
                return None
        except Exception as e:
            print(f"Unexpected error: {e}")
            return None
    
    return None

def create_extraction_prompt_for_desktop(title, description, existing_brand="The brand is not known"):
    """
    Create a prompt for extracting product attributes.
    """
    prompt = f"""/no_think You are a product attribute extraction expert. Extract product attributes from this listing. Note that the listing is in Finnish.

    Product Title: {title}
    Product Description: {description[:1000]}...
    Known Brand: {existing_brand}

    INSTRUCTIONS:
    - Extract specific product attributes if clearly mentioned
    - Be conservative - only extract if you are confident
    - Use null for unclear or missing attributes
    - If brand is already known, use that brand name

    Return your response in this EXACT JSON format:
    {{
    "merkki": "brand name or null (use known brand if available)",
    "malli": "Only product model, leave out all other information or null", 
    "vari": "color or null",
    "processori": "processor type or null",
    "näytonohjain": "graphics card or null", 
    "ram": "RAM amount or null",
    "käyttöjärjestelmä": "OS or null",
    "muisti": "storage space or null",
    "confidence_score": (0-100)
    }}

    EXAMPLES:
    Title: "Pelitietokone RTX 4070 R7 7800X3D"
    {{
    "merkki": "null",
    "malli": "null",
    "vari": "null",
    "processori": "R7 7800X3D",
    "näytonohjain": "GeForce RTX 4070",
    "ram": "null",
    "käyttöjärjestelmä": "null",
    "muisti": "null",
    "confidence_score": 85
    }}

    Respond with valid JSON only:"""

    return prompt

def create_extraction_prompt_for_monitor(title, description, existing_brand="The brand is not known"):
    """
    Create a prompt for extracting product attributes.
    """
    prompt = f"""/no_think You are a product attribute extraction expert. Extract product attributes from this listing. Note that the listing is in Finnish.

    Product Title: {title}
    Product Description: {description[:1000]}...
    Known Brand: {existing_brand}

    INSTRUCTIONS:
    - Extract specific product attributes if clearly mentioned
    - Be conservative - only extract if you are confident
    - Use null for unclear or missing attributes
    - If brand is already known, use that brand name

    Return your response in this EXACT JSON format:
    {{
    "merkki": "brand name or null (use known brand if available)",
    "malli": "Only product model, leave out all other information or null", 
    "koko": "screen size or null",
    "resoluutio": "resolution or null",
    "refresh_rate": "refresh rate or null",
    "latency": "latency or null",
    "panel_technology": "TN/VA/IPS/OLED or null if not mentioned",
    "confidence_score": (0-100)
    }}


    Respond with valid JSON only:"""

    return prompt

def create_extraction_prompt_smartphone(title, description, existing_brand="The brand is not known"):
    
    """
    Create a prompt for extracting product attributes.
    """
    prompt = f"""/no_think You are a product attribute extraction expert. Extract product attributes from this listing. Note that the listing is in Finnish.

    Product Title: {title}
    Product Description: {description[:1000]}...
    Known Brand: {existing_brand}

    INSTRUCTIONS:
    - Extract specific product attributes if clearly mentioned
    - Be conservative - only extract if you are confident
    - Use null for unclear or missing attributes
    - If brand is already known, use that brand name

    Return your response in this EXACT JSON format:
    {{
    "merkki": "brand name or null (use known brand if available)",
    "malli": "Only product model, leave out all other information or null",
    "vari": "color or null",
    "ram": "RAM amount or null",
    "muisti": "storage space or null",
    "confidence_score": (0-100)
    }}

    EXAMPLES:
    Title: "Apple iPhone 15 Pro Max 256GB Space Black"
    {{
    "merkki": "Apple",
    "malli": "iPhone 15 Pro Max",
    "muisti": "256GB",
    "vari": "Space Black",
    "ram": "null", 
    "confidence_score": 95
    }}
    Respond with valid JSON only:"""

    return prompt

def create_extraction_prompt_for_general(title, description, existing_brand="The brand is not known"):
    """
    Create a prompt for extracting product attributes.
    """
    prompt = f"""/no_think You are a product attribute extraction expert. Extract product attributes from this listing. Note that the listing is in Finnish.

    Product Title: {title}
    Product Description: {description[:1000]}...
    Known Brand: {existing_brand}

    INSTRUCTIONS:
    - Extract specific product attributes if clearly mentioned
    - Be conservative - only extract if you are confident
    - Use null for unclear or missing attributes
    - If brand is already known, use that brand name

    Return your response in this EXACT JSON format:
    {{
    "merkki": "brand name or null (use known brand if available)",
    "malli": "Only product model, leave out all other information or null",
    "muisti": "memory/storage capacity or null",
    "vari": "color or null",
    "confidence_score": (0-100)
    }}

    Respond with valid JSON only:"""

    return prompt

async def extract_attributes(session, listing, existing_brand=None, category=None):
    """
    Extract product attributes from a listing using async HTTP.
    """
    title = listing.get("title", "")
    description = listing.get("description", "")
    
    if not title and not description:
        return {
            "merkki": None, 
            "malli": None,
            "muisti": None,
            "vari": None,
            "processori": None,
            "näytonohjain": None,
            "ram": None,
            "käyttöjärjestelmä": None,
            "confidence": 0.0
        }
    
    # Create prompt
    if category == "Pöytäkoneet":
        prompt = create_extraction_prompt_for_desktop(title, description, existing_brand)
    elif category == "Matkapuhelimet":
        prompt = create_extraction_prompt_smartphone(title, description, existing_brand)
    elif category == "Näytöt":
        prompt = create_extraction_prompt_for_monitor(title, description, existing_brand)
    else:
        prompt = create_extraction_prompt_for_general(title, description, existing_brand)
    
    # Get response from model
    response = await call_ollama(session, prompt)
    
    if not response:
        return {
            "merkki": None, 
            "malli": None,
            "muisti": None,
            "vari": None,
            "processori": None,
            "näytonohjain": None,
            "ram": None,
            "käyttöjärjestelmä": None,
            "confidence": 0.0
        }
    
    # Parse JSON response
    try:
        # Extract JSON from response (handle cases where thinking text appears before JSON)
        json_start = response.find('{')
        json_end = response.rfind('}') + 1
        
        if json_start != -1 and json_end > json_start:
            json_text = response[json_start:json_end]
            json_response = json.loads(json_text)
        else:
            # Try parsing the entire response as JSON
            json_response = json.loads(response)
        
        # Extract all attributes
        attributes = {}
        
        # Field mappings - now includes all desktop fields
        field_mappings = {
            "merkki": "merkki",
            "malli": "malli", 
            "muisti": "muisti",
            "vari": "vari",
            "processori": "processori",
            "näytonohjain": "näytonohjain",
            "ram": "ram",
            "käyttöjärjestelmä": "käyttöjärjestelmä",
        }
        
        for field_key, json_key in field_mappings.items():
            value = json_response.get(json_key)
            if value and value.lower() not in ["unknown", "unclear", "not specified", "null", ""]:
                attributes[field_key] = value
            else:
                attributes[field_key] = None
        
        # Handle existing brand override
        if existing_brand and not attributes["merkki"]:
            attributes["merkki"] = existing_brand
            
        # Get confidence
        confidence_score = json_response.get("confidence_score", 0)
        confidence = confidence_score / 100.0 if confidence_score else 0.0
        attributes["confidence"] = confidence
        
        return attributes
    
    except json.JSONDecodeError:
        # Fallback for non-JSON responses
        print(f"  ⚠️  Invalid JSON response, attempting basic parsing...")
        
        # Simple fallback - try to extract basic info
        attributes = {
            "merkki": existing_brand if existing_brand else None,
            "malli": None,
            "muisti": None,
            "vari": None,
            "processori": None,
            "näytonohjain": None,
            "ram": None,
            "käyttöjärjestelmä": None,
            "confidence": 0.2  # Low confidence due to parsing failure
        }
        
        return attributes

def check_existing_brand(listing):
    """
    Check if the listing already has brand information in details.
    """
    details = listing.get("details", {})
    
    # Brand-specific field names (fields that typically contain brand info)
    brand_fields = ["Merkki", "Valmistaja", "Tuotemerkki"]
    
    for field in brand_fields:
        if field in details and details[field]:
            return details[field].strip()
    
    return None

def check_exiting_category(listing):
    """
    Check if the listing already has category information in details.
    """
    categories = listing.get("categories", [])  # Fixed: should be [] not {}
    if categories:
        return categories[-1]
    
    return None

async def process_listing(session, semaphore, listing, index, total):
    """
    Process a single listing with semaphore control for concurrency.
    """
    async with semaphore:
        listing_id = listing['listing_id']
        print(f"\n[{index}/{total}] Processing listing {listing_id}...")
        
        # Skip extraction if listing has "Alusta" (Platform) in details
        if "Alusta" in listing.get("details", {}):
            print(f"  ⏭️  Skipping extraction - has platform info: {listing['details']['Alusta']}")
            return listing
        
        # Check for existing brand
        existing_brand = check_existing_brand(listing)
        category = check_exiting_category(listing)
        if existing_brand:
            print(f"  Found existing brand: {existing_brand}")
        
        # Extract attributes
        extracted = await extract_attributes(session, listing, existing_brand, category)
        
        # Create enhanced listing (keep original format)
        enhanced_listing = copy.deepcopy(listing)
        
        # Field mappings from extracted to details keys - now includes all fields
        field_mappings = {
            "merkki": "Merkki",
            "malli": "Malli", 
            "muisti": "Muisti",
            "vari": "Vari",
            "processori": "Processori",
            "näytonohjain": "Näytonohjain",
            "ram": "RAM",
            "käyttöjärjestelmä": "Käyttöjärjestelmä",
        }
        
        # Add extracted fields to details (don't overwrite existing, except model for mobile phones)
        added_fields = []
        for extracted_key, details_key in field_mappings.items():
            if extracted[extracted_key]:  # Only process if we have a value
                is_override = False
                
                if details_key not in enhanced_listing["details"]:
                    # Field doesn't exist, safe to add
                    enhanced_listing["details"][details_key] = extracted[extracted_key]
                    added_fields.append(f"{details_key}: {extracted[extracted_key]}")
                elif extracted_key == "malli" and category == "Matkapuhelimet":
                    # Special case: Override model for mobile phones with AI extraction
                    old_value = enhanced_listing["details"][details_key]
                    enhanced_listing["details"][details_key] = extracted[extracted_key]
                    added_fields.append(f"{details_key}: {old_value} → {extracted[extracted_key]} (OVERRIDDEN)")
                    is_override = True
        
        # Add confidence as metadata
        enhanced_listing["details"]["_extraction_confidence"] = round(extracted["confidence"], 2)
        enhanced_listing["details"]["_extraction_timestamp"] = datetime.now().isoformat()
        
        # Print results
        title_preview = listing.get("title", "")[:60] + "..." if len(listing.get("title", "")) > 60 else listing.get("title", "")
        print(f"  Title: {title_preview}")
        print(f"  Confidence: {extracted['confidence']:.2f}")
        
        # Original details
        original_details = listing.get("details", {})
        enhanced_details = enhanced_listing["details"].copy()
        
        # Remove metadata for cleaner display
        clean_original_details = {k: v for k, v in original_details.items() if not k.startswith('_')}
        clean_enhanced_details = {k: v for k, v in enhanced_details.items() if not k.startswith('_')}
        
        print(f"  📋 ORIGINAL DETAILS:")
        print(f"  {json.dumps(clean_original_details, ensure_ascii=False, indent=4)}")
        
        print(f"  📋 ENHANCED DETAILS:")
        print(f"  {json.dumps(clean_enhanced_details, ensure_ascii=False, indent=4)}")
        
        if added_fields:
            print(f"  ✅ Added {len(added_fields)} new fields")
        else:
            print(f"  ❌ No new attributes extracted")
            
        print()  # Add blank line between listings for readability
        
        return enhanced_listing

async def process_batch(session, semaphore, batch, batch_num, total_batches):
    """
    Process a batch of listings concurrently.
    """
    print(f"\n🔄 Processing batch {batch_num}/{total_batches} ({len(batch)} listings)...")
    start_time = time.time()
    
    # Create tasks for concurrent processing
    tasks = []
    for i, listing in enumerate(batch, 1):
        global_index = (batch_num - 1) * len(batch) + i
        total_listings = total_batches * len(batch)  # Approximate
        task = process_listing(session, semaphore, listing, global_index, total_listings)
        tasks.append(task)
    
    # Process batch concurrently
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Handle any exceptions
    processed_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"  ❌ Error processing listing in batch {batch_num}, item {i+1}: {result}")
            # Add original listing if processing failed
            processed_results.append(batch[i])
        else:
            processed_results.append(result)
    
    batch_time = time.time() - start_time
    print(f"  ✅ Batch {batch_num} completed in {batch_time:.1f}s ({len(batch)/batch_time:.1f} listings/sec)")
    
    return processed_results

async def test_ollama_connection_async():
    """
    Test if Ollama is running and the model is available using async HTTP.
    """
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(f"{OLLAMA_BASE_URL}/api/tags") as response:
                response.raise_for_status()
                
                data = await response.json()
                models = data.get("models", [])
                model_names = [model.get("name", "") for model in models]
                
                if MODEL_NAME not in model_names:
                    print(f"Error: Model '{MODEL_NAME}' not found in Ollama.")
                    print(f"Available models: {', '.join(model_names)}")
                    return False
                
                print(f"✅ Ollama connection successful. Model '{MODEL_NAME}' is available.")
                return True
        
    except Exception as e:
        print(f"❌ Failed to connect to Ollama at {OLLAMA_BASE_URL}")
        print(f"Error: {e}")
        print("Make sure Ollama is running with: ollama serve")
        return False

def load_db_listing_ids(file_path='scripts/listings_from_db.txt'):
    """
    Load listing IDs from the database export file to skip them.
    """
    if not os.path.exists(file_path):
        print(f"Warning: Database listings file not found at {file_path}")
        return set()
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            # Assuming one ID per line
            ids = {line.strip() for line in f if line.strip()}
        print(f"Loaded {len(ids)} listing IDs from the database file to skip.")
        return ids
    except Exception as e:
        print(f"Warning: Could not load listing IDs from {file_path}: {e}")
        return set()

def load_already_processed():
    """
    Load already processed listings from existing enhanced files.
    """
    processed_ids = set()
    
    # Check both enhanced files
    enhanced_files = [
        'scripts/4-extracted_listing_details.json'
    ]
    
    for file_path in enhanced_files:
        if not os.path.exists(file_path):
            continue
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            for listing in data:
                listing_id = listing.get('listing_id')
                if listing_id:
                    # Check if it has extraction data or is a platform listing (skipped)
                    has_confidence = '_extraction_confidence' in listing.get('details', {})
                    has_platform = 'Alusta' in listing.get('details', {})
                    
                    if has_confidence or has_platform:
                        processed_ids.add(listing_id)
            
            print(f"Found {len(processed_ids)} already processed listings in {file_path}")
            
        except Exception as e:
            print(f"Warning: Could not load {file_path}: {e}")
    
    return processed_ids

async def main():
    """
    Main async function to extract attributes from listings.
    """
    # Configuration
    MAX_LISTINGS = None  # Process all listings
    BATCH_SIZE = 20  # Process in batches for progress saving
    
    # Test Ollama connection first
    if not await test_ollama_connection_async():
        return
    
    # Load already processed listings and DB listings
    print("🔍 Checking for already processed listings...")
    processed_ids = load_already_processed()
    db_ids = load_db_listing_ids()
    processed_ids.update(db_ids) # Combine the two sets
    print(f"Found {len(processed_ids)} total listings to skip (from processed files and DB).")
    
    # Load listing data
    try:
        with open('scripts/3-scraped_listing_data.json', 'r', encoding='utf-8') as f:
            listings = json.load(f)
        print(f"Loaded {len(listings)} listings from scripts/3-scraped_listing_data.json")
    except FileNotFoundError:
        print("Error: scripts/3-scraped_listing_data.json not found. Please run the scraper first.")
        return
    except json.JSONDecodeError as e:
        print(f"Error: Failed to parse scripts/3-scraped_listing_data.json - {e}")
        return
    
    # Filter to successful listings only
    successful_listings = [l for l in listings if l.get("status") == "success"]
    print(f"Found {len(successful_listings)} successful listings")
    
    # Filter out already processed listings
    unprocessed_listings = []
    for listing in successful_listings:
        listing_id = listing.get('listing_id')
        if listing_id not in processed_ids:
            unprocessed_listings.append(listing)
    
    print(f"After filtering processed listings: {len(unprocessed_listings)} remaining to process")
    
    # Limit to first MAX_LISTINGS
    listings_to_process = unprocessed_listings[:MAX_LISTINGS]
    print(f"Processing {len(listings_to_process)} listings with async processing")
    print(f"Concurrency limit: {MAX_CONCURRENT_REQUESTS} requests")
    print(f"Batch size: {BATCH_SIZE} listings per batch")
    
    # Create semaphore for concurrency control
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    
    # Split into batches
    batches = [listings_to_process[i:i + BATCH_SIZE] for i in range(0, len(listings_to_process), BATCH_SIZE)]
    total_batches = len(batches)
    
    print(f"Split into {total_batches} batches")
    
    # Load existing results to append to
    output_filename = 'scripts/4-extracted_listing_details.json'
    all_results = []
    
    if os.path.exists(output_filename):
        try:
            with open(output_filename, 'r', encoding='utf-8') as f:
                all_results = json.load(f)
            print(f"📂 Loaded existing results: {len(all_results)} listings")
        except Exception as e:
            print(f"⚠️  Could not load existing results: {e}")
            all_results = []
    
    # Process all batches
    start_time = time.time()
    
    # Create aiohttp session for reuse
    timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)
    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT_REQUESTS * 2)  # Connection pool
    
    try:
        async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
            for batch_num, batch in enumerate(batches, 1):
                batch_results = await process_batch(session, semaphore, batch, batch_num, total_batches)
                all_results.extend(batch_results)
                
                # Save progress after each batch
                with open(output_filename, 'w', encoding='utf-8') as f:
                    json.dump(all_results, f, ensure_ascii=False, indent=2)
                print(f"  💾 Progress saved to {output_filename} ({len(all_results)} total listings)")
                
                # Brief pause between batches to let GPU cool down
                if batch_num < total_batches:
                    await asyncio.sleep(0.5)
    
    except Exception as e:
        print(f"❌ Error during processing: {e}")
        # Save what we have so far
        if all_results:
            with open(output_filename, 'w', encoding='utf-8') as f:
                json.dump(all_results, f, ensure_ascii=False, indent=2)
            print(f"💾 Partial results saved to {output_filename}")
        raise
    
    # Calculate processing statistics
    total_time = time.time() - start_time
    avg_time_per_listing = total_time / len(all_results) if all_results else 0
    
    # Save final results
    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print(f"🎉 Final results saved to {output_filename}")
    
    # Count successes and calculate confidence statistics
    with_brand = len([r for r in all_results if "Merkki" in r.get("details", {})])
    with_model = len([r for r in all_results if "Malli" in r.get("details", {})])
    
    # Count all extracted attributes - updated list
    attribute_counts = {}
    attribute_fields = ["Merkki", "Malli", "Muisti", "Vari", "Processori", "Näytonohjain", "RAM", "Käyttöjärjestelmä"]
    
    for field in attribute_fields:
        count = len([r for r in all_results if field in r.get("details", {})])
        attribute_counts[field] = count
    
    # Calculate confidence statistics  
    confidences = [r.get("details", {}).get("_extraction_confidence", 0) for r in all_results if "_extraction_confidence" in r.get("details", {})]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0
    high_confidence = len([r for r in all_results if r.get("details", {}).get("_extraction_confidence", 0) >= 0.7])
    medium_confidence = len([r for r in all_results if 0.4 <= r.get("details", {}).get("_extraction_confidence", 0) < 0.7])
    low_confidence = len([r for r in all_results if r.get("details", {}).get("_extraction_confidence", 0) < 0.4])
    
    print(f"\n=== ASYNC EXTRACTION COMPLETE ===")
    print(f"⏱️  Total time: {total_time:.1f}s")
    print(f"📊 Average time per listing: {avg_time_per_listing:.2f}s")
    print(f"🚀 Throughput: {len(all_results)/total_time:.2f} listings/sec")
    print(f"📝 Listings processed: {len(all_results)}")
    
    # Show attribute extraction counts
    print(f"\n📊 ATTRIBUTE EXTRACTION RESULTS:")
    for field, count in attribute_counts.items():
        percentage = (count / len(all_results) * 100) if all_results else 0
        print(f"  {field}: {count} ({percentage:.1f}%)")
    
    print(f"\n📈 CONFIDENCE STATISTICS:")
    print(f"Average confidence: {avg_confidence:.3f}")
    print(f"High confidence (≥0.7): {high_confidence} ({high_confidence/len(all_results)*100:.1f}%)")
    print(f"Medium confidence (0.4-0.7): {medium_confidence} ({medium_confidence/len(all_results)*100:.1f}%)")
    print(f"Low confidence (<0.4): {low_confidence} ({low_confidence/len(all_results)*100:.1f}%)")
    print(f"\n📁 All results saved to: {output_filename}")

if __name__ == "__main__":
    asyncio.run(main()) 