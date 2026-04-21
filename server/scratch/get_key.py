import sys
import os
sys.path.append('.')
from app import app, db
from models import ApiKey
with app.app_context():
    key = ApiKey.query.filter_by(is_active=True).first()
    if key:
        print(key.key)
    else:
        print("No Key")
