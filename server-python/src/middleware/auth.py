import os
from functools import wraps
from flask import request, jsonify, g
import jwt
from utils.logger import logger
from datetime import datetime

JWT_SECRET = os.environ.get('JWT_SECRET', 'changeme')

# Dummy user DB for demonstration (imported from auth_service)
from services.auth_service import USERS

API_KEYS = {
    'test-api-key': {'role': 'user', 'id': 2},
}

def extract_token():
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        return auth_header.split(' ')[1]
    if 'token' in request.args:
        return request.args['token']
    return None

def extract_api_key():
    api_key = request.headers.get('X-API-Key')
    if api_key:
        return api_key
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('ApiKey '):
        return auth_header.split(' ')[1]
    return None

def authenticate(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = extract_token()
        api_key = extract_api_key()
        user = None
        if token:
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
                username = payload.get('username')
                user = USERS.get(username)
                
                if not user:
                    return jsonify({'error': 'User not found'}), 401
                
                # Check if account is locked
                if is_account_locked(user):
                    return jsonify({'error': 'Account is temporarily locked'}), 401
                
                # Store payload info in g for access in routes
                g.user = user
                g.token_payload = payload
                
            except jwt.ExpiredSignatureError:
                return jsonify({'error': 'Token has expired'}), 401
            except jwt.InvalidTokenError as e:
                logger.warn(f'JWT auth failed: {e}')
                return jsonify({'error': 'Invalid token'}), 401
        elif api_key:
            user = API_KEYS.get(api_key)
            g.user = user
            if not user:
                return jsonify({'error': 'Invalid API key'}), 401
        else:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated

def optional_auth(f):
    """Optional authentication - sets g.user if token is provided and valid, but doesn't require it"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = extract_token()
        api_key = extract_api_key()
        user = None
        if token:
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
                username = payload.get('username')
                user = USERS.get(username)
                
                if user and not is_account_locked(user):
                    g.user = user
                    g.token_payload = payload
                    
            except Exception as e:
                logger.warn(f'JWT auth failed: {e}')
                # Don't return error for optional auth
        elif api_key:
            user = API_KEYS.get(api_key)
            g.user = user
        return f(*args, **kwargs)
    return decorated

def require_permission(permission):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = getattr(g, 'user', None)
            if not user or not has_permission(user, permission):
                return jsonify({'error': 'Forbidden'}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

def require_2fa_verified(f):
    """Require that the user has completed 2FA verification"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = getattr(g, 'user', None)
        token_payload = getattr(g, 'token_payload', {})
        
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        
        # If user has 2FA enabled, check if they've completed verification
        if user.get('twoFactorEnabled', False):
            is_2fa_verified = token_payload.get('is_2fa_verified', False)
            if not is_2fa_verified:
                return jsonify({
                    'error': 'Two-factor authentication required',
                    'requiresTwoFactor': True
                }), 403
        
        return f(*args, **kwargs)
    return decorated

def is_account_locked(user):
    """Check if account is locked due to failed login attempts"""
    locked_until = user.get('lockedUntil')
    if locked_until:
        if isinstance(locked_until, str):
            locked_until = datetime.fromisoformat(locked_until)
        return locked_until > datetime.utcnow()
    return False

def has_permission(user, permission):
    # Simple mapping for demonstration
    role = user.get('role')
    if role == 'admin':
        return True
    if role == 'user' and permission in ['analysis:read', 'analysis:write', 'profile:write']:
        return True
    return False
