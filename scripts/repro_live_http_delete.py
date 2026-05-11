import requests, uuid
BASE='http://127.0.0.1:5000'
admin_email='test_admin@example.com'
admin_password='Password1'
victim_email=f'live_http_{uuid.uuid4().hex[:8]}@example.com'
victim_name=f'live_http_{uuid.uuid4().hex[:8]}'

r=requests.post(BASE+'/api/auth/login', json={'email':admin_email,'password':admin_password})
print('login', r.status_code, r.text[:300])
r.raise_for_status()
token=r.json()['token']
headers={'Authorization': f'Bearer {token}'}

r=requests.post(BASE+'/api/auth/register', json={'email':victim_email,'password':'Password1','display_name':victim_name})
print('register', r.status_code, r.text[:300])
r.raise_for_status()
victim_id=r.json()['user']['id']
print('victim_id', victim_id)

r=requests.delete(f'{BASE}/api/admin/users/{victim_id}', headers=headers)
print('delete', r.status_code)
print(r.text[:2000])
