#!/usr/bin/env python3
"""
Fix script: Recalculate and update all user levels based on total_xp_earned
"""

import sys
import os
import math

# Server dizinini Python path'e ekle
sys.path.insert(0, os.path.dirname(__file__))

from app import app, db
from models import User

def calculate_level(xp):
    """XP'ye göre seviye hesaplar (Seviye = Kök(XP/100) + 1)"""
    safe_xp = max(int(xp or 0), 0)
    return math.floor(math.sqrt(safe_xp / 100)) + 1

def fix_levels():
    """Tüm kullanıcı seviyelerini recalculate eder."""
    with app.app_context():
        users = User.query.all()
        
        print(f"🔄 Recalculating levels for {len(users)} users...\n")
        
        updated_count = 0
        for user in users:
            total_xp = user.total_xp_earned or 0
            new_level = calculate_level(total_xp)
            old_level = user.level or 1
            
            if old_level != new_level:
                user.level = new_level
                db.session.add(user)
                updated_count += 1
                print(f"  ✓ {user.display_name}: Level {old_level} → {new_level} (Total XP: {total_xp})")
        
        if updated_count > 0:
            db.session.commit()
            print(f"\n✅ Successfully updated {updated_count} users!")
        else:
            print(f"\n✓ All levels already correct!")
        
        # Summary
        print("\n📊 User Levels Summary:")
        level_distribution = {}
        for user in User.query.all():
            lvl = user.level or 1
            level_distribution[lvl] = level_distribution.get(lvl, 0) + 1
        
        for lvl in sorted(level_distribution.keys()):
            print(f"  Level {lvl}: {level_distribution[lvl]} users")

if __name__ == '__main__':
    print("🔧 User Level Recalculation Script\n")
    fix_levels()
