import json
import re
from collections import defaultdict
from difflib import get_close_matches
import os

def load_json_data(filename):
    """Load JSON data from file."""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading JSON file: {e}")
        return []

def analyze_models(data):
    """Analyze current model names to understand patterns."""
    models = defaultdict(int)
    
    for item in data:
        details = item.get('details', {})
        model = details.get('Model', '').strip()
        if model:
            models[model] += 1
    
    print(f"Found {len(models)} unique model names")
    print("\nTop 20 most common models:")
    for model, count in sorted(models.items(), key=lambda x: x[1], reverse=True)[:20]:
        print(f"  \"{model}\" ({count} listings)")
    
    return models

def load_model_database():
    """Load model database from JSON file."""
    db_file = 'scripts/model_database.json'
    default_models_file = 'scripts/default_models.json'
    
    # Try to load from working database file first
    if os.path.exists(db_file):
        try:
            with open(db_file, 'r', encoding='utf-8') as f:
                loaded_models = json.load(f)
                print(f"Loaded {len(loaded_models)} models from {db_file}")
                return loaded_models
        except Exception as e:
            print(f"Error loading model database: {e}")
    
    # Try to load from default models file
    if os.path.exists(default_models_file):
        try:
            with open(default_models_file, 'r', encoding='utf-8') as f:
                default_models = json.load(f)
                print(f"Loaded {len(default_models)} models from {default_models_file}")
                
                # Create working database file from default
                try:
                    with open(db_file, 'w', encoding='utf-8') as f:
                        json.dump(default_models, f, ensure_ascii=False, indent=2)
                    print(f"Created working database: {db_file}")
                except Exception as e:
                    print(f"Warning: Could not create working database: {e}")
                
                return default_models
        except Exception as e:
            print(f"Error loading default models: {e}")
    
    # If no files found, create minimal fallback
    print(f"Warning: Neither {db_file} nor {default_models_file} found!")
    print("Creating minimal fallback model database...")
    
    fallback_models = [
        'iPhone 11', 'iPhone 12', 'iPhone 13', 'iPhone 14', 'iPhone 15',
        'Samsung Galaxy S21', 'Samsung Galaxy S22', 'Samsung Galaxy S23'
    ]
    
    return fallback_models

def fuzzy_match_model(input_model, model_database, threshold=0.6):
    """Find the best fuzzy match for a model name."""
    if not input_model or not model_database:
        return None
    
    # Clean input for better matching
    cleaned_input = input_model.strip().lower()
    
    # Create lowercase version of database for matching
    lowercase_db = [model.lower() for model in model_database]
    
    # Find close matches
    matches = get_close_matches(
        cleaned_input, 
        lowercase_db, 
        n=3,  # Get top 3 matches
        cutoff=threshold  # Minimum similarity
    )
    
    if matches:
        # Return the original case version of the best match
        best_match_lower = matches[0]
        for i, model_lower in enumerate(lowercase_db):
            if model_lower == best_match_lower:
                return model_database[i]
    
    return None

def smart_correct_model(model_name):
    """Apply smart corrections to model names."""
    if not model_name:
        return model_name
    
    original = model_name
    corrected = model_name.strip()
    
    # Basic iPhone patterns
    corrected = re.sub(r'\biphone\s+(\d+)', r'iPhone \1', corrected, flags=re.IGNORECASE)
    corrected = re.sub(r'\biphone\s+(x[rs]?|se)\b', r'iPhone \1', corrected, flags=re.IGNORECASE)
    corrected = re.sub(r'\biphone\s+(3g|3gs)\b', r'iPhone \1', corrected, flags=re.IGNORECASE)
    
    # iPhone with Pro/Plus/Mini/Max variants
    corrected = re.sub(r'\biphone\s+(\d+)\s+(pro|plus|mini|max)\b', r'iPhone \1 \2', corrected, flags=re.IGNORECASE)
    corrected = re.sub(r'\biphone\s+(\d+)\s+(pro)\s+(max)\b', r'iPhone \1 \2 \3', corrected, flags=re.IGNORECASE)
    corrected = re.sub(r'\biphone\s+(x[rs]?)\s+(max)\b', r'iPhone \1 \2', corrected, flags=re.IGNORECASE)
    
    # iPhone SE variants
    corrected = re.sub(r'\biphone\s+se\s+(\d+)\w*\s+gen', r'iPhone SE (\1 gen)', corrected, flags=re.IGNORECASE)
    
    # Fix capitalization issues
    corrected = re.sub(r'\biPhone\s+(\d+)([a-z])', r'iPhone \1\2', corrected, flags=re.IGNORECASE)
    corrected = re.sub(r'\biPhone\s+(3G|3GS|X|XR|XS|SE)\b', lambda m: f'iPhone {m.group(1).upper()}', corrected, flags=re.IGNORECASE)
    corrected = re.sub(r'\biPhone\s+(\d+)\s+(Pro|Plus|Mini|Max)\b', lambda m: f'iPhone {m.group(1)} {m.group(2).capitalize()}', corrected, flags=re.IGNORECASE)
    
    # Samsung patterns
    corrected = re.sub(r'\bsamsung\s+galaxy\s+([sn]\d+)', r'Samsung Galaxy \1', corrected, flags=re.IGNORECASE)
    corrected = re.sub(r'\bgalaxy\s+([sn]\d+)', r'Samsung Galaxy \1', corrected, flags=re.IGNORECASE)
    
    # Huawei patterns
    corrected = re.sub(r'\bhuawei\s+([pm]\d+)', r'Huawei \1', corrected, flags=re.IGNORECASE)
    corrected = re.sub(r'\bhuawei\s+(mate\s*\d*)', r'Huawei \1', corrected, flags=re.IGNORECASE)
    
    # Xiaomi patterns
    corrected = re.sub(r'\bxiaomi\s+(redmi|mi)', r'Xiaomi \1', corrected, flags=re.IGNORECASE)
    corrected = re.sub(r'\bredmi\s+(note\s*\d*)', r'Xiaomi Redmi \1', corrected, flags=re.IGNORECASE)
    
    # OnePlus patterns
    corrected = re.sub(r'\boneplus\s+(\d+|nord)', r'OnePlus \1', corrected, flags=re.IGNORECASE)
    
    # Nokia patterns
    corrected = re.sub(r'\bnokia\s+(\d+)', r'Nokia \1', corrected, flags=re.IGNORECASE)
    
    # Clean up extra spaces
    corrected = re.sub(r'\s+', ' ', corrected).strip()
    
    # Capitalize first letter of each word for unknown models
    if corrected.islower():
        corrected = corrected.title()
    
    return corrected

