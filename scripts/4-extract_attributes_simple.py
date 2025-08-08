#!/usr/bin/env python3
"""Simplified async attribute extraction script with core functionality."""

import json
import asyncio
import aiohttp
import time
import copy
import os
from datetime import datetime

# Ollama configuration
OLLAMA_BASE_URL = "http://localhost:11434"
MODEL_NAME = "hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_XL"
#MODEL_NAME = "qwen-listing-extractor:latest"
#MODEL_NAME = "hf.co/unsloth/Qwen3-14B-GGUF:Q3_K_M"

MAX_CONCURRENT_REQUESTS = 3
REQUEST_TIMEOUT = 60
BATCH_SIZE = 10
OUTPUT_FILE = f"scripts/4-extracted_listing_detailst-Qwen3-8B-GGUF-Q4_K_XL.json"

async def test_connection():
    """Test Ollama connection and model availability."""
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(f"{OLLAMA_BASE_URL}/api/tags") as response:
                response.raise_for_status()
                data = await response.json()
                models = [model.get("name", "") for model in data.get("models", [])]
                
                if MODEL_NAME not in models:
                    print(f"Error: Model '{MODEL_NAME}' not found. Available: {', '.join(models)}")
                    return False
                
                print(f"✅ Connected to Ollama with model '{MODEL_NAME}'")
                return True
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

async def call_ollama(session, prompt, max_retries=3):
    """Call Ollama API with retries."""
    url = f"{OLLAMA_BASE_URL}/api/generate"
    if MODEL_NAME == "hf.co/unsloth/gemma-3n-E4B-it-GGUF:Q4_K_M":
        options = {
            "temperature": 1.0,
            "top_p": 0.95,
            "top_k": 64,
            "min_p": 0,
            "num_predict": 4096,
            "num_ctx": 4096,
        }
    elif MODEL_NAME == "hf.co/unsloth/gemma-3-12b-it-GGUF:Q4_0":
        options = {
            "temperature": 1.0,
            "top_p": 0.95,
            "top_k": 64,
            "min_p": 0,
            "num_predict": 4096,
            "num_ctx": 4096,
        }
    else:
        options = {
            "temperature": 0.7,
            "top_p": 0.8,
            "top_k": 20,
            "min_p": 0,
            "num_predict": 8192,
            "num_ctx": 8192,
        }
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "keep_alive": "5m",
        "options": options
    }
    
    for attempt in range(max_retries):
        try:
            timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)
            async with session.post(url, json=payload, timeout=timeout) as response:
                response.raise_for_status()
                result = await response.json()
                return result.get("response", "").strip() if "response" in result else None
        except (asyncio.TimeoutError, aiohttp.ClientError) as e:
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)
            else:
                print(f"  ⚠️ API call failed after {max_retries} attempts")
                return None
    return None

