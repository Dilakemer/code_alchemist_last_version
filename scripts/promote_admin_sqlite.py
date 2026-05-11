import sqlite3, os

db_path = os.path.join('server','instance','codebrain.db')
print('db_path', db_path, os.path.exists(db_path))
conn = sqlite3.connect(db_path)
c = conn.cursor()
try:
    c.execute('SELECT id,email,is_admin,created_at FROM "user" ORDER BY id DESC LIMIT 10')
    rows = c.fetchall()
    print('last users:')
    for r in rows:
        print(r)
    # try updating common test emails
    for email in ('test_admin@example.com','test_admin@EXAMPLE.COM','test_admin', 'test_admin@localhost'):
        c.execute('UPDATE "user" SET is_admin=1 WHERE email=?', (email,))
        if c.rowcount:
            print('updated', email)
            conn.commit()
            break
finally:
    conn.close()
