import json
import os

def check_extracted_listings():
    """
    Check which listings have already been processed for attribute extraction.
    """
    files_to_check = [
        '../listing_data_enhanced.json',
        '../listing_data_enhanced_async.json',
        '../listing_data_new.json'
    ]
    
    results = {}
    
    for file_path in files_to_check:
        if not os.path.exists(file_path):
            print(f"❌ File not found: {file_path}")
            continue
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            file_name = os.path.basename(file_path)
            total_listings = len(data)
            
            # Count extracted listings (those with confidence scores)
            extracted_listings = []
            unextracted_listings = []
            skipped_listings = []  # Platform listings
            
            for listing in data:
                listing_id = listing.get('listing_id', 'unknown')
                has_confidence = '_extraction_confidence' in listing.get('details', {})
                has_platform = 'Alusta' in listing.get('details', {})
                
                if has_platform:
                    skipped_listings.append(listing_id)
                elif has_confidence:
                    confidence = listing['details']['_extraction_confidence']
                    timestamp = listing['details'].get('_extraction_timestamp', 'unknown')
                    extracted_listings.append({
                        'listing_id': listing_id, 
                        'confidence': confidence,
                        'timestamp': timestamp
                    })
                else:
                    unextracted_listings.append(listing_id)
            
            results[file_name] = {
                'total': total_listings,
                'extracted': len(extracted_listings),
                'unextracted': len(unextracted_listings),
                'skipped': len(skipped_listings),
                'extracted_details': extracted_listings,
                'unextracted_ids': unextracted_listings,
                'skipped_ids': skipped_listings
            }
            
        except json.JSONDecodeError as e:
            print(f"❌ JSON decode error in {file_path}: {e}")
        except Exception as e:
            print(f"❌ Error reading {file_path}: {e}")
    
    # Print summary
    print("📊 EXTRACTION STATUS SUMMARY")
    print("="*50)
    
    for file_name, stats in results.items():
        print(f"\n📁 {file_name}:")
        print(f"  Total listings: {stats['total']}")
        print(f"  ✅ Extracted: {stats['extracted']} ({stats['extracted']/stats['total']*100:.1f}%)")
        print(f"  ❌ Not extracted: {stats['unextracted']} ({stats['unextracted']/stats['total']*100:.1f}%)")
        print(f"  ⏭️  Skipped (platform): {stats['skipped']} ({stats['skipped']/stats['total']*100:.1f}%)")
        
        if stats['extracted'] > 0:
            confidences = [item['confidence'] for item in stats['extracted_details']]
            avg_confidence = sum(confidences) / len(confidences)
            high_conf = len([c for c in confidences if c >= 0.7])
            low_conf = len([c for c in confidences if c < 0.4])
            
            print(f"  📈 Average confidence: {avg_confidence:.3f}")
            print(f"  🎯 High confidence (≥0.7): {high_conf} ({high_conf/len(confidences)*100:.1f}%)")
            print(f"  ⚠️  Low confidence (<0.4): {low_conf} ({low_conf/len(confidences)*100:.1f}%)")
    
    # Find which listings need processing
    if 'listing_data_new.json' in results:
        original_stats = results['listing_data_new.json']
        enhanced_stats = results.get('listing_data_enhanced.json', {'extracted_details': []})
        async_stats = results.get('listing_data_enhanced_async.json', {'extracted_details': []})
        
        # Get all extracted IDs
        all_extracted_ids = set()
        for item in enhanced_stats.get('extracted_details', []):
            all_extracted_ids.add(item['listing_id'])
        for item in async_stats.get('extracted_details', []):
            all_extracted_ids.add(item['listing_id'])
        
        # Add skipped IDs
        all_processed_ids = all_extracted_ids.copy()
        all_processed_ids.update(enhanced_stats.get('skipped_ids', []))
        all_processed_ids.update(async_stats.get('skipped_ids', []))
        
        # Find remaining unprocessed
        all_original_ids = set()
        for listing in json.load(open('../listing_data_new.json', 'r', encoding='utf-8')):
            if listing.get('status') == 'success':
                all_original_ids.add(listing['listing_id'])
        
        unprocessed_ids = all_original_ids - all_processed_ids
        
        print(f"\n🔍 PROCESSING ANALYSIS:")
        print(f"  Total successful listings: {len(all_original_ids)}")
        print(f"  Already processed: {len(all_processed_ids)}")
        print(f"  Remaining to process: {len(unprocessed_ids)}")
        
        if unprocessed_ids:
            print(f"\n📝 Next {min(10, len(unprocessed_ids))} to process:")
            for i, listing_id in enumerate(list(unprocessed_ids)[:10]):
                print(f"    {i+1}. {listing_id}")
            if len(unprocessed_ids) > 10:
                print(f"    ... and {len(unprocessed_ids) - 10} more")
        else:
            print(f"  🎉 All listings have been processed!")

if __name__ == "__main__":
    check_extracted_listings() 