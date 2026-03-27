import psycopg2

db_url = "postgresql://postgres.scpnijwjaixdbygxduvj:3mVsAj6n.8%23Awc%24@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

def check_tables():
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        tables = [row[0] for row in cur.fetchall()]
        print("Existing tables in Supabase:")
        for t in sorted(tables):
            print(f" - {t}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_tables()
