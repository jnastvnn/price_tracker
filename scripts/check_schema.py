import psycopg2

DB_URL = 'postgresql://neondb_owner:npg_3oxSkPERbp0I@ep-tiny-cell-abmko6a4-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

with psycopg2.connect(DB_URL) as conn:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'categories' 
            ORDER BY ordinal_position;
        """)
        
        columns = cur.fetchall()
        for col in columns:
            print(f"{col[0]}: {col[1]} (nullable: {col[2]}, default: {col[3]})") 