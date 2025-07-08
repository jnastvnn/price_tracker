import os
import glob

def combine_listing_files():
    """
    Combine all listing ID text files into one listing_ids_combined.txt file.
    Removes duplicates while preserving order.
    """
    print("=== Listing ID File Combiner ===")
    
    # Find all listing ID text files
    pattern = "listing_ids*.txt"
    listing_files = glob.glob(pattern)
    
    # Exclude the combined file if it already exists
    listing_files = [f for f in listing_files if f != "listing_ids_combined.txt"]
    
    if not listing_files:
        print("No listing ID files found!")
        print(f"Looking for files matching pattern: {pattern}")
        return
    
    print(f"Found {len(listing_files)} files to combine:")
    for file in listing_files:
        print(f"  - {file}")
    
    all_listing_ids = []
    
    # Read each file and collect IDs
    for filename in listing_files:
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                ids = [line.strip() for line in f if line.strip()]
                all_listing_ids.extend(ids)
                print(f"Read {len(ids)} IDs from {filename}")
        except Exception as e:
            print(f"Error reading {filename}: {e}")
    
    # Remove duplicates while preserving order
    unique_ids = list(dict.fromkeys(all_listing_ids))
    
    # Save combined results
    output_file = "listing_ids_combined.txt"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(unique_ids))
    
    print(f"\n=== COMBINING COMPLETE ===")
    print(f"Total listing IDs found: {len(all_listing_ids)}")
    print(f"Unique listing IDs after removing duplicates: {len(unique_ids)}")
    print(f"Duplicates removed: {len(all_listing_ids) - len(unique_ids)}")
    print(f"Results saved to: {output_file}")
    
    # Print first few IDs as preview
    print(f"\nFirst 5 IDs:")
    for i, listing_id in enumerate(unique_ids[:5]):
        print(f"  {i+1}. {listing_id}")
    
    if len(unique_ids) > 5:
        print(f"  ... and {len(unique_ids) - 5} more")

def main():
    combine_listing_files()

if __name__ == "__main__":
    main() 