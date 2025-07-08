import pandas as pd
import ollama
import json
from tqdm import tqdm
from typing import Dict, Any

# --- Configuration ---
class Config:
    """Holds all configuration variables for the script."""
    # File Paths
    INPUT_FILE = "lpr-kutistettu.xlsx"
    OUTPUT_FILE = "lpr-categorized-sequential-1000-qwen3-4b.xlsx"

    # Ollama Settings
    OLLAMA_MODEL = 'qwen3:4b'
    
    # Robustness Settings
    MIN_CONFIDENCE_THRESHOLD = 0.7  # Flag items below this confidence for review

    # DataFrame Column Names
    ID_COL = 'ID'
    DESC_COLS = ['Litteranimi', 'Selite']
    OUTPUT_SCOPE_COL = 'Scope'
    OUTPUT_CATEGORY_COL = 'Scope 3 Category'
    OUTPUT_REASONING_COL = 'Reasoning'
    OUTPUT_CONFIDENCE_COL = 'Confidence'
    OUTPUT_FLAGS_COL = 'Review_Flags'
# --- End Configuration ---


# --- Enhanced System Prompt ---
SYSTEM_PROMPT = """
You are a meticulous expert in GHG Protocol carbon accounting. Your task is to analyze a Finnish expense description and classify it into the correct GHG Protocol scope.

**Instructions:**
1.  Analyze the expense description provided within the <input> tag.
2.  Think step-by-step about the classification using the thinking framework below.
3.  Provide your confidence level (0.0 to 1.0) in your classification.
4.  Return a single JSON object with four keys: "scope", "scope_3_category", "reasoning", and "confidence".

**Thinking Framework (use this for every classification):**
Before answering, consider these questions step by step:
1. Is this a direct emission from company-owned/controlled sources? → Scope 1
2. Is this purchased electricity, steam, heating, or cooling consumed by the company? → Scope 2  
3. If neither above, it's Scope 3. Which of the 15 categories best fits?
4. How confident am I in this classification? (Consider ambiguity, missing context, unusual terms)

**JSON Schema:**
- `scope`: (Integer) Must be 1, 2, or 3.
- `scope_3_category`: (Integer, Optional) Must be a value from 1-15 if `scope` is 3. Provide `null` otherwise.
- `reasoning`: (String) Your step-by-step explanation including why you ruled out other scopes.
- `confidence`: (Float) Your confidence level from 0.0 to 1.0.

--- SCOPE DEFINITIONS ---
- **Scope 1**: Direct emissions from owned or controlled sources (company vehicles, facilities, equipment).
- **Scope 2**: Indirect emissions from purchased electricity, steam, heating, or cooling consumed by the company.
- **Scope 3**: All other indirect emissions in the company's value chain (upstream and downstream).

--- SCOPE 3 CATEGORIES (IF SCOPE IS 3) ---
1.  **Purchased Goods and Services**: Raw materials, consumables, office supplies, professional services.
2.  **Capital Goods**: Equipment, machinery, buildings, vehicles, IT hardware purchased.
3.  **Fuel- and Energy-Related Activities**: Upstream emissions from fuels/energy (extraction, refining, transport).
4.  **Upstream Transportation and Distribution**: Third-party logistics, shipping, warehousing of purchased goods.
5.  **Waste Generated in Operations**: Waste disposal, recycling, treatment services.
6.  **Business Travel**: Employee flights, hotels, rental cars, public transport for business.
7.  **Employee Commuting**: Regular travel between home and work.
8.  **Upstream Leased Assets**: Operation of leased buildings, vehicles, equipment (as lessee).
9.  **Downstream Transportation and Distribution**: Shipping/storing sold products to customers.
10. **Processing of Sold Products**: Further processing of intermediate products by others.
11. **Use of Sold Products**: Energy consumption during product use phase by end users.
12. **End-of-Life Treatment of Sold Products**: Disposal/recycling of products after use.
13. **Downstream Leased Assets**: Assets owned by company but leased to others (as lessor).
14. **Franchises**: Emissions from franchise operations not in Scope 1/2.
15. **Investments**: Emissions from equity/debt investments, joint ventures.

--- EXAMPLES ---
<example>
<input>Lentoliput Helsinki-Oulu työmatka</input>
<output>
{
  "scope": 3,
  "scope_3_category": 6,
  "reasoning": "Not direct company emissions (Scope 1) or purchased energy (Scope 2). This is employee air travel for business purposes, clearly fitting Business Travel category.",
  "confidence": 0.95
}
</output>
</example>
<example>
<input>Toimistotarvikkeet ja paperi</input>
<output>
{
  "scope": 3,
  "scope_3_category": 1,
  "reasoning": "Not direct emissions or energy. Office supplies and paper are consumable goods purchased for operations, fitting Purchased Goods and Services.",
  "confidence": 0.90
}
</output>
</example>
<example>
<input>Epäselvä lasku</input>
<output>
{
  "scope": 3,
  "scope_3_category": 1,
  "reasoning": "Description is unclear ('unclear invoice'). Defaulting to most common category but confidence is low due to insufficient information.",
  "confidence": 0.25
}
</output>
</example>

Now, classify the following item using the thinking framework.
"""
# --- End Enhanced System Prompt ---

