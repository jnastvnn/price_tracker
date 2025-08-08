import json
import os

def check_ids_in_json(db_ids_file, json_file):
    """
    Checks which IDs from a text file are present in a large JSON file.

    Args:
        db_ids_file (str): Path to the text file containing one ID per line.
        json_file (str): Path to the large JSON file containing a list of objects.
    """
    # --- 1. Read the database IDs into a set for efficient lookup ---
    try:
        with open(db_ids_file, 'r', encoding='utf-8') as f:
            db_ids = {line.strip() for line in f if line.strip()}
        print(f"✅ Found {len(db_ids)} unique IDs in '{db_ids_file}'")
    except FileNotFoundError:
        print(f"❌ Error: Database ID file not found at '{db_ids_file}'")
        return

    # --- 2. Read the JSON file to get the set of processed IDs ---
    if not os.path.exists(json_file):
        print(f"❌ Error: JSON file not found at '{json_file}'")
        return
        
    processed_ids = set()
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for item in data:
                if 'listing_id' in item:
                    processed_ids.add(item['listing_id'])
        print(f"✅ Found {len(processed_ids)} unique listings in '{json_file}'")
    except json.JSONDecodeError:
        print(f"❌ Error: Could not decode JSON from '{json_file}'. It might be corrupted.")
        return
    except Exception as e:
        print(f"An unexpected error occurred while reading '{json_file}': {e}")
        return

    # --- 3. Find the intersection of the two sets ---
    found_ids = db_ids.intersection(processed_ids)
    
    # --- 4. Report the results ---
    print("\n--- CHECK COMPLETE ---")
    if not found_ids:
        print("✅ No listings from the database file were found in the JSON file.")
    else:
        print(f"📄 Found {len(found_ids)} matching listings:")
        for listing_id in sorted(list(found_ids)):
            print(f"  - {listing_id}")
            
    # --- Optional: Report which DB IDs were NOT found ---
    not_found_ids = db_ids - processed_ids
    if not_found_ids:
        print(f"\nℹ️ {len(not_found_ids)} listings from the database file were NOT found in the JSON file.")
    else:
        print("✅ All listings from the database file were found in the JSON file.")


if __name__ == "__main__":
    db_file = 'scripts/listings_from_db.txt'
    json_details_file = 'scripts/4-extracted_listing_details.json'
    
    print(f"Checking for IDs from '{db_file}' in '{json_details_file}'...")
    check_ids_in_json(db_file, json_details_file) 