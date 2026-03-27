import psycopg2

db_url = "postgresql://postgres.scpnijwjaixdbygxduvj:3mVsAj6n.8%23Awc%24@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

def check_usertheme_cols():
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'user_theme'
        """)
        cols = cur.fetchall()
        print("COLUMNS_START")
        for c in cols:
            print(f"COLUMN:{c[0]}:{c[1]}")
        print("COLUMNS_END")
        
        if not cols:
            print("TABLE_NOT_FOUND")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"ERROR:{e}")

if __name__ == "__main__":
    check_usertheme_cols()