# Enhanced error response
ERROR_RESPONSE = {
    "scope": "Error",
    "scope_3_category": "Error",
    "reasoning": "Classification failed due to technical error.",
    "confidence": 0.0
}

def validate_classification(result: Dict[str, Any], description: str) -> tuple[Dict[str, Any], list]:
    """
    Validation Rules: Check for logical consistency and flag issues.
    Returns: (validated_result, flags_list)
    """
    flags = []
    validated_result = result.copy()
    
    # Rule 1: If scope is not 3, scope_3_category should be null
    if result.get('scope') != 3 and result.get('scope_3_category') is not None:
        flags.append("INVALID_CATEGORY_FOR_SCOPE")
        validated_result['scope_3_category'] = None
    
    # Rule 2: If scope is 3, scope_3_category should not be null
    if result.get('scope') == 3 and result.get('scope_3_category') is None:
        flags.append("MISSING_SCOPE3_CATEGORY")
    
    # Rule 3: Scope must be 1, 2, or 3
    if result.get('scope') not in [1, 2, 3]:
        flags.append("INVALID_SCOPE_VALUE")
        validated_result['scope'] = "Error"
    
    # Rule 4: Scope 3 category must be 1-15
    if (result.get('scope') == 3 and 
        result.get('scope_3_category') is not None and 
        not isinstance(result.get('scope_3_category'), int) or 
        not 1 <= result.get('scope_3_category', 0) <= 15):
        flags.append("INVALID_SCOPE3_CATEGORY_VALUE")
    
    # Rule 5: Confidence should be between 0.0 and 1.0
    confidence = result.get('confidence', 0.5)
    if not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1:
        flags.append("INVALID_CONFIDENCE_VALUE")
        validated_result['confidence'] = 0.5
    
    # Rule 6: Empty or very short descriptions should be flagged
    if not description or len(description.strip()) < 3:
        flags.append("INSUFFICIENT_DESCRIPTION")
    
    return validated_result, flags

def get_enhanced_classification(description: str) -> Dict[str, Any]:
    """
    Enhanced classification with confidence scoring, validation, and flagging.
    """
    user_prompt = f"<input>{description}</input>"
    try:
        response = ollama.chat(
            model=Config.OLLAMA_MODEL,
            messages=[
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': user_prompt}
            ],
            format='json'
        )
        result = json.loads(response['message']['content'])
        
        # Ensure confidence is present and valid
        if 'confidence' not in result:
            result['confidence'] = 0.5
        
        # Validate the classification
        validated_result, validation_flags = validate_classification(result, description)
        
        # Flag uncertain cases (Feature 4)
        uncertainty_flags = []
        
        # Low confidence threshold
        if validated_result.get('confidence', 0) < Config.MIN_CONFIDENCE_THRESHOLD:
            uncertainty_flags.append("LOW_CONFIDENCE")
        
        # Very low confidence
        if validated_result.get('confidence', 0) < 0.4:
            uncertainty_flags.append("VERY_LOW_CONFIDENCE")
        
        # Combine all flags
        all_flags = validation_flags + uncertainty_flags
        validated_result['review_flags'] = "|".join(all_flags) if all_flags else "OK"
        
        return validated_result
        
    except json.JSONDecodeError as e:
        print(f"JSON parsing error for '{description[:50]}...': {e}")
        error_result = ERROR_RESPONSE.copy()
        error_result['review_flags'] = "JSON_PARSE_ERROR"
        return error_result
    except Exception as e:
        print(f"Error classifying '{description[:50]}...': {e}")
        error_result = ERROR_RESPONSE.copy()
        error_result['review_flags'] = "CLASSIFICATION_ERROR"
        return error_result

