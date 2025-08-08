import json
import re
from collections import defaultdict

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

def create_model_corrections():
    """Create a mapping of incorrect model names to correct ones."""
    corrections = {
        # iPhone models - Complete list from iPhone 3G to iPhone 16
        'iphone 3g': 'iPhone 3G',
        'iphone 3gs': 'iPhone 3GS',
        'iphone 4': 'iPhone 4',
        'iphone 4 gsm': 'iPhone 4 (GSM)',
        'iphone 4 cdma': 'iPhone 4 (CDMA)',
        'iphone 4s': 'iPhone 4S',
        'iphone 5': 'iPhone 5',
        'iphone 5c': 'iPhone 5C',
        'iphone 5s': 'iPhone 5S',
        'iphone 6': 'iPhone 6',
        'iphone 6 plus': 'iPhone 6 Plus',
        'iphone 6s': 'iPhone 6S',
        'iphone 6s plus': 'iPhone 6S Plus',
        'iphone se': 'iPhone SE',
        'iphone se 1st gen': 'iPhone SE (1st gen)',
        'iphone se 2nd gen': 'iPhone SE (2nd gen)',
        'iphone se 3rd gen': 'iPhone SE (3rd gen)',
        'iphone 7': 'iPhone 7',
        'iphone 7 plus': 'iPhone 7 Plus',
        'iphone 8': 'iPhone 8',
        'iphone 8 plus': 'iPhone 8 Plus',
        'iphone x': 'iPhone X',
        'iphone xr': 'iPhone XR',
        'iphone xs': 'iPhone XS',
        'iphone xs max': 'iPhone XS Max',
        'iphone 11': 'iPhone 11',
        'iphone 11 pro': 'iPhone 11 Pro',
        'iphone 11 pro max': 'iPhone 11 Pro Max',
        'iphone 12': 'iPhone 12',
        'iphone 12 mini': 'iPhone 12 mini',
        'iphone 12 pro': 'iPhone 12 Pro',
        'iphone 12 pro max': 'iPhone 12 Pro Max',
        'iphone 13': 'iPhone 13',
        'iphone 13 mini': 'iPhone 13 mini',
        'iphone 13 pro': 'iPhone 13 Pro',
        'iphone 13 pro max': 'iPhone 13 Pro Max',
        'iphone 14': 'iPhone 14',
        'iphone 14 plus': 'iPhone 14 Plus',
        'iphone 14 pro': 'iPhone 14 Pro',
        'iphone 14 pro max': 'iPhone 14 Pro Max',
        'iphone 15': 'iPhone 15',
        'iphone 15 plus': 'iPhone 15 Plus',
        'iphone 15 pro': 'iPhone 15 Pro',
        'iphone 15 pro max': 'iPhone 15 Pro Max',
        'iphone 16': 'iPhone 16',
        'iphone 16 plus': 'iPhone 16 Plus',
        'iphone 16 pro': 'iPhone 16 Pro',
        'iphone 16 pro max': 'iPhone 16 Pro Max',
        'iphone 16e': 'iPhone 16e',
        
        # Samsung models
        'samsung galaxy s21': 'Samsung Galaxy S21',
        'samsung galaxy s22': 'Samsung Galaxy S22',
        'samsung galaxy s23': 'Samsung Galaxy S23',
        'samsung galaxy s24': 'Samsung Galaxy S24',
        'samsung galaxy note': 'Samsung Galaxy Note',
        'samsung galaxy a': 'Samsung Galaxy A',
        'galaxy s21': 'Samsung Galaxy S21',
        'galaxy s22': 'Samsung Galaxy S22',
        'galaxy s23': 'Samsung Galaxy S23',
        'galaxy note': 'Samsung Galaxy Note',
        
        # Huawei models
        'huawei p30': 'Huawei P30',
        'huawei p40': 'Huawei P40',
        'huawei mate': 'Huawei Mate',
        
        # Xiaomi models
        'xiaomi redmi': 'Xiaomi Redmi',
        'xiaomi mi': 'Xiaomi Mi',
        'redmi note': 'Xiaomi Redmi Note',
        
        # OnePlus models
        'oneplus 9': 'OnePlus 9',
        'oneplus 8': 'OnePlus 8',
        'oneplus 7': 'OnePlus 7',
        'oneplus nord': 'OnePlus Nord',
        
        # Nokia models
        'nokia 3310': 'Nokia 3310',
        'nokia 105': 'Nokia 105',
        'nokia 110': 'Nokia 110',
    }
    
    return corrections

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
    

    
    return corrected

def fix_model_names(data):
    """Fix model names in the data."""
    corrections = create_model_corrections()
    fixed_count = 0
    changes = []
    
    for item in data:
        details = item.get('details', {})
        if 'Model' in details:
            original_model = details['Model']
            
            # First try exact match corrections
            if original_model.lower() in corrections:
                corrected_model = corrections[original_model.lower()]
            else:
                # Apply smart corrections
                corrected_model = smart_correct_model(original_model)
            
            if corrected_model != original_model:
                details['Model'] = corrected_model
                changes.append((original_model, corrected_model))
                fixed_count += 1
    
    return fixed_count, changes

def main():
    input_file = 'scripts/4-extracted_listing_details.json'
    output_file = 'scripts/4-extracted_listing_details_fixed.json'
    
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
    fixed_count, changes = fix_model_names(data)
    print(f"Fixed {fixed_count} model names")
    
    # Show examples of changes
    print("\n=== EXAMPLES OF CHANGES ===")
    unique_changes = list(set(changes))[:15]  # Show first 15 unique changes
    for original, corrected in unique_changes:
        print(f"  \"{original}\" → \"{corrected}\"")
    
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