def create_prompt(title, description, category, existing_brand="Unknown"):
    base_instruction = f"""/no_think Extract product attributes from this Finnish listing. Follow these rules:
1. Extract ONLY explicitly mentioned attributes
2. Use "null" for missing/unclear values
3. Never invent values
4. If listing has clearly multiple brands or models, leave both empty.
5. Output ONLY valid JSON without any additional text

Listing Title: {title}
Listing Description: {description[:1000]}...
Known Brand: {existing_brand}


Instructions: Extract only clearly mentioned attributes. Use null for unclear/missing values."""

    if category == "Pöytäkoneet":
        return f"""{base_instruction}

Return JSON format:
{{
"Brand": "brand or null",
"Model": "model only or null", 
"Color": "color (in english lowercase) or null",
"Processor": "CPU type or null",
"Graphics card": "graphics card or null", 
"RAM": "integer(RAM in GB) or null",
"Operating system": "OS or null",
"Storage": "integer(storage in GB) or null",
"confidence_score": (0-100)
}}"""

    elif category == "Näytöt":
        return f"""{base_instruction}

Return JSON format:
{{
"Brand": "brand or null",
"Model": "model only or null", 
"Size": "integer(screen size in inches) or null",
"Resolution": "integer(resolution in pixels) or null",
"Refresh rate": "integer(refresh rate in Hz) or null",
"Latency": "integer(latency in ms) or null",
"Panel technology": "TN/VA/IPS/OLED or null",
"confidence_score": (0-100)
}}"""

    elif category == "Matkapuhelimet":
        return f"""{base_instruction}

Return JSON format:
{{
"Brand": "brand or null",
"Model": "model only or null",
"Color": "color (in english lowercase) or null",
"RAM": "integer(RAM in GB) or null",
"Storage": "integer(storage in GB) or null",
"Battery_health": "integer(battery health in % only if it is mentioned) or null",
"is_phone": "boolean(true or false (false if it's parts, accessories, screenprotectors ect. or services))",
"confidence_score": (0-100)
}}"""

    elif category == "Tietokonekomponentit":
        return f"""{base_instruction}

Return JSON format:
{{
"Brand": "brand or null",
"Model": "model only or null",
"Type": "Graphics card, CPU, RAM, SSD, HDD, Motherboard, Power supply, Cooling, Case, etc. or null",
"RAM_type": "DDR3, DDR4, DDR5, etc. or null",
"RAM_amount": "integer(RAM in GB) or null",
"Storage_type": "SSD, HDD, NVMe, etc. or null",
"Storage_size": "integer(storage in GB) or null",
"Storage_speed": "integer(storage speed in GB/s) or null",
"Form_factor": "ATX, Micro-ATX, Mini-ITX, etc. or null",
"Socket": "socket or null",
"Power_consumption": "integer(power consumption in watts) or null",
"Cooling_type": "air, liquid, etc. or null",
"confidence_score": (0-100)
}}"""
    
    elif category == "Kannettavat tietokoneet":
        return f"""{base_instruction}

        

Return JSON format:
{{
"Brand": "brand or null",
"Model": "model or null (Include only the base model, not the screen size)",
"Storage": "integer(storage in GB) or null",
"Color": "color (in english lowercase) or null",
"Processor": "null if unclear, if it's a MacBook, you can use the aviable processors from the list below",
"Screen size": "integer(screen size in inches, you can round it to the nearest integer) or null",
"Graphics card": "graphics card or null",
"RAM": "integer(RAM in GB) or null",
"Operating system": "macOS or null",
"Year": "integer(year) or null",
"confidence_score": (0-100)
}}

aviable processors(ignore if not a MacBook):
    Intel Processors: Core 2 Duo, Core i3/i5/i7/i9, Xeon
    Apple Silicon: M1, M1 Pro/M1 Max, M2, M2 Pro/M2 Max, M3, M3 Pro/M3 Max, M4, M4 Pro/M4 Max

"""

    else:  # General
        return f"""{base_instruction}

Return JSON format:
{{
"Brand": "brand or null",
"Model": "model only or null",
"Storage": "integer(storage in GB) or null",
"Color": "color (in english lowercase) or null",
"Year": "integer(year) or null",
"confidence_score": (0-100)
}}"""

def get_existing_brand(listing):
    """Extract existing brand from listing details."""
    details = listing.get("details", {})
    for field in ["Brand", "Manufacturer", "Brand"]:
        if field in details and details[field]:
            return details[field].strip()
    return None

def get_category(listing):
    """Get listing category for prompt selection."""
    categories = listing.get("categories", [])
    if categories:
        last_category = categories[-1]
        if "Pöytäkoneet" in last_category:
            return "Pöytäkoneet"
        elif "Matkapuhelimet" in last_category:
            return "Matkapuhelimet"
        elif "Näytöt" in last_category:
            return "Näytöt"
        elif "Tietokonekomponentit" in last_category:
            return "Tietokonekomponentit"
        elif "Kannettavat tietokoneet" in last_category:
            return "Kannettavat tietokoneet"
    return "General"