def analyze_data() -> None:
    """
    Enhanced analysis with robust classification, confidence scoring, and flagging.
    """
    try:
        df = pd.read_excel(Config.INPUT_FILE)
        # --- Limiting to first 1000 rows as requested ---
        if len(df) > 1000:
            df = df.head(1000)
        print(f"✅ Successfully loaded '{Config.INPUT_FILE}'. Processing the first {len(df)} rows.")
        print(f"🔍 Robustness features: Confidence scoring, validation rules, uncertainty flagging")
    except FileNotFoundError:
        print(f"❌ Error: '{Config.INPUT_FILE}' not found. Please check the file path in the Config.")
        return
    except Exception as e:
        print(f"❌ An error occurred while reading the Excel file: {e}")
        return

    # --- Data Preprocessing ---
    for col in Config.DESC_COLS:
        df[col] = df[col].fillna('')
    
    df['full_description'] = df[Config.DESC_COLS].apply(lambda row: ' '.join(row.astype(str)).strip(), axis=1)
    unique_descriptions = df['full_description'].unique()
    print(f"Found {len(unique_descriptions)} unique descriptions to classify.")

    # --- Enhanced Classification ---
    classification_cache: Dict[str, Dict[str, Any]] = {}
    print("🚀 Starting enhanced classification...")

    for description in tqdm(unique_descriptions, desc="Enhanced categorization"):
        if not description:
            continue
        
        result = get_enhanced_classification(description)
        classification_cache[description] = result

        # Enhanced result printing with confidence and flags
        scope = result.get('scope', 'Error')
        category = result.get('scope_3_category', 'N/A')
        confidence = result.get('confidence', 0.0)
        flags = result.get('review_flags', 'OK')
        reasoning = result.get('reasoning', 'No reasoning provided.')[:50]
        
        # Visual indicators for quality
        status_emoji = "🟢" if flags == "OK" else "🟡" if "LOW_CONFIDENCE" in flags else "🔴"
        tqdm.write(f"{status_emoji} '{description[:40].ljust(40)}' -> Scope: {scope}, Cat: {category}, Conf: {confidence:.2f}, Flags: {flags}")
    
    # --- Process and Save Results ---
    results_df = df['full_description'].apply(lambda x: classification_cache.get(x, ERROR_RESPONSE)).apply(pd.Series)

    df[Config.OUTPUT_SCOPE_COL] = results_df['scope']
    df[Config.OUTPUT_CATEGORY_COL] = results_df['scope_3_category']
    df[Config.OUTPUT_REASONING_COL] = results_df['reasoning']
    df[Config.OUTPUT_CONFIDENCE_COL] = results_df['confidence']
    df[Config.OUTPUT_FLAGS_COL] = results_df['review_flags']
    
    df = df.drop(columns=['full_description'])

    # Quality summary statistics
    flagged_count = len(df[df[Config.OUTPUT_FLAGS_COL] != 'OK'])
    low_confidence_count = len(df[df[Config.OUTPUT_CONFIDENCE_COL] < Config.MIN_CONFIDENCE_THRESHOLD])
    avg_confidence = df[df[Config.OUTPUT_CONFIDENCE_COL].notna()][Config.OUTPUT_CONFIDENCE_COL].mean()
    
    print(f"\n📊 Quality Summary:")
    print(f"   • Total items processed: {len(df)}")
    print(f"   • Items flagged for review: {flagged_count} ({flagged_count/len(df)*100:.1f}%)")
    print(f"   • Low confidence items: {low_confidence_count} ({low_confidence_count/len(df)*100:.1f}%)")
    print(f"   • Average confidence: {avg_confidence:.3f}")

    try:
        df.to_excel(Config.OUTPUT_FILE, index=False)
        print(f"\n✅ Processing complete. Enhanced results saved to '{Config.OUTPUT_FILE}'.")
        print(f"💡 Review items with flags in the '{Config.OUTPUT_FLAGS_COL}' column for quality assurance.")
    except Exception as e:
        print(f"\n❌ An error occurred while saving the output file: {e}")

if __name__ == "__main__":
    print("Starting enhanced expense categorization process...")
    print(f"Using Ollama model: '{Config.OLLAMA_MODEL}'. Make sure Ollama is running.")
    analyze_data() 