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

