from app import app, db, DEFAULT_TOKEN_PACKAGES
from models import TokenPackage

def sync():
    with app.app_context():
        print("Syncing packages from DEFAULT_TOKEN_PACKAGES...")
        for pkg_data in DEFAULT_TOKEN_PACKAGES:
            pkg = TokenPackage.query.get(pkg_data['id'])
            if pkg:
                print(f"Updating package: {pkg.id}")
                pkg.name = pkg_data['name']
                pkg.description = pkg_data['description']
                pkg.tokens = pkg_data['tokens']
                pkg.price_usd = pkg_data['price_usd']
                pkg.price_try = pkg_data.get('price_try')
                pkg.bonus_pct = pkg_data['bonus_pct']
            else:
                print(f"Creating package: {pkg_data['id']}")
                pkg = TokenPackage(
                    id=pkg_data['id'],
                    name=pkg_data['name'],
                    description=pkg_data['description'],
                    tokens=pkg_data['tokens'],
                    price_usd=pkg_data['price_usd'],
                    price_try=pkg_data.get('price_try'),
                    bonus_pct=pkg_data['bonus_pct']
                )
                db.session.add(pkg)
        
        db.session.commit()
        print("Sync complete!")

if __name__ == "__main__":
    sync()
