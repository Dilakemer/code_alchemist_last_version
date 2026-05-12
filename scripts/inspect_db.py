import sqlite3, os
db_path = os.path.join('server','instance','codebrain.db')
print('db_path', db_path, os.path.exists(db_path))
conn = sqlite3.connect(db_path)
c = conn.cursor()
for row in c.execute('SELECT name FROM sqlite_master WHERE type="table";'):
    print('table', row[0])
print('----')
try:
    for r in c.execute('SELECT id,email,is_admin,created_at FROM "user" ORDER BY id DESC LIMIT 10'):
        print(r)
except Exception as e:
    print('query error', e)
conn.close()
