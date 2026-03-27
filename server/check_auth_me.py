from app import app, db
from models import User

def check_auth_me():
    with app.app_context():
        try:
            user_id = 2 # dilo@gmail.com
            user = db.session.get(User, user_id)
            if user:
                print(f"DB User: {user.email} | XP: {user.xp} | Level: {user.level}")
                
                # Simulate /api/auth/me response
                response_data = {
                    'user': {
                        'id': user.id,
                        'email': user.email,
                        'display_name': user.display_name,
                        'xp': user.xp,
                        'level': user.level,
                        'streak_days': user.streak_days
                    }
                }
                import json
                print(f"API Response Mock: {json.dumps(response_data)}")
            else:
                print("User not found.")
        except Exception as e:
            print(f"ERROR: {e}")

if __name__ == "__main__":
    check_auth_me()
