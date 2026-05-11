from app import app, db
from sqlalchemy import text

def migrate():
    with app.app_context():
        try:
            print("Running migration: Adding price_try to token_package...")
            db.session.execute(text("ALTER TABLE token_package ADD COLUMN price_try FLOAT;"))
            db.session.commit()
            print("Migration successful!")
        except Exception as e:
            print(f"Migration failed: {e}")
            db.session.rollback()

if __name__ == "__main__":
    migrate()
