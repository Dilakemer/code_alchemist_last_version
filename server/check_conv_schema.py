import sqlite3
import os

db_path = os.path.join('instance', 'codebrain.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("PRAGMA table_info(conversation)")
cols = [col[1] for col in c.fetchall()]
print(f"Conversation Columns: {', '.join(cols)}")
conn.close()
