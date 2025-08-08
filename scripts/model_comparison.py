import json
import requests
import time
from datetime import datetime
import re
import copy
from statistics import mean, median
import traceback

# Ollama API configuration
OLLAMA_BASE_URL = "http://localhost:11434"

# Models to compare
MODELS_TO_TEST = [
    "hf.co/unsloth/Qwen3-8B-GGUF:Q4_K_M", 
    "hf.co/unsloth/Qwen3-8B-GGUF:Q6_K",
    "phi4-mini:3.8b",
    "hf.co/unsloth/gemma-3n-E4B-it-GGUF:UD-Q4_K_XL",
    "qwen3:8b",
    "hf.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF:Q6_K",
]

def call_ollama(prompt, model_name, max_retries=3):
    """
    Call Ollama API with the given prompt and model.
    """
    url = f"{OLLAMA_BASE_URL}/api/generate"
    
    payload = {
        "model": model_name,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 20,
            "min_p": 0,
        }
    }
    
    start_time = time.time()
    
    for attempt in range(max_retries):
        try:
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()
            
            result = response.json()
            if "response" in result:
                end_time = time.time()
                return result["response"].strip(), end_time - start_time
            else:
                print(f"Warning: Unexpected response format: {result}")
                return None, None
                
        except requests.exceptions.RequestException as e:
            print(f"Attempt {attempt + 1} failed for {model_name}: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff
            else:
                print(f"Failed to get response after {max_retries} attempts")
                return None, None
        except Exception as e:
            print(f"Unexpected error: {e}")
            return None, None
    
    return None, None

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
    "confidence_score": 85
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
    "confidence_score": 85
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
    "confidence_score": 85
    }}

    Respond with valid JSON only:"""

    return prompt

def extract_attributes_with_model(listing, model_name, existing_brand=None, category=None):
    """
    Extract product attributes from a listing using a specific model.
    """
    listing_id = listing.get("listing_id", "unknown")
    title = listing.get("title", "")
    description = listing.get("description", "")
    
    if not title and not description:
        return {
            "listing_id": listing_id,
            "merkki": None, 
            "malli": None,
            "muisti": None,
            "vari": None,
            "processori": None,
            "näytonohjain": None,
            "ram": None,
            "käyttöjärjestelmä": None,
            "confidence": 0.0,
            "response_time": 0.0,
            "json_valid": False,
            "error": "No title or description"
        }
    
    # Create prompt based on category
    if category == "Pöytäkoneet":
        prompt = create_extraction_prompt_for_desktop(title, description, existing_brand)
    elif category == "Matkapuhelimet":
        prompt = create_extraction_prompt_smartphone(title, description, existing_brand)
    else:
        prompt = create_extraction_prompt_for_general(title, description, existing_brand)
    
    # Get response from model
    response, response_time = call_ollama(prompt, model_name)
    
    if not response:
        return {
            "listing_id": listing_id,
            "merkki": None, 
            "malli": None,
            "muisti": None,
            "vari": None,
            "processori": None,
            "näytonohjain": None,
            "ram": None,
            "käyttöjärjestelmä": None,
            "confidence": 0.0,
            "response_time": 0.0,
            "json_valid": False,
            "error": "No response from model"
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
        
        # Field mappings
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
        
        attributes.update({
            "listing_id": listing_id,
            "confidence": confidence,
            "response_time": response_time,
            "json_valid": True,
            "error": None
        })
        
        return attributes
    
    except json.JSONDecodeError as e:
        # JSON parsing failed
        attributes = {
            "listing_id": listing_id,
            "merkki": existing_brand if existing_brand else None,
            "malli": None,
            "muisti": None,
            "vari": None,
            "processori": None,
            "näytonohjain": None,
            "ram": None,
            "käyttöjärjestelmä": None,
            "confidence": 0.0,
            "response_time": response_time,
            "json_valid": False,
            "error": f"JSON parsing failed: {str(e)}"
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

def check_existing_category(listing):
    """
    Check if the listing already has category information.
    """
    categories = listing.get("categories", [])
    if categories:
        return categories[-1]
    
    return None

def test_model_availability():
    """
    Test which models are available in Ollama.
    """
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=10)
        response.raise_for_status()
        
        models = response.json().get("models", [])
        available_models = [model.get("name", "") for model in models]
        
        return available_models
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to connect to Ollama at {OLLAMA_BASE_URL}")
        print(f"Error: {e}")
        return []

def calculate_model_metrics(results):
    """
    Calculate comprehensive metrics for a model's performance.
    """
    if not results:
        return {
            "total_processed": 0,
            "json_success_rate": 0.0,
            "avg_confidence": 0.0,
            "avg_response_time": 0.0,
            "extraction_rates": {},
            "error_rate": 1.0
        }
    
    # Basic metrics
    total_processed = len(results)
    json_valid_count = len([r for r in results if r.get("json_valid", False)])
    json_success_rate = json_valid_count / total_processed if total_processed > 0 else 0
    
    # Confidence metrics
    confidences = [r.get("confidence", 0) for r in results if r.get("json_valid", False)]
    avg_confidence = mean(confidences) if confidences else 0
    
    # Response time metrics
    response_times = [r.get("response_time", 0) for r in results if r.get("response_time", 0) > 0]
    avg_response_time = mean(response_times) if response_times else 0
    
    # Extraction rate for each field
    field_names = ["merkki", "malli", "muisti", "vari", "processori", "näytonohjain", "ram", "käyttöjärjestelmä"]
    extraction_rates = {}
    
    for field in field_names:
        extracted_count = len([r for r in results if r.get(field) is not None])
        extraction_rates[field] = extracted_count / total_processed if total_processed > 0 else 0
    
    # Error rate
    error_count = len([r for r in results if r.get("error") is not None])
    error_rate = error_count / total_processed if total_processed > 0 else 0
    
    return {
        "total_processed": total_processed,
        "json_success_rate": json_success_rate,
        "avg_confidence": avg_confidence,
        "median_confidence": median(confidences) if confidences else 0,
        "avg_response_time": avg_response_time,
        "median_response_time": median(response_times) if response_times else 0,
        "extraction_rates": extraction_rates,
        "error_rate": error_rate,
        "confidence_distribution": {
            "high_confidence_count": len([c for c in confidences if c >= 0.7]),
            "medium_confidence_count": len([c for c in confidences if 0.4 <= c < 0.7]),
            "low_confidence_count": len([c for c in confidences if c < 0.4])
        }
    }

def main():
    """
    Main function to compare models on attribute extraction.
    """
    # Configuration
    MAX_LISTINGS = 50  # Test on 50 listings for comparison
    
    print("🚀 Starting model comparison for attribute extraction...")
    print(f"Testing on {MAX_LISTINGS} listings")
    
    # Check available models
    available_models = test_model_availability()
    if not available_models:
        print("❌ No models available in Ollama. Make sure Ollama is running.")
        return
    
    print(f"📋 Available models: {available_models}")
    
    # Filter to only test available models
    models_to_test = [model for model in MODELS_TO_TEST if model in available_models]
    unavailable_models = [model for model in MODELS_TO_TEST if model not in available_models]
    
    if unavailable_models:
        print(f"⚠️  Models not available: {unavailable_models}")
    
    if not models_to_test:
        print("❌ None of the test models are available in Ollama.")
        return
    
    print(f"🧪 Testing models: {models_to_test}")
    
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
    
    # Limit to test set
    test_listings = successful_listings[:MAX_LISTINGS]
    print(f"Testing on {len(test_listings)} listings")
    
    # Results storage
    comparison_results = {
        "test_config": {
            "timestamp": datetime.now().isoformat(),
            "total_listings_tested": len(test_listings),
            "models_tested": models_to_test,
            "models_unavailable": unavailable_models
        },
        "model_results": {}
    }
    
    # Test each model
    for model_name in models_to_test:
        print(f"\n🔍 Testing model: {model_name}")
        model_results = []
        
        start_time = time.time()
        
        for i, listing in enumerate(test_listings, 1):
            print(f"  [{i}/{len(test_listings)}] Processing listing {listing['listing_id']}...")
            
            # Skip extraction if listing has "Alusta" (Platform) in details
            if "Alusta" in listing.get("details", {}):
                continue
            
            # Check for existing brand and category
            existing_brand = check_existing_brand(listing)
            category = check_existing_category(listing)
            
            # Extract attributes
            try:
                extracted = extract_attributes_with_model(listing, model_name, existing_brand, category)
                model_results.append(extracted)
            except Exception as e:
                print(f"    ❌ Error processing listing: {e}")
                model_results.append({
                    "listing_id": listing.get("listing_id", "unknown"),
                    "merkki": None, "malli": None, "muisti": None, "vari": None,
                    "processori": None, "näytonohjain": None, "ram": None, "käyttöjärjestelmä": None,
                    "confidence": 0.0, "response_time": 0.0, "json_valid": False,
                    "error": f"Processing error: {str(e)}"
                })
            
            # Small delay to be respectful to the API
            time.sleep(0.1)
        
        total_time = time.time() - start_time
        
        # Calculate metrics for this model
        metrics = calculate_model_metrics(model_results)
        metrics["total_test_time"] = total_time
        
        comparison_results["model_results"][model_name] = {
            "metrics": metrics,
            "individual_results": model_results
        }
        
        print(f"  ✅ Completed {model_name}")
        print(f"     JSON Success Rate: {metrics['json_success_rate']:.2%}")
        print(f"     Avg Confidence: {metrics['avg_confidence']:.3f}")
        print(f"     Avg Response Time: {metrics['avg_response_time']:.2f}s")
        print(f"     Error Rate: {metrics['error_rate']:.2%}")
    
    # Save results
    output_filename = f'model_comparison_results_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(comparison_results, f, ensure_ascii=False, indent=2)
    
    print(f"\n🎯 COMPARISON COMPLETE")
    print(f"Results saved to: {output_filename}")
    
    # Print summary comparison
    print(f"\n📊 MODEL COMPARISON SUMMARY:")
    print(f"{'Model':<50} {'JSON Success':<12} {'Avg Conf':<10} {'Avg Time':<10} {'Error Rate':<10}")
    print("-" * 100)
    
    for model_name, results in comparison_results["model_results"].items():
        metrics = results["metrics"]
        model_short = model_name.split("/")[-1] if "/" in model_name else model_name
        print(f"{model_short:<50} {metrics['json_success_rate']:<11.2%} "
              f"{metrics['avg_confidence']:<9.3f} {metrics['avg_response_time']:<9.2f}s "
              f"{metrics['error_rate']:<9.2%}")
    
    # Return results as JSON for programmatic use
    return comparison_results

if __name__ == "__main__":
    results = main()
    if results:
        # Print final JSON result
        print(f"\n📋 FINAL JSON RESULTS:")
        print(json.dumps(results, ensure_ascii=False, indent=2)) 