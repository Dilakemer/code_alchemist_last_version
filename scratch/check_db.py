import sys
import os

# Add server to sys.path
server_dir = os.path.join(os.getcwd(), 'server')
if server_dir not in sys.path:
    sys.path.insert(0, server_dir)

from app import app
from models import db, User

with app.app_context():
    users = User.query.all()
    print(f"Total users: {len(users)}")
    for user in users:
        print(f"ID: {user.id}, Email: {user.email}, Profile Image Path: {user.profile_image}")
