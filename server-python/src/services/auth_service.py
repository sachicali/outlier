import jwt
import os
import hashlib
import bcrypt
import secrets
from datetime import datetime, timedelta
from utils.logger import logger
from models.user import User
from .two_factor_service import TwoFactorService

# Secret key for JWT (in production, use a secure secret)
JWT_SECRET = os.environ.get('JWT_SECRET', 'changeme')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_DELTA = timedelta(hours=1)
REFRESH_TOKEN_EXPIRATION_DELTA = timedelta(days=7)

# Mock user database (will be replaced with proper database integration)
USERS = {
    'admin': {
        'id': 1,
        'username': 'admin',
        'email': 'admin@example.com',
        'password_hash': hashlib.sha256('admin123'.encode()).hexdigest(),  # Insecure, for demo only
        'role': 'admin',
        'isEmailVerified': True,
        'twoFactorEnabled': False,
        'twoFactorSecret': None,
        'backupCodes': None,
        'twoFactorBackupCodesUsed': [],
        'failedLoginAttempts': 0,
        'lockedUntil': None
    },
    'user': {
        'id': 2,
        'username': 'user',
        'email': 'user@example.com',
        'password_hash': hashlib.sha256('user123'.encode()).hexdigest(),  # Insecure, for demo only
        'role': 'user',
        'isEmailVerified': True,
        'twoFactorEnabled': False,
        'twoFactorSecret': None,
        'backupCodes': None,
        'twoFactorBackupCodesUsed': [],
        'failedLoginAttempts': 0,
        'lockedUntil': None
    }
}

# Mock refresh tokens store
REFRESH_TOKENS = {}

# Mock pending 2FA verifications
PENDING_2FA = {}

