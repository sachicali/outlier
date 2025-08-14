from functools import wraps
from flask import g, jsonify

ROLES = {
    'admin': {
        'level': 100,
        'permissions': [
            'user:read', 'user:write', 'user:delete', 'user:manage',
            'analysis:read', 'analysis:write', 'analysis:delete', 'analysis:manage',
            'apikey:read', 'apikey:write', 'apikey:delete', 'apikey:manage',
            'system:read', 'system:write', 'system:manage',
        ],
    },
    'user': {
        'level': 10,
        'permissions': [
            'analysis:read', 'analysis:write', 'apikey:read', 'apikey:write', 'profile:read', 'profile:write',
        ],
    },
    'guest': {
        'level': 1,
        'permissions': ['analysis:read'],
    },
}

def require_scopes(scopes):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = getattr(g, 'user', None)
            if not user:
                return jsonify({'error': 'Forbidden'}), 403
            user_role = user.get('role', 'guest')
            allowed = any(scope in ROLES[user_role]['permissions'] for scope in scopes)
            if not allowed:
                return jsonify({'error': 'Insufficient scope'}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

def require_permission(permission):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = getattr(g, 'user', None)
            if not user:
                return jsonify({'error': 'Forbidden'}), 403
            user_role = user.get('role', 'guest')
            if permission not in ROLES[user_role]['permissions']:
                return jsonify({'error': 'Forbidden'}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
