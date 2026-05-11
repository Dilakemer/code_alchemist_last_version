import sys
sys.path.insert(0, r'c:\Alchemist\code_alchemist_last_version\server')

from app import app, db, User, check_tokens, deduct_tokens, get_or_create_token_balance

with app.app_context():
    admin = User.query.filter_by(email='dilo@gmail.com').first() or User.query.filter_by(is_admin=True).first()
    if not admin:
        raise SystemExit('No admin user found')
    wallet = get_or_create_token_balance(admin)
    allowed, balance, cost = check_tokens(admin, 'gpt-4o')
    print({'allowed': allowed, 'balance': balance, 'cost': cost, 'is_admin': admin.is_admin, 'wallet_balance': wallet.balance})
    success, new_balance = deduct_tokens(admin, 'gpt-4o')
    print({'deduct_success': success, 'new_balance': new_balance})
