import psycopg2

db_url = "postgresql://postgres.scpnijwjaixdbygxduvj:3mVsAj6n.8%23Awc%24@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

def sync_all_users_xp():
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # 1. Get all users
        cur.execute("SELECT id, email FROM \"user\"")
        users = cur.fetchall()
        
        for user_id, email in users:
            print(f"Syncing XP for: {email} (ID: {user_id})")
            
            # Count questions asked (10 XP each)
            cur.execute("""
                SELECT count(*) 
                FROM history h
                JOIN conversation c ON h.conversation_id = c.id
                WHERE c.user_id = %s
            """, (user_id,))
            history_count = cur.fetchone()[0]
            
            new_xp = history_count * 10
            new_level = 1 + (new_xp // 100) # Simple level logic: 100 XP per level
            
            print(f"  - Calculated: {new_xp} XP, Level {new_level} (History items: {history_count})")
            
            # Update user table
            cur.execute("""
                UPDATE \"user\" 
                SET xp = %s, level = %s 
                WHERE id = %s
            """, (new_xp, new_level, user_id))
            
        conn.commit()
        cur.close()
        conn.close()
        print("XP Sync across all users completed successfully!")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    sync_all_users_xp()
