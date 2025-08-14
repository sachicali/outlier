try:
    from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, JSON
    from sqlalchemy.sql import func
    SQLALCHEMY_AVAILABLE = True
except Exception:
    # Mock SQLAlchemy functions for when SQLAlchemy is not available or incompatible
    def Column(*args, **kwargs):
        return None
    
    class MockType:
        def __init__(self, *args, **kwargs):
            pass
        def __call__(self, *args, **kwargs):
            return self
    
    String = Integer = Boolean = DateTime = Text = JSON = MockType
    
    class MockFunc:
        def now(self):
            return None
        def __getattr__(self, name):
            return lambda *args, **kwargs: None
    
    func = MockFunc()
    SQLALCHEMY_AVAILABLE = False

from db import Base
import bcrypt
import secrets
from datetime import datetime


class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default='user', nullable=False)
    is_email_verified = Column(Boolean, default=False)
    
    # 2FA fields
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(255), nullable=True)  # Encrypted TOTP secret
    backup_codes = Column(JSON, nullable=True)  # Encrypted backup codes
    two_factor_backup_codes_used = Column(JSON, default=list)  # Track used backup codes
    
    # Account security
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    password_reset_token = Column(String(255), nullable=True)
    password_reset_expires = Column(DateTime, nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime, nullable=True)
    
    def set_password(self, password):
        """Hash and set password"""
        salt = bcrypt.gensalt(rounds=12)
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def check_password(self, password):
        """Verify password"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    def generate_backup_codes(self, count=10):
        """Generate secure backup codes"""
        codes = []
        for _ in range(count):
            code = secrets.token_urlsafe(8)[:8].upper()  # 8 character codes
            codes.append(code)
        return codes
    
    def is_backup_code_valid(self, code):
        """Check if backup code is valid and unused"""
        if not self.backup_codes:
            return False
        
        # Decrypt and check backup codes (implementation depends on encryption method)
        # For now, assuming backup_codes is a list of plaintext codes
        used_codes = self.two_factor_backup_codes_used or []
        return code in self.backup_codes and code not in used_codes
    
    def use_backup_code(self, code):
        """Mark backup code as used"""
        if not self.two_factor_backup_codes_used:
            self.two_factor_backup_codes_used = []
        
        if code not in self.two_factor_backup_codes_used:
            self.two_factor_backup_codes_used.append(code)
    
    def is_account_locked(self):
        """Check if account is locked due to failed login attempts"""
        if self.locked_until and self.locked_until > datetime.utcnow():
            return True
        return False
    
    def increment_failed_login(self):
        """Increment failed login attempts and lock account if necessary"""
        self.failed_login_attempts = (self.failed_login_attempts or 0) + 1
        
        # Lock account after 5 failed attempts for 30 minutes
        if self.failed_login_attempts >= 5:
            from datetime import timedelta
            self.locked_until = datetime.utcnow() + timedelta(minutes=30)
    
    def reset_failed_login(self):
        """Reset failed login attempts on successful login"""
        self.failed_login_attempts = 0
        self.locked_until = None
        self.last_login = datetime.utcnow()
    
    def to_dict(self, include_sensitive=False):
        """Convert user to dictionary"""
        data = {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'isEmailVerified': self.is_email_verified,
            'twoFactorEnabled': self.two_factor_enabled,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None,
            'lastLogin': self.last_login.isoformat() if self.last_login else None
        }
        
        if include_sensitive:
            data.update({
                'failedLoginAttempts': self.failed_login_attempts,
                'isLocked': self.is_account_locked(),
                'lockedUntil': self.locked_until.isoformat() if self.locked_until else None
            })
        
        return data