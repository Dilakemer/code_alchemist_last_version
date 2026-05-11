import requests
import time

BASE='http://127.0.0.1:5000'

# Register admin user
resp = requests.post(BASE+'/api/auth/register', json={
    'email':'test_admin@example.com',
    'password':'Password1',
    'display_name':'test_admin'
})
print('register admin', resp.status_code, resp.text[:400])

# Promote to admin using app context
from server import app, db
from server.models import User
with app.app_context():
    u = User.query.filter_by(email='test_admin@example.com').first()
    if u:
        u.is_admin = True
        db.session.commit()
        print('promoted to admin in db')
    else:
        print('admin user not found in db')

# Login as admin
resp = requests.post(BASE+'/api/auth/login', json={'email':'test_admin@example.com','password':'Password1'})
print('login', resp.status_code, resp.text[:400])
if not resp.ok:
    raise SystemExit('login failed')

token = resp.json().get('token')
headers = {'Authorization': f'Bearer {token}'}

# Create victim user
resp = requests.post(BASE+'/api/auth/register', json={
    'email':'victim_user@example.com',
    'password':'Password1',
    'display_name':'victim_user'
})
print('register victim', resp.status_code, resp.text[:400])
if not resp.ok:
    # maybe user exists; fetch user list
    pass

# find victim id
resp = requests.get(BASE+'/api/admin/users', headers=headers)
print('list users', resp.status_code)
users = resp.json().get('users', [])
v_id = None
for u in users:
    if u.get('email')=='victim_user@example.com':
        v_id = u.get('id')
        break
print('victim id', v_id)

# Attempt delete
if v_id:
    resp = requests.delete(f"{BASE}/api/admin/users/{v_id}", headers=headers)
    print('delete response', resp.status_code)
    print(resp.text[:800])
else:
    print('victim not found; abort')
