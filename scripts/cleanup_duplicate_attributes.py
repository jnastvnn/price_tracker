#!/usr/bin/env python3
"""Clean up duplicate attributes and keep only English ones."""

import psycopg2

DB_URL = 'postgresql://neondb_owner:npg_3oxSkPERbp0I@ep-tiny-cell-abmko6a4-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

def main():
    """Clean up duplicate attributes."""
    
    # Attributes to remove (Finnish versions and metadata)
    finnish_attributes_to_remove = [
        'Kunto', 'Merkki', 'Muisti', 'Tyyppi', 'Alusta', 'Nayton koko', 
        'Vari', 'Malli', 'Tallennustila', 'Processori', 'Näytonohjain', 
        'Käyttöjärjestelmä', '_extraction_confidence', '_extraction_timestamp'
    ]
    
    # Keep these English attributes
    english_attributes_to_keep = [
        'Condition', 'Brand', 'Storage', 'Type', 'Platform', 'Screen size', 
        'Color', 'Model', 'Processor', 'Graphics', 'RAM', 'Operating system',
        'Size', 'Resolution', 'Refresh rate', 'Latency', 'Panel technology',
        'RAM_type', 'RAM_amount', 'Storage_type', 'Storage_size', 'Storage_speed',
        'Form_factor', 'Socket', 'Power_consumption', 'Cooling_type'
    ]
    
    try:
        with psycopg2.connect(DB_URL) as conn:
            with conn.cursor() as cur:
                print("🧹 Starting attribute cleanup...")
                
                # First, check what we have
                cur.execute("SELECT id, name, name_fi FROM product_attributes ORDER BY id")
                all_attrs = cur.fetchall()
                print(f"Found {len(all_attrs)} total attributes")
                
                # Find Finnish attributes to remove
                attrs_to_remove = []
                for attr_id, name, name_fi in all_attrs:
                    if name in finnish_attributes_to_remove or name_fi in finnish_attributes_to_remove:
                        attrs_to_remove.append((attr_id, name))
                
                if attrs_to_remove:
                    print(f"Removing {len(attrs_to_remove)} duplicate/unwanted attributes:")
                    for attr_id, name in attrs_to_remove:
                        print(f"  - {name} (ID: {attr_id})")
                    
                    # Remove listing_attributes first (foreign key constraint)
                    attr_ids = [str(attr_id) for attr_id, _ in attrs_to_remove]
                    cur.execute(f"""
                        DELETE FROM listing_attributes 
                        WHERE attribute_id IN ({','.join(attr_ids)})
                    """)
                    deleted_relations = cur.rowcount
                    print(f"Removed {deleted_relations} listing-attribute relations")
                    
                    # Remove the attributes
                    cur.execute(f"""
                        DELETE FROM product_attributes 
                        WHERE id IN ({','.join(attr_ids)})
                    """)
                    deleted_attrs = cur.rowcount
                    print(f"Removed {deleted_attrs} attributes")
                
                # Show remaining attributes
                cur.execute("SELECT id, name, name_fi FROM product_attributes ORDER BY name")
                remaining = cur.fetchall()
                print(f"\n✅ Cleanup complete! Remaining {len(remaining)} attributes:")
                for attr_id, name, name_fi in remaining:
                    print(f"  {attr_id}: {name} ({name_fi})")
                
                conn.commit()
                print("\n🎉 Database cleanup successful!")
                
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")

if __name__ == "__main__":
    main() 