class AuthService:
    def __init__(self):
        self.two_factor_service = TwoFactorService()
    
    def generate_tokens(self, user, is_2fa_verified=False):
        """Generate access and refresh tokens for a user"""
        # Create access token
        access_payload = {
            'user_id': user['id'],
            'username': user['username'],
            'role': user['role'],
            'is_2fa_verified': is_2fa_verified,
            'exp': datetime.utcnow() + JWT_EXPIRATION_DELTA
        }
        access_token = jwt.encode(access_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        # Create refresh token
        refresh_payload = {
            'user_id': user['id'],
            'username': user['username'],
            'is_2fa_verified': is_2fa_verified,
            'exp': datetime.utcnow() + REFRESH_TOKEN_EXPIRATION_DELTA
        }
        refresh_token = jwt.encode(refresh_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        # Store refresh token (in production, store in database)
        REFRESH_TOKENS[refresh_token] = {
            'user_id': user['id'],
            'username': user['username'],
            'is_2fa_verified': is_2fa_verified
        }
        
        return {
            'accessToken': access_token,
            'refreshToken': refresh_token,
            'tokenType': 'Bearer',
            'expiresIn': JWT_EXPIRATION_DELTA.total_seconds()
        }
    
    def register_user(self, data):
        """Register a new user"""
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        if not username or not email or not password:
            raise ValueError('Username, email, and password are required')
        
        if username in USERS:
            raise ValueError('Username already exists')
        
        # Check if email already exists
        for user in USERS.values():
            if user['email'] == email:
                raise ValueError('Email already exists')
        
        # Validate password strength
        if len(password) < 8:
            raise ValueError('Password must be at least 8 characters long')
        
        # Create new user with proper password hashing
        user_id = len(USERS) + 1
        salt = bcrypt.gensalt(rounds=12)
        password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        
        new_user = {
            'id': user_id,
            'username': username,
            'email': email,
            'password_hash': password_hash,
            'role': 'user',  # Default role
            'isEmailVerified': False,
            'twoFactorEnabled': False,
            'twoFactorSecret': None,
            'backupCodes': None,
            'twoFactorBackupCodesUsed': [],
            'failedLoginAttempts': 0,
            'lockedUntil': None,
            'createdAt': datetime.utcnow().isoformat(),
            'updatedAt': datetime.utcnow().isoformat()
        }
        
        USERS[username] = new_user
        
        # Generate tokens (not 2FA verified yet)
        tokens = self.generate_tokens(new_user, is_2fa_verified=False)
        
        return {
            'user': {
                'id': new_user['id'],
                'username': new_user['username'],
                'email': new_user['email'],
                'role': new_user['role'],
                'isEmailVerified': new_user['isEmailVerified'],
                'twoFactorEnabled': new_user['twoFactorEnabled']
            },
            'tokens': tokens
        }
    
    def login_user(self, data):
        """Authenticate and login a user"""
        username = data.get('username')
        password = data.get('password')
        totp_code = data.get('totpCode')  # Optional 2FA code
        
        if not username or not password:
            raise ValueError('Username and password are required')
        
        user = USERS.get(username)
        if not user:
            # Increment failed attempts for security
            raise ValueError('Invalid username or password')
        
        # Check if account is locked
        if self.is_account_locked(user):
            raise ValueError('Account is temporarily locked due to too many failed login attempts')
        
        # Verify password
        if not self.verify_password(password, user['password_hash']):
            self.increment_failed_login(user)
            raise ValueError('Invalid username or password')
        
        # Check if 2FA is enabled
        if user.get('twoFactorEnabled', False):
            if not totp_code:
                # Store pending login for 2FA verification
                session_id = secrets.token_urlsafe(32)
                PENDING_2FA[session_id] = {
                    'user_id': user['id'],
                    'username': username,
                    'expires_at': datetime.utcnow() + timedelta(minutes=5)
                }
                
                return {
                    'requiresTwoFactor': True,
                    'sessionId': session_id,
                    'message': 'Two-factor authentication required'
                }
            else:
                # Verify 2FA code
                if not self.verify_2fa_code(user, totp_code):
                    self.increment_failed_login(user)
                    raise ValueError('Invalid two-factor authentication code')
        
        # Reset failed login attempts on successful login
        self.reset_failed_login(user)
        
        # Generate tokens
        is_2fa_verified = not user.get('twoFactorEnabled', False) or totp_code is not None
        tokens = self.generate_tokens(user, is_2fa_verified=is_2fa_verified)
        
        return {
            'user': {
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'role': user['role'],
                'isEmailVerified': user['isEmailVerified'],
                'twoFactorEnabled': user.get('twoFactorEnabled', False)
            },
            'tokens': tokens
        }
    
    def complete_2fa_login(self, session_id, totp_code):
        """Complete login after 2FA verification"""
        # Check if session exists and is valid
        if session_id not in PENDING_2FA:
            raise ValueError('Invalid or expired session')
        
        session = PENDING_2FA[session_id]
        if datetime.utcnow() > session['expires_at']:
            del PENDING_2FA[session_id]
            raise ValueError('Session expired. Please log in again.')
        
        # Get user
        user = USERS.get(session['username'])
        if not user:
            del PENDING_2FA[session_id]
            raise ValueError('User not found')
        
        # Verify 2FA code
        if not self.verify_2fa_code(user, totp_code):
            self.increment_failed_login(user)
            raise ValueError('Invalid two-factor authentication code')
        
        # Clear pending session
        del PENDING_2FA[session_id]
        
        # Reset failed login attempts
        self.reset_failed_login(user)
        
        # Generate tokens
        tokens = self.generate_tokens(user, is_2fa_verified=True)
        
        return {
            'user': {
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'role': user['role'],
                'isEmailVerified': user['isEmailVerified'],
                'twoFactorEnabled': user.get('twoFactorEnabled', False)
            },
            'tokens': tokens
        }
    
    def refresh_token(self):
        """Refresh access token using refresh token"""
        # In a real implementation, get refresh token from request headers
        # For this demo, we'll just return a new token pair
        raise ValueError('Refresh token not provided')
    
    def logout_user(self):
        """Logout user (invalidate refresh token)"""
        # In a real implementation, invalidate the refresh token
        return {'message': 'Logged out successfully'}
    
    def update_profile(self, user_id, data):
        """Update user profile"""
        # Find user by ID
        user = None
        for u in USERS.values():
            if u['id'] == user_id:
                user = u
                break
        
        if not user:
            raise ValueError('User not found')
        
        # Update user data
        if 'username' in data and data['username'] != user['username']:
            if data['username'] in USERS:
                raise ValueError('Username already exists')
            USERS[data['username']] = USERS.pop(user['username'])
            user = USERS[data['username']]
            user['username'] = data['username']
        
        if 'email' in data:
            user['email'] = data['email']
        
        user['updatedAt'] = datetime.utcnow().isoformat()
        
        return {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'role': user['role'],
            'isEmailVerified': user['isEmailVerified'],
            'twoFactorEnabled': user.get('twoFactorEnabled', False),
            'updatedAt': user['updatedAt']
        }
    
    def verify_password(self, password, stored_hash):
        """Verify password against stored hash"""
        try:
            # Try bcrypt first (new format)
            return bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))
        except (ValueError, TypeError):
            # Fallback to old SHA256 format for existing users
            return stored_hash == hashlib.sha256(password.encode()).hexdigest()
    
    def is_account_locked(self, user):
        """Check if account is locked due to failed login attempts"""
        locked_until = user.get('lockedUntil')
        if locked_until:
            if isinstance(locked_until, str):
                locked_until = datetime.fromisoformat(locked_until)
            return locked_until > datetime.utcnow()
        return False
    
    def increment_failed_login(self, user):
        """Increment failed login attempts and lock account if necessary"""
        user['failedLoginAttempts'] = user.get('failedLoginAttempts', 0) + 1
        
        # Lock account after 5 failed attempts for 30 minutes
        if user['failedLoginAttempts'] >= 5:
            user['lockedUntil'] = (datetime.utcnow() + timedelta(minutes=30)).isoformat()
    
    def reset_failed_login(self, user):
        """Reset failed login attempts on successful login"""
        user['failedLoginAttempts'] = 0
        user['lockedUntil'] = None
        user['lastLogin'] = datetime.utcnow().isoformat()
    
    def verify_2fa_code(self, user, code):
        """Verify 2FA TOTP or backup code"""
        try:
            # Mock user to User-like object for 2FA service
            mock_user = type('MockUser', (), {
                'id': user['id'],
                'username': user['username'],
                'two_factor_enabled': user.get('twoFactorEnabled', False),
                'two_factor_secret': user.get('twoFactorSecret'),
                'backup_codes': user.get('backupCodes'),
                'two_factor_backup_codes_used': user.get('twoFactorBackupCodesUsed', [])
            })()
            
            result = self.two_factor_service.verify_two_factor(mock_user, code)
            
            # Update user with any changes from verification (used backup codes)
            user['twoFactorBackupCodesUsed'] = mock_user.two_factor_backup_codes_used
            
            return result
        except Exception as e:
            logger.error(f"2FA verification error: {e}")
            return False
    
    def setup_2fa(self, user):
        """Setup 2FA for a user"""
        # Mock user to User-like object for 2FA service
        mock_user = type('MockUser', (), {
            'id': user['id'],
            'username': user['username'],
            'email': user['email']
        })()
        
        return self.two_factor_service.setup_two_factor(mock_user)
    
    def enable_2fa(self, user, secret, verification_code, backup_codes):
        """Enable 2FA after verification"""
        # Mock user to User-like object for 2FA service
        mock_user = type('MockUser', (), {
            'id': user['id'],
            'username': user['username'],
            'two_factor_enabled': False,
            'two_factor_secret': None,
            'backup_codes': None,
            'two_factor_backup_codes_used': []
        })()
        
        # Enable 2FA through service
        self.two_factor_service.enable_two_factor(mock_user, secret, verification_code, backup_codes)
        
        # Update user record
        user['twoFactorEnabled'] = True
        user['twoFactorSecret'] = mock_user.two_factor_secret
        user['backupCodes'] = mock_user.backup_codes
        user['twoFactorBackupCodesUsed'] = []
        user['updatedAt'] = datetime.utcnow().isoformat()
        
        # Invalidate all existing sessions when 2FA is enabled
        self.invalidate_all_sessions(user['id'])
        
        logger.info(f"2FA enabled for user {user['id']} ({user['username']})")
        return True
    
    def disable_2fa(self, user, password):
        """Disable 2FA"""
        # Verify password
        if not self.verify_password(password, user['password_hash']):
            raise ValueError('Invalid password')
        
        # Disable 2FA
        user['twoFactorEnabled'] = False
        user['twoFactorSecret'] = None
        user['backupCodes'] = None
        user['twoFactorBackupCodesUsed'] = []
        user['updatedAt'] = datetime.utcnow().isoformat()
        
        # Invalidate all existing sessions when 2FA is disabled
        self.invalidate_all_sessions(user['id'])
        
        logger.info(f"2FA disabled for user {user['id']} ({user['username']})")
        return True
    
    def regenerate_backup_codes(self, user):
        """Regenerate backup codes"""
        if not user.get('twoFactorEnabled', False):
            raise ValueError('Two-factor authentication is not enabled')
        
        # Mock user to User-like object for 2FA service
        mock_user = type('MockUser', (), {
            'id': user['id'],
            'username': user['username'],
            'two_factor_enabled': True,
            'backup_codes': user.get('backupCodes'),
            'two_factor_backup_codes_used': user.get('twoFactorBackupCodesUsed', [])
        })()
        
        new_codes = self.two_factor_service.regenerate_backup_codes(mock_user)
        
        # Update user record
        user['backupCodes'] = mock_user.backup_codes
        user['twoFactorBackupCodesUsed'] = []
        user['updatedAt'] = datetime.utcnow().isoformat()
        
        logger.info(f"Backup codes regenerated for user {user['id']} ({user['username']})")
        return new_codes
    
    def invalidate_all_sessions(self, user_id):
        """Invalidate all refresh tokens for a user"""
        # Remove all refresh tokens for this user
        tokens_to_remove = []
        for token, data in REFRESH_TOKENS.items():
            if data.get('user_id') == user_id:
                tokens_to_remove.append(token)
        
        for token in tokens_to_remove:
            del REFRESH_TOKENS[token]
        
        logger.info(f"All sessions invalidated for user {user_id}")