def fix_boolean_values(attributes):
    """Convert string boolean values to actual booleans."""
    boolean_fields = ["is_phone"]  # Add more boolean fields as needed
    
    for field in boolean_fields:
        if field in attributes:
            value = attributes[field]
            if isinstance(value, str):
                value_lower = value.lower().strip()
                # FIXED: Handle more boolean variations including uppercase
                if value_lower in ["true", "1", "yes", "on"]:
                    attributes[field] = True
                elif value_lower in ["false", "0", "no", "off"]:
                    attributes[field] = False
                else:
                    # If it's not a clear boolean string, remove it
                    print(f"  ⚠️ Removing unclear boolean value: {field}='{value}'")
                    del attributes[field]
            elif isinstance(value, bool):
                # Already a boolean, keep as is
                pass
            else:
                # Not a string or boolean, remove it
                print(f"  ⚠️ Removing non-boolean value: {field}='{value}' (type: {type(value)})")
                del attributes[field]
    
    return attributes

async def extract_attributes(session, listing):
    """Extract attributes from a single listing."""
    title = listing.get("title", "")
    description = listing.get("description", "")
    
    if not title and not description:
        return {"confidence": 0.0}
    
    # Skip if has platform info
    if "Alusta" in listing.get("details", {}):
        return {"confidence": 1.0, "skipped": "platform"}
    
    existing_brand = get_existing_brand(listing)
    category = get_category(listing)
    prompt = create_prompt(title, description, category, existing_brand or "Unknown")
    
    response = await call_ollama(session, prompt)
    if not response:
        return {"confidence": 0.0}
    
    # Parse JSON response
    try:
        json_start = response.find('{')
        json_end = response.rfind('}') + 1
        
        if json_start != -1 and json_end > json_start:
            json_response = json.loads(response[json_start:json_end])
        else:
            json_response = json.loads(response)
        
        # Clean and extract attributes
        attributes = {}
        fields = [
            "Brand", "Model", "Storage", "Color", "Processor", "Graphics card", 
            "RAM", "Operating system", "Year", "Size", "Resolution", 
            "Refresh rate", "Latency", "Panel technology", "Type", "RAM_type",
            "RAM_amount", "Storage_type", "Storage_size", "Storage_speed",
            "Form_factor", "Socket", "Power_consumption", "Cooling_type", 
            "Battery_health", "is_phone", "Screen size"
        ]
        
        for field in fields:
            value = json_response.get(field)
            if value and (not isinstance(value, str) or value.lower() not in ["null", "unknown", "unclear", ""]):
                # Try to parse numbers for certain fields
                if field in ["Year", "RAM_amount", "Storage_size", "Storage_speed", "Power_consumption", "Refresh rate", "Latency"]:
                    # Remove non-digit characters except dot and try to convert
                    if isinstance(value, str):
                        import re
                        num_str = re.sub(r"[^\d.]", "", value)
                        try:
                            # Use int if possible, else float
                            if num_str.isdigit():
                                value = int(num_str)
                            else:
                                value = float(num_str)
                        except Exception:
                            pass  # fallback to original value if conversion fails
                attributes[field] = value
        # Prioritize existing brand over extracted brand
        if existing_brand:
            attributes["Brand"] = existing_brand
        
        # Fix boolean values that might be strings
        attributes = fix_boolean_values(attributes)
        
        # Get confidence
        confidence = json_response.get("confidence_score", 0) / 100.0
        attributes["_extraction_confidence"] = round(confidence, 2)
        attributes["_extraction_timestamp"] = datetime.now().isoformat()
        
        return attributes
        
    except json.JSONDecodeError:
        return {"confidence": 0.2, "Brand": existing_brand} if existing_brand else {"confidence": 0.2}

async def process_listing(session, semaphore, listing):
    """Process single listing with concurrency control."""
    async with semaphore:
        listing_id = listing['listing_id']
        extracted = await extract_attributes(session, listing)
        
        # Create enhanced listing
        enhanced = copy.deepcopy(listing)
        
        if "skipped" in extracted:
            return enhanced
        
        # Add extracted attributes to details
        for key, value in extracted.items():
            if not key.startswith('_') or key in ['_extraction_confidence', '_extraction_timestamp']:
                enhanced["details"][key] = value
        
        return enhanced

