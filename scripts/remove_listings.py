import os
import psycopg2
from dotenv import load_dotenv

def get_db_connection():
    """Establishes a connection to the PostgreSQL database."""
    try:
        conn = psycopg2.connect(os.getenv('DATABASE_URL'))
        return conn
    except psycopg2.OperationalError as e:
        print(f"Error connecting to the database: {e}")
        # Try a more specific connection string if the simple one fails
        try:
            conn_str = 'postgresql://neondb_owner:npg_3oxSkPERbp0I@ep-tiny-cell-abmko6a4-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
            conn = psycopg2.connect(conn_str)
            return conn
        except psycopg2.OperationalError as e2:
            print(f"Secondary connection attempt failed: {e2}")
            return None

def get_listings_in_category(conn, category_id):
    """Get all listing IDs that are in the specified category."""
    if not conn:
        return []
    
    listing_ids = []
    try:
        with conn.cursor() as cur:
            # Find all listings that are in the specified category
            query = """
                SELECT DISTINCT l.id, l.listing_id, l.title
                FROM listings l
                JOIN listing_categories lc ON l.id = lc.listing_id
                WHERE lc.category_id = %s
                ORDER BY l.id;
            """
            cur.execute(query, (category_id,))
            rows = cur.fetchall()
            listing_ids = [(row[0], row[1], row[2]) for row in rows]
            print(f"Found {len(listing_ids)} listings in category_id = {category_id}")
            
            # Show a few examples
            if listing_ids:
                print("\nExample listings to be deleted:")
                for i, (db_id, listing_id, title) in enumerate(listing_ids[:5]):
                    print(f"  {i+1}. ID: {db_id}, Listing: {listing_id}, Title: {title[:60]}...")
                if len(listing_ids) > 5:
                    print(f"  ... and {len(listing_ids) - 5} more listings")
                    
    except psycopg2.Error as e:
        print(f"Database query error: {e}")
    
    return listing_ids

def remove_listings_by_category(conn, category_id, dry_run=True):
    """Remove all listings in the specified category."""
    if not conn:
        return False
    
    try:
        with conn.cursor() as cur:
            # First, get the listing IDs to be deleted
            print(f"\n--- Finding listings in category_id = {category_id} ---")
            listings = get_listings_in_category(conn, category_id)
            
            if not listings:
                print(f"No listings found in category_id = {category_id}")
                return True
            
            listing_db_ids = [listing[0] for listing in listings]
            
            if dry_run:
                print(f"\n--- DRY RUN MODE ---")
                print(f"Would delete {len(listings)} listings and all their related data")
                print("To actually perform the deletion, run with dry_run=False")
                return True
            
            print(f"\n--- PERFORMING ACTUAL DELETION ---")
            print(f"Deleting {len(listings)} listings and all their related data...")
            
            # Delete in the correct order to avoid foreign key constraint violations
            
            # 1. Delete listing attributes first (references listing_id)
            print("1. Deleting listing attributes...")
            placeholders = ','.join(['%s'] * len(listing_db_ids))
            cur.execute(f"DELETE FROM listing_attributes WHERE listing_id IN ({placeholders})", listing_db_ids)
            deleted_attributes = cur.rowcount
            print(f"   Deleted {deleted_attributes} listing attributes")
            
            # 2. Delete listing categories (references listing_id)
            print("2. Deleting listing categories...")
            cur.execute(f"DELETE FROM listing_categories WHERE listing_id IN ({placeholders})", listing_db_ids)
            deleted_categories = cur.rowcount
            print(f"   Deleted {deleted_categories} listing category associations")
            
            # 3. Finally delete the listings themselves
            print("3. Deleting listings...")
            cur.execute(f"DELETE FROM listings WHERE id IN ({placeholders})", listing_db_ids)
            deleted_listings = cur.rowcount
            print(f"   Deleted {deleted_listings} listings")
            
            # Commit the transaction
            conn.commit()
            print(f"\n✅ Successfully deleted all listings in category_id = {category_id}")
            print(f"Summary:")
            print(f"  - Listings deleted: {deleted_listings}")
            print(f"  - Attributes deleted: {deleted_attributes}")
            print(f"  - Category associations deleted: {deleted_categories}")
            
            return True
            
    except psycopg2.Error as e:
        print(f"Database error during deletion: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

def main():
    """Main function to run the script."""
    print("=== Script to Remove Listings by Category ===")
    
    # Configuration
    CATEGORY_ID = 32
    DRY_RUN = False  # Set to False to actually perform deletion
    
    print(f"Target category_id: {CATEGORY_ID}")
    print(f"Dry run mode: {DRY_RUN}")
    
    # Load environment variables from a .env file if it exists
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    load_dotenv(dotenv_path=dotenv_path)
    
    # Get database connection
    conn = get_db_connection()
    if not conn:
        print("Could not establish a database connection. Exiting.")
        return
    
    # Confirm before proceeding (especially important for actual deletion)
    if not DRY_RUN:
        print(f"\n⚠️  WARNING: This will permanently delete ALL listings in category_id = {CATEGORY_ID}")
        print("This action cannot be undone!")
        confirm = input("Type 'DELETE' to confirm: ")
        if confirm != 'DELETE':
            print("Deletion cancelled.")
            return
    
    # Perform the removal
    success = remove_listings_by_category(conn, CATEGORY_ID, dry_run=DRY_RUN)
    
    if success:
        print("\n--- Script completed successfully ---")
    else:
        print("\n--- Script completed with errors ---")

if __name__ == "__main__":
    main()