import json
import requests
import time
from datetime import datetime
import re
import copy

# Ollama API configuration
OLLAMA_BASE_URL = "http://localhost:11434"
MODEL_NAME = "hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_M"

def call_ollama(prompt, max_retries=3):
    """
    Call Ollama API with the given prompt.
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
            response = requests.post(url, json=payload, timeout=40)
            response.raise_for_status()
            
            result = response.json()
            if "response" in result:
                return result["response"].strip()
            else:
                print(f"Warning: Unexpected response format: {result}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff
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
    "confidence_score": 
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

def extract_attributes(listing, existing_brand=None, category=None):
    """
    Extract product attributes from a listing.
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
    else:
        prompt = create_extraction_prompt_for_general(title, description, existing_brand)
    
    # Get response from model
    response = call_ollama(prompt)
    
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

def test_ollama_connection():
    """
    Test if Ollama is running and the model is available.
    """
    try:
        # Test basic connection
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        response.raise_for_status()
        
        models = response.json().get("models", [])
        model_names = [model.get("name", "") for model in models]
        
        if MODEL_NAME not in model_names:
            print(f"Error: Model '{MODEL_NAME}' not found in Ollama.")
            print(f"Available models: {', '.join(model_names)}")
            return False
        
        print(f"✅ Ollama connection successful. Model '{MODEL_NAME}' is available.")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to connect to Ollama at {OLLAMA_BASE_URL}")
        print(f"Error: {e}")
        print("Make sure Ollama is running with: ollama serve")
        return False

def main():
    """
    Main function to extract attributes from listings.
    """
    # Configuration
    MAX_LISTINGS = None  # Process first 1000 for testing
    SAVE_INTERVAL = 100  # Save progress every 100 listings
    
    # Test Ollama connection first
    if not test_ollama_connection():
        return
    
    # Load listing data
    try:
        with open('listing_data_new.json', 'r', encoding='utf-8') as f:
            listings = json.load(f)
        print(f"Loaded {len(listings)} listings from listing_data_new.json")
    except FileNotFoundError:
        print("Error: listing_data_new.json not found. Please run the scraper first.")
        return
    except json.JSONDecodeError as e:
        print(f"Error: Failed to parse listing_data_new.json - {e}")
        return
    
    # Filter to successful listings only
    successful_listings = [l for l in listings if l.get("status") == "success"]
    print(f"Found {len(successful_listings)} successful listings")
    
    # Limit to first MAX_LISTINGS
    listings_to_process = successful_listings[:MAX_LISTINGS]
    print(f"Processing first {len(listings_to_process)} listings for testing")
    
    # Process listings
    results = []
    
    for i, listing in enumerate(listings_to_process, 1):
        print(f"\n[{i}/{len(listings_to_process)}] Processing listing {listing['listing_id']}...")
        
        # Skip extraction if listing has "Alusta" (Platform) in details
        if "Alusta" in listing.get("details", {}):
            print(f"  ⏭️  Skipping extraction - has platform info: {listing['details']['Alusta']}")
            # Add to results without extraction
            results.append(listing)
            continue
        
        # Check for existing brand
        existing_brand = check_existing_brand(listing)
        category = check_exiting_category(listing)
        if existing_brand:
            print(f"  Found existing brand: {existing_brand}")
        
        # Extract attributes
        extracted = extract_attributes(listing, existing_brand, category)
        
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
        
        results.append(enhanced_listing)
        
        # Print raw JSON comparison
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
        
        # Save progress periodically
        if i % SAVE_INTERVAL == 0:
            output_filename = 'listing_data_enhanced.json'
            with open(output_filename, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            print(f"  💾 Progress saved to {output_filename}")
        
        # Small delay to be respectful to the API
        time.sleep(0.01)
    
    # Save final results
    output_filename = 'listing_data_enhanced_test.json'
    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    

    # Count successes and calculate confidence statistics
    with_brand = len([r for r in results if "Merkki" in r.get("details", {})])
    with_model = len([r for r in results if "Malli" in r.get("details", {})])
    
    # Count all extracted attributes - updated list
    attribute_counts = {}
    attribute_fields = ["Merkki", "Malli", "Muisti", "Vari", "Processori", "Näytonohjain", "RAM", "Käyttöjärjestelmä"]
    
    for field in attribute_fields:
        count = len([r for r in results if field in r.get("details", {})])
        attribute_counts[field] = count
    
    # Calculate confidence statistics  
    confidences = [r.get("details", {}).get("_extraction_confidence", 0) for r in results if "_extraction_confidence" in r.get("details", {})]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0
    high_confidence = len([r for r in results if r.get("details", {}).get("_extraction_confidence", 0) >= 0.7])
    medium_confidence = len([r for r in results if 0.4 <= r.get("details", {}).get("_extraction_confidence", 0) < 0.7])
    low_confidence = len([r for r in results if r.get("details", {}).get("_extraction_confidence", 0) < 0.4])
    
    print(f"\n=== EXTRACTION COMPLETE ===")
    print(f"Listings processed: {len(results)}")
    
    # Show attribute extraction counts
    print(f"\n📊 ATTRIBUTE EXTRACTION RESULTS:")
    for field, count in attribute_counts.items():
        percentage = (count / len(results) * 100) if results else 0
        print(f"  {field}: {count} ({percentage:.1f}%)")
    
    print(f"\n📈 CONFIDENCE STATISTICS:")
    print(f"Average confidence: {avg_confidence:.3f}")
    print(f"High confidence (≥0.7): {high_confidence} ({high_confidence/len(results)*100:.1f}%)")
    print(f"Medium confidence (0.4-0.7): {medium_confidence} ({medium_confidence/len(results)*100:.1f}%)")
    print(f"Low confidence (<0.4): {low_confidence} ({low_confidence/len(results)*100:.1f}%)")
    print(f"\nResults saved to: {output_filename}")

if __name__ == "__main__":
    main() 