async def process_batch(session, semaphore, batch, batch_num, total_batches):
    """Process batch of listings concurrently."""
    print(f"Processing batch {batch_num}/{total_batches} ({len(batch)} listings)...")
    
    tasks = [process_listing(session, semaphore, listing) for listing in batch]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Handle exceptions
    processed = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"  Error in listing {i+1}: {result}")
            processed.append(batch[i])  # Use original
        else:
            processed.append(result)
    
    return processed

def load_ids_to_skip(file_path='scripts/listings_from_db.txt'):
    """Load listing IDs from a file to skip them."""
    if not os.path.exists(file_path):
        return set()
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return {line.strip() for line in f if line.strip()}
    except Exception as e:
        print(f"Warning: Could not load IDs to skip from {file_path}: {e}")
        return set()

async def main():
    """Main execution function."""
    print("🚀 Starting simplified attribute extraction...")
    
    # Test connection
    if not await test_connection():
        return
    
    # Load data
    try:
        with open('scripts/3-scraped_listing_data-gwen.json', 'r', encoding='utf-8') as f:
            listings = json.load(f)
    except FileNotFoundError:
        print("Error: scripts/3-scraped_listing_data.json not found")
        return
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON - {e}")
        return
    
    # Load IDs to skip
    ids_to_skip = load_ids_to_skip()
    print(f"Found {len(ids_to_skip)} IDs to skip from the database file.")
    
    # Filter successful listings and those not to be skipped
    successful = [
        l for l in listings 
        if l.get("status") == "success" and l.get("listing_id") not in ids_to_skip
    ]
    print(f"Processing {len(successful)} new successful listings...")
    
    # Setup concurrency
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    batches = [successful[i:i + BATCH_SIZE] for i in range(0, len(successful), BATCH_SIZE)]
    
    start_time = time.time()
    output_file = OUTPUT_FILE
    
    # Load existing results if file exists
    all_results = []
    if os.path.exists(output_file):
        try:
            with open(output_file, 'r', encoding='utf-8') as f:
                all_results = json.load(f)
            print(f"📂 Loaded existing results: {len(all_results)} listings")
        except Exception as e:
            print(f"⚠️ Could not load existing results: {e}")
            all_results = []
    
    # Process all batches
    timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)
    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT_REQUESTS * 2)
    
    try:
        async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
            for batch_num, batch in enumerate(batches, 1):
                batch_results = await process_batch(session, semaphore, batch, batch_num, len(batches))
                all_results.extend(batch_results)
                
                # Save every 100 listings (approximately every 5 batches)
                if len(all_results) % 5 == 0:
                    with open(output_file, 'w', encoding='utf-8') as f:
                        json.dump(all_results, f, ensure_ascii=False, indent=2)
                    print(f"  💾 Progress saved: {len(all_results)} listings")
                
                if batch_num < len(batches):
                    await asyncio.sleep(0.01)  # Brief pause
    
    except Exception as e:
        print(f"❌ Processing error: {e}")
        # Save what we have so far
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_results, f, ensure_ascii=False, indent=2)
        print(f"💾 Partial results saved: {len(all_results)} listings")
        return
    
    # Final save
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    
    # Basic statistics
    total_time = time.time() - start_time
    extracted_count = len([r for r in all_results if "_extraction_confidence" in r.get("details", {})])
    avg_confidence = sum(r.get("details", {}).get("_extraction_confidence", 0) 
                        for r in all_results if "_extraction_confidence" in r.get("details", {}))
    avg_confidence = avg_confidence / extracted_count if extracted_count > 0 else 0
    
    print(f"\n✅ Extraction complete!")
    print(f"⏱️  Total time: {total_time:.1f}s")
    print(f"📊 Processed: {len(all_results)} listings")
    print(f"🎯 Extracted: {extracted_count} listings ({extracted_count/len(all_results)*100:.1f}%)")
    print(f"📈 Average confidence: {avg_confidence:.2f}")
    print(f"💾 Results saved to: {output_file}")

if __name__ == "__main__":
    asyncio.run(main()) 