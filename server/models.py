from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    display_name = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    profile_image = db.Column(db.String(255), nullable=True)  # Profil fotoğrafı yolu
    preferences = db.Column(db.Text, nullable=True)  # AI Taste Profile (JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Gamification Fields 🎮
    xp = db.Column(db.Integer, default=0)  # Harcanan XP bu alanı etkileyebilir
    total_xp_earned = db.Column(db.Integer, default=0)  # Toplam kazanılan XP (asla düşmez, level buna göre)
    level = db.Column(db.Integer, default=1)  # total_xp_earned'e göre hesaplanır
    coins = db.Column(db.Integer, default=0)  # Tema satın alımı için
    streak_days = db.Column(db.Integer, default=0)
    last_active_date = db.Column(db.Date, nullable=True)
    longest_streak = db.Column(db.Integer, default=0)

class ApiKey(db.Model):
    """Stores API keys for programmatic and external tool access (e.g. VS Code Extension)."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False) # e.g. "My VS Code Mac"
    key = db.Column(db.String(128), unique=True, nullable=False, index=True) # the token
    is_active = db.Column(db.Boolean, default=True) # Soft delete
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_used_at = db.Column(db.DateTime, nullable=True)
    
    user = db.relationship('User', backref=db.backref('api_keys', lazy='dynamic'))

class XPEvent(db.Model):
    """Per-event XP transaction log for analytics and auditing."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    amount = db.Column(db.Integer, nullable=False)
    source = db.Column(db.String(50), nullable=False, default='generic', index=True)
    reason = db.Column(db.String(255), nullable=True)
    metadata_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    user = db.relationship('User', backref=db.backref('xp_events', lazy='dynamic'))

class UserBadge(db.Model):
    """Kullanıcının kazandığı rozetler"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    badge_id = db.Column(db.String(50), nullable=False)  # 'first_question', '100_questions', vs.
    earned_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('user_id', 'badge_id', name='_user_badge_uc'),)
    user = db.relationship('User', backref=db.backref('badges', lazy='dynamic'))

class UserTheme(db.Model):
    """Kullanıcının aktif teması ve kilit açtığı temalar"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, unique=True)
    active_theme = db.Column(db.String(50), default='dark')
    unlocked_themes = db.Column(db.Text, default='["light", "dark"]') # JSON list

    user = db.relationship('User', backref=db.backref('theme_prefs', uselist=False))

class SharedSession(db.Model):
    """Paylaşılan sohbet oturumu (Real-time Collaboration)"""
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversation.id'), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    share_token = db.Column(db.String(64), unique=True, nullable=False)  # UUID token
    is_active = db.Column(db.Boolean, default=True)
    allow_chat = db.Column(db.Boolean, default=True)  # Katılımcılar mesaj gönderebilir mi
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)  # Opsiyonel süre sonu
    
    conversation = db.relationship('Conversation', backref=db.backref('shares', lazy='dynamic'))
    owner = db.relationship('User', backref=db.backref('shared_sessions', lazy='dynamic'))


class CollaborationReview(db.Model):
    """Review state for a shared collaboration session."""
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('shared_session.id'), nullable=False, unique=True)
    status = db.Column(db.String(32), nullable=False, default='open')  # open|revision_requested|approved
    updated_by_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    updated_by_name = db.Column(db.String(120), nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    session = db.relationship('SharedSession', backref=db.backref('review_state', uselist=False, lazy='joined'))
    updated_by_user = db.relationship('User', foreign_keys=[updated_by_user_id])


class CollaborationComment(db.Model):
    """Comment thread for shared collaboration review workflow."""
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('shared_session.id'), nullable=False, index=True)
    author_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    author_name = db.Column(db.String(120), nullable=False)
    comment = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    session = db.relationship('SharedSession', backref=db.backref('review_comments', lazy='dynamic', cascade='all, delete'))
    author_user = db.relationship('User', foreign_keys=[author_user_id])


class Conversation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=True)  # Linked project
    title = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_pinned = db.Column(db.Boolean, default=False)
    is_archived = db.Column(db.Boolean, default=False)
    linked_repo = db.Column(db.String(255), nullable=True)
    repo_branch = db.Column(db.String(100), default='main')
    
    user = db.relationship('User', backref=db.backref('conversations', lazy='dynamic'))


