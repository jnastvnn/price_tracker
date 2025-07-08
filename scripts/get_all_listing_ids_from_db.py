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

def fetch_all_listing_ids(conn):
    """Fetches all listing_id values from the listings table."""
    if not conn:
        return []
    
    listing_ids = []
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT listing_id FROM listings ORDER BY listing_id;")
            rows = cur.fetchall()
            listing_ids = [row[0] for row in rows]
            print(f"Successfully fetched {len(listing_ids)} listing IDs.")
    except psycopg2.Error as e:
        print(f"Database query error: {e}")
    finally:
        conn.close()
        
    return listing_ids

def save_ids_to_file(listing_ids, filename="listings_from_db.txt"):
    """Saves a list of IDs to a text file."""
    if not listing_ids:
        print("No listing IDs to save.")
        return

    # Ensure the 'scripts' directory exists
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, filename)

    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            for listing_id in listing_ids:
                f.write(f"{listing_id}\n")
        print(f"All {len(listing_ids)} listing IDs have been saved to {output_path}")
    except IOError as e:
        print(f"Error writing to file {output_path}: {e}")

def main():
    """Main function to run the script."""
    print("--- Starting script to fetch listing IDs from database ---")
    
    # Load environment variables from a .env file if it exists
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    load_dotenv(dotenv_path=dotenv_path)

    conn = get_db_connection()
    if conn:
        listing_ids = fetch_all_listing_ids(conn)
        save_ids_to_file(listing_ids)
    else:
        print("Could not establish a database connection. Exiting.")
        
    print("--- Script finished ---")

if __name__ == "__main__":
    main() 