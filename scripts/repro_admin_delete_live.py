import sys
import uuid
sys.path.insert(0, r'c:\Alchemist\code_alchemist_last_version\server')

import app as app_module
from app import app, db, User

admin_email = 'test_admin@example.com'
admin_password = 'Password1'
victim_email = f'fk_delete_{uuid.uuid4().hex[:8]}@example.com'
victim_name = f'fk_delete_{uuid.uuid4().hex[:8]}'

with app.app_context():
    admin = User.query.filter_by(email=admin_email).first()
    if admin:
        admin.is_admin = True
        db.session.commit()
        print('admin promoted:', admin.id, admin.email, admin.is_admin)
    else:
        print('admin user missing')

client = app.test_client()

r = client.post('/api/auth/login', json={'email': admin_email, 'password': admin_password})
print('login status', r.status_code)
print('login body', r.get_data(as_text=True)[:400])
if r.status_code != 200:
    raise SystemExit('login failed')

token = r.get_json()['token']
headers = {'Authorization': f'Bearer {token}'}

r = client.post('/api/auth/register', json={'email': victim_email, 'password': 'Password1', 'display_name': victim_name})
print('register status', r.status_code)
print('register body', r.get_data(as_text=True)[:400])
if r.status_code not in (200, 201, 409):
    raise SystemExit('register failed')

with app.app_context():
    victim = User.query.filter_by(email=victim_email).first()
    print('victim row', victim.id if victim else None, victim.email if victim else None)
    victim_id = victim.id if victim else None

if victim_id is None:
    raise SystemExit('victim not found')

r = client.delete(f'/api/admin/users/{victim_id}', headers=headers)
print('delete status', r.status_code)
print('delete headers', dict(r.headers))
print('delete body', r.get_data(as_text=True)[:2000])