class History(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversation.id'), nullable=False)
    user_question = db.Column(db.Text, nullable=False)
    code_snippet = db.Column(db.Text)
    ai_response = db.Column(db.Text)
    selected_model = db.Column(db.String(64))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    summary = db.Column(db.Text)
    reasoning = db.Column(db.Text) # AI decision reasoning
    routing_reason = db.Column(db.Text) # Why this model was chosen
    persona = db.Column(db.String(100)) # Active persona during this turn
    likes = db.Column(db.Integer, default=0)
    image_path = db.Column(db.String(255), nullable=True)

    conversation = db.relationship('Conversation', backref=db.backref('history_items', lazy='dynamic', cascade="all, delete"))


class Answer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    history_id = db.Column(db.Integer, db.ForeignKey('history.id'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    author = db.Column(db.String(120), nullable=False)
    body = db.Column(db.Text, nullable=False)
    code_snippet = db.Column(db.Text)
    image_path = db.Column(db.String(255), nullable=True)
    likes = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    history = db.relationship('History', backref=db.backref('answers', lazy='dynamic', cascade="all, delete"))
    user = db.relationship('User', backref=db.backref('answers', lazy='dynamic'))


class PostLike(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    history_id = db.Column(db.Integer, db.ForeignKey('history.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('post_likes', lazy='dynamic'))
    history = db.relationship('History', backref=db.backref('post_likes', lazy='dynamic'))


class AnswerLike(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    answer_id = db.Column(db.Integer, db.ForeignKey('answer.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class NotificationRead(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    notification_id = db.Column(db.String(50), nullable=False) # e.g., "ans-123", "plike-456"
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('user_id', 'notification_id', name='_user_notification_uc'),)

class NotificationHidden(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    notification_id = db.Column(db.String(50), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('user_id', 'notification_id', name='_user_notification_hidden_uc'),)

    # No relationships needed for now, or use unique backref
    # user = db.relationship('User', backref=db.backref('read_notifications', lazy='dynamic'))


class Snippet(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    code = db.Column(db.Text, nullable=False)
    language = db.Column(db.String(50), default='plaintext')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('snippets', lazy='dynamic'))


class PasswordResetToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    token = db.Column(db.String(6), nullable=False)  # 6 haneli kod
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False)
    
    user = db.relationship('User', backref=db.backref('reset_tokens', lazy='dynamic'))


class UserFollow(db.Model):
    """Kullanıcı takip ilişkisi tablosu"""
    id = db.Column(db.Integer, primary_key=True)
    follower_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # Takip eden
    following_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # Takip edilen
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Aynı kullanıcıyı iki kere takip edemez
    __table_args__ = (db.UniqueConstraint('follower_id', 'following_id', name='_follower_following_uc'),)
    
    # İlişkiler
    follower = db.relationship('User', foreign_keys=[follower_id], backref=db.backref('following', lazy='dynamic'))
    following = db.relationship('User', foreign_keys=[following_id], backref=db.backref('followers', lazy='dynamic'))


class Notification(db.Model):
    """Genel bildirim tablosu"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)  # Bildirimi alan
    type = db.Column(db.String(50), nullable=False)  # 'follow', 'like', 'comment', etc.
    message = db.Column(db.String(255), nullable=False)
    related_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # İlgili kullanıcı (takip eden vs.)
    related_post_id = db.Column(db.Integer, db.ForeignKey('history.id'), nullable=True)  # İlgili gönderi
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # İlişkiler
    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('notifications', lazy='dynamic'))
    related_user = db.relationship('User', foreign_keys=[related_user_id])
    related_post = db.relationship('History', backref=db.backref('notifications', lazy='dynamic'))


class Favorite(db.Model):
    """Kullanıcıların favori AI yanıtları"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    history_id = db.Column(db.Integer, db.ForeignKey('history.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Aynı yanıtı birden fazla favoriye ekleyemez
    __table_args__ = (db.UniqueConstraint('user_id', 'history_id', name='_user_favorite_uc'),)
    
    # İlişkiler
    user = db.relationship('User', backref=db.backref('favorites', lazy='dynamic'))
    history = db.relationship('History', backref=db.backref('favorites', lazy='dynamic'))


class Feedback(db.Model):
    """AI yanıtları için kullanıcı geri bildirimi (👍/👎)"""
    id = db.Column(db.Integer, primary_key=True)
    history_id = db.Column(db.Integer, db.ForeignKey('history.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)  # Anonim de oy verebilir
    rating = db.Column(db.Integer, nullable=False)  # +1 = beğeni, -1 = beğenmeme
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Aynı kullanıcı/session aynı mesaja birden fazla oy veremez
    __table_args__ = (db.UniqueConstraint('history_id', 'user_id', name='_feedback_unique_uc'),)

    # İlişkiler
    history = db.relationship('History', backref=db.backref('feedbacks', lazy='dynamic'))
    user = db.relationship('User', backref=db.backref('feedbacks', lazy='dynamic'))

class FeedbackDetail(db.Model):
    """Gelişmiş geri bildirim detayları (nedenleri ve yorumlar)"""
    id = db.Column(db.Integer, primary_key=True)
    history_id = db.Column(db.Integer, db.ForeignKey('history.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    category = db.Column(db.String(100), nullable=False)  # e.g., 'Wrong or incomplete'
    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    history = db.relationship('History', backref=db.backref('feedback_details', lazy='dynamic'))
    user = db.relationship('User', backref=db.backref('feedback_details', lazy='dynamic'))


class Project(db.Model):
    """Çok dosyalı proje/workspace bağlamı"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # İlişkiler
    user = db.relationship('User', backref=db.backref('projects', lazy='dynamic'))
    files = db.relationship('ProjectFile', backref='project', lazy='dynamic',
                            cascade='all, delete-orphan')


class ProjectFile(db.Model):
    """Bir projeye ait dosya (çok dosyalı bağlam için)"""
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)       # e.g. 'src/App.jsx'
    content = db.Column(db.Text, nullable=False, default='')
    language = db.Column(db.String(50), default='plaintext')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================
# 💰 TOKEN EKONOMİSİ MODELLERİ (Hafta 2 — SaaS Dönüşüm)
# ============================================================

class TokenBalance(db.Model):
    """Kullanıcının token cüzdanı — her kullanıcı için tek kayıt."""
    __tablename__ = 'token_balance'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True, nullable=False)
    balance = db.Column(db.Integer, default=100, nullable=False)     # Kalan token
    total_spent = db.Column(db.Integer, default=0, nullable=False)   # Toplam harcanan (azalmaz)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('token_balance', uselist=False))

    def __repr__(self):
        return f'<TokenBalance user_id={self.user_id} balance={self.balance}>'


class TokenTransaction(db.Model):
    """Her token hareketinin değişmez kaydı (audit log)."""
    __tablename__ = 'token_transaction'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    # Pozitif = kazanç/satın alma, Negatif = harcama
    amount = db.Column(db.Integer, nullable=False)
    # 'purchase' | 'usage' | 'refund' | 'bonus' | 'signup_grant'
    type = db.Column(db.String(20), nullable=False, index=True)
    description = db.Column(db.String(255), nullable=True)
    # Stripe payment_intent_id veya history_id referansı
    reference_id = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    user = db.relationship('User', backref=db.backref('token_transactions', lazy='dynamic'))

    def __repr__(self):
        return f'<TokenTransaction user_id={self.user_id} amount={self.amount} type={self.type}>'


class TokenPackage(db.Model):
    """Admin tarafından yönetilen satılabilir token paketleri."""
    __tablename__ = 'token_package'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)         # "Starter", "Pro", "Enterprise"
    description = db.Column(db.String(255), nullable=True)
    tokens = db.Column(db.Integer, nullable=False)           # Verilen token miktarı
    price_usd = db.Column(db.Float, nullable=False)          # USD fiyat
    stripe_price_id = db.Column(db.String(100), nullable=True)  # Stripe ile entegrasyon (Hafta 3)
    is_active = db.Column(db.Boolean, default=True)
    bonus_pct = db.Column(db.Integer, default=0)             # Örn: 20 → %20 bonus token
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    purchases = db.relationship('TokenPurchase', backref='token_package', lazy='dynamic')

    def __repr__(self):
        return f'<TokenPackage {self.name} tokens={self.tokens} price=${self.price_usd}>'


class TokenPurchase(db.Model):
    """Stripe checkout sonucu oluşan token satın alma kaydı."""
    __tablename__ = 'token_purchase'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    package_id = db.Column(db.Integer, db.ForeignKey('token_package.id'), nullable=True, index=True)
    package_name = db.Column(db.String(100), nullable=True)
    tokens_granted = db.Column(db.Integer, nullable=False)
    amount_cents = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(12), default='usd', nullable=False)
    stripe_checkout_session_id = db.Column(db.String(128), unique=True, nullable=False, index=True)
    stripe_payment_intent_id = db.Column(db.String(128), unique=True, nullable=True, index=True)
    stripe_customer_id = db.Column(db.String(128), nullable=True, index=True)
    status = db.Column(db.String(32), default='pending', index=True)
    metadata_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    completed_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship('User', backref=db.backref('token_purchases', lazy='dynamic'))

    def __repr__(self):
        return f'<TokenPurchase user_id={self.user_id} session={self.stripe_checkout_session_id} status={self.status}>'

