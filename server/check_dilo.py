import sqlite3
import os

db_path = os.path.join('instance', 'codebrain.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("SELECT id, email, display_name FROM user WHERE email LIKE '%dilo%'")
print(c.fetchall())
conn.close()
