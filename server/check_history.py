import psycopg2

db_url = "postgresql://postgres.scpnijwjaixdbygxduvj:3mVsAj6n.8%23Awc%24@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

def check_history_count():
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        # Join with conversation to filter by user_id
        cur.execute("""
            SELECT count(*) 
            FROM history h
            JOIN conversation c ON h.conversation_id = c.id
            WHERE c.user_id = 2
        """)
        count = cur.fetchone()[0]
        print(f"Total history items for user ID 2: {count}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_history_count()
