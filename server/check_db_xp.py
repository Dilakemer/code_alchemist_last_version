import psycopg2

db_url = "postgresql://postgres.scpnijwjaixdbygxduvj:3mVsAj6n.8%23Awc%24@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

def get_user_xp():
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute("SELECT id, email, xp, level FROM \"user\" WHERE email = 'dilo@gmail.com'")
        row = cur.fetchone()
        if row:
            print(f"User: {row[1]} (ID: {row[0]}) | XP: {row[2]} | Level: {row[3]}")
        else:
            print("User not found.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_user_xp()