def fix_model_names(data):
    """Fix model names in the data using fuzzy matching."""
    model_database = load_model_database()
    fixed_count = 0
    changes = []
    unsuccessful = []
    fuzzy_matches = 0
    smart_corrections = 0
    
    for item in data:
        details = item.get('details', {})
        if 'Model' in details:
            original_model = details['Model']
            corrected_model = original_model
            match_type = None
            
            # Method 1: Try fuzzy matching first (most accurate)
            fuzzy_match = fuzzy_match_model(original_model, model_database, threshold=0.4)
            if fuzzy_match and fuzzy_match != original_model:
                corrected_model = fuzzy_match
                match_type = "fuzzy"
                fuzzy_matches += 1
            
            # Method 2: If no fuzzy match, try smart pattern corrections
            elif corrected_model == original_model:
                smart_corrected = smart_correct_model(original_model)
                if smart_corrected != original_model:
                    corrected_model = smart_corrected
                    match_type = "smart"
                    smart_corrections += 1
            
            # Apply the correction if we found one
            if corrected_model != original_model:
                details['Model'] = corrected_model
                changes.append((original_model, corrected_model, match_type))
                fixed_count += 1
            else:
                # No correction found - add to unsuccessful list
                unsuccessful.append(original_model)
    
    print(f"Correction methods used:")
    print(f"  - Fuzzy matching: {fuzzy_matches}")
    print(f"  - Smart patterns: {smart_corrections}")
    
    return fixed_count, changes, unsuccessful

def main():
    input_file = 'scripts/4-extracted_listing_details.json'
    output_file = 'scripts/4-extracted_listing_details.json'
    
    print("=== MODEL NAME CORRECTION SCRIPT ===")
    print("Loading JSON data...")
    data = load_json_data(input_file)
    
    if not data:
        print("No data to process.")
        return
    
    print(f"Loaded {len(data)} listings")
    
    # Analyze current models
    print("\n=== ANALYZING CURRENT MODELS ===")
    models_before = analyze_models(data)
    
    # Fix model names
    print("\n=== FIXING MODEL NAMES ===")
    fixed_count, changes, unsuccessful = fix_model_names(data)
    print(f"Fixed {fixed_count} model names")
    
    # Show only unsuccessful matches
    print("\n=== UNSUCCESSFUL MATCHES ===")
    unique_unsuccessful = list(set(unsuccessful))
    if unique_unsuccessful:
        print(f"Found {len(unique_unsuccessful)} models that couldn't be corrected:")
        for i, model in enumerate(sorted(unique_unsuccessful), 1):
            print(f"  {i:2d}. \"{model}\"")
    else:
        print("🎉 All models were successfully corrected!")
    
    # Analyze after fixing
    print("\n=== ANALYZING FIXED MODELS ===")
    models_after = analyze_models(data)
    
    # Save fixed data
    print(f"\n=== SAVING FIXED DATA ===")
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✅ Saved fixed data to {output_file}")
        print(f"📊 Total listings: {len(data)}")
        print(f"🔧 Models fixed: {fixed_count}")
        print(f"📝 Use the fixed file: {output_file}")
    except Exception as e:
        print(f"❌ Error saving file: {e}")

if __name__ == "__main__":
    main() 