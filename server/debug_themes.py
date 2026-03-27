from app import app, db
from models import UserTheme, User
import json

def debug_themes():
    with app.app_context():
        try:
            user_id = 2 # dilo@gmail.com
            print(f"Checking themes for user_id={user_id}")
            
            theme_pref = UserTheme.query.filter_by(user_id=user_id).first()
            print(f"theme_pref found: {theme_pref is not None}")
            
            if not theme_pref:
                print("Creating theme_pref...")
                theme_pref = UserTheme(
                    user_id=user_id,
                    active_theme='dark',
                    unlocked_themes=json.dumps(['light', 'dark'])
                )
                db.session.add(theme_pref)
                db.session.commit()
                print("Created successfully.")
            
            unlocked = json.loads(theme_pref.unlocked_themes)
            print(f"Active: {theme_pref.active_theme}, Unlocked: {unlocked}")
            
        except Exception as e:
            import traceback
            print(f"ERROR: {e}")
            traceback.print_exc()

if __name__ == "__main__":
    debug_themes()
