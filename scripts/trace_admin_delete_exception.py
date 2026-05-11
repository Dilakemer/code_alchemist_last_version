import sys
import uuid
import traceback
sys.path.insert(0, r'c:\Alchemist\code_alchemist_last_version\server')

from app import app, db, User

app.config['TESTING'] = True
app.config['PROPAGATE_EXCEPTIONS'] = True

admin_email = 'test_admin@example.com'
admin_password = 'Password1'
victim_email = f'trace_{uuid.uuid4().hex[:8]}@example.com'
victim_name = f'trace_{uuid.uuid4().hex[:8]}'

with app.app_context():
    admin = User.query.filter_by(email=admin_email).first()
    admin.is_admin = True
    db.session.commit()

client = app.test_client()

try:
    r = client.post('/api/auth/login', json={'email': admin_email, 'password': admin_password})
    token = r.get_json()['token']
    headers = {'Authorization': f'Bearer {token}'}

    r = client.post('/api/auth/register', json={'email': victim_email, 'password': 'Password1', 'display_name': victim_name})
    victim_id = r.get_json()['user']['id']
    print('victim', victim_id)

    r = client.delete(f'/api/admin/users/{victim_id}', headers=headers)
    print('status', r.status_code)
    print(r.get_data(as_text=True))
except Exception:
    traceback.print_exc()
    raise
