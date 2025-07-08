import psycopg2

DB_URL = 'postgresql://neondb_owner:npg_3oxSkPERbp0I@ep-tiny-cell-abmko6a4-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

def decrease_levels():
    with psycopg2.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            # Check current level distribution
            cur.execute('SELECT level, COUNT(*) FROM listing_categories GROUP BY level ORDER BY level;')
            before = cur.fetchall()
            print("Before update:")
            for level, count in before:
                print(f"  Level {level}: {count:,} records")
            
            # Update levels
            cur.execute('UPDATE listing_categories SET level = level - 1 WHERE level > 0;')
            affected_rows = cur.rowcount
            
            # Check new level distribution
            cur.execute('SELECT level, COUNT(*) FROM listing_categories GROUP BY level ORDER BY level;')
            after = cur.fetchall()
            print(f"\nAfter update ({affected_rows:,} rows affected):")
            for level, count in after:
                print(f"  Level {level}: {count:,} records")
            
            conn.commit()
            print("\n✅ Levels decreased by 1 successfully!")

if __name__ == '__main__':
    decrease_levels() 