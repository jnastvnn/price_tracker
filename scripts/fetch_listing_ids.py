import psycopg2

DB_URL = 'postgresql://neondb_owner:npg_3oxSkPERbp0I@ep-tiny-cell-abmko6a4-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

with psycopg2.connect(DB_URL) as conn:
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM listings;')
        ids = [str(row[0]) for row in cur.fetchall()]

with open('listing_ids.txt', 'w') as f:
    f.write('\n'.join(ids)) 