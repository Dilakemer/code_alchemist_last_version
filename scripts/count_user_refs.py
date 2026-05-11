import sys
sys.path.insert(0, r'c:\Alchemist\code_alchemist_last_version\server')
from app import app, db
from sqlalchemy import text

user_id = 31
with app.app_context():
    insp = db.inspect(db.engine)
    print('user_id', user_id)
    for table in insp.get_table_names():
        cols = [c['name'] for c in insp.get_columns(table)]
        # count explicit user-reference columns of interest
        ref_cols = [c for c in cols if c in {'user_id','target_user_id','related_user_id','owner_id','author_id','author_user_id','updated_by_user_id','follower_id','following_id'}]
        for col in ref_cols:
            try:
                count = db.session.execute(text(f'SELECT COUNT(*) FROM "{table}" WHERE "{col}" = :uid'), {'uid': user_id}).scalar_one()
            except Exception as e:
                count = f'ERR {e}'
            if count:
                print(f'{table}.{col} -> {count}')
