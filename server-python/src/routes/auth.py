from flask import Blueprint, request, jsonify, g
from services.auth_service import AuthService
from middleware.auth import authenticate, optional_auth, require_2fa_verified
from middleware.rbac import require_permission
from utils.logger import logger

bp = Blueprint('auth', __name__, url_prefix='/api/auth')

# Initialize auth service
auth_service = AuthService()

@bp.route('/register', methods=['POST'])
def register():
    """
    Register a new user
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        result = auth_service.register_user(data)
        return jsonify(result), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Registration error: {e}")
        return jsonify({'error': 'Registration failed'}), 500

@bp.route('/login', methods=['POST'])
def login():
    """
    Authenticate user and return JWT
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        result = auth_service.login_user(data)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 401
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'error': 'Login failed'}), 500

@bp.route('/refresh', methods=['POST'])
def refresh():
    """
    Refresh access token using refresh token
    """
    try:
        result = auth_service.refresh_token()
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 401
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        return jsonify({'error': 'Token refresh failed'}), 500

@bp.route('/logout', methods=['POST'])
@optional_auth
def logout():
    """
    Logout user (invalidate refresh token)
    """
    try:
        result = auth_service.logout_user()
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return jsonify({'error': 'Logout failed'}), 500

@bp.route('/profile', methods=['GET'])
@authenticate
def get_profile():
    """
    Get current user profile
    """
    try:
        user = g.user
        token_payload = getattr(g, 'token_payload', {})
        
        profile_data = {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'role': user['role'],
            'isEmailVerified': user.get('isEmailVerified', False),
            'twoFactorEnabled': user.get('twoFactorEnabled', False),
            'createdAt': user.get('createdAt'),
            'updatedAt': user.get('updatedAt'),
            'lastLogin': user.get('lastLogin')
        }
        
        # Add 2FA verification status if 2FA is enabled
        if user.get('twoFactorEnabled', False):
            profile_data['is2faVerified'] = token_payload.get('is_2fa_verified', False)
            
            # Add backup codes status
            backup_codes = user.get('backupCodes', [])
            used_codes = user.get('twoFactorBackupCodesUsed', [])
            profile_data['backupCodesRemaining'] = max(0, 10 - len(used_codes)) if backup_codes else 0
        
        return jsonify(profile_data), 200
    except Exception as e:
        logger.error(f"Profile fetch error: {e}")
        return jsonify({'error': 'Failed to fetch profile'}), 500

@bp.route('/profile', methods=['PUT'])
@authenticate
@require_2fa_verified
@require_permission('profile:write')
def update_profile():
    """
    Update user profile (requires 2FA if enabled)
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        user = g.user
        result = auth_service.update_profile(user['id'], data)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Profile update error: {e}")
        return jsonify({'error': 'Failed to update profile'}), 500

@bp.route('/verify', methods=['GET'])
@authenticate
def verify_token():
    """
    Verify JWT token
    """
    return jsonify({'valid': True}), 200

@bp.route('/status', methods=['GET'])
@optional_auth
def get_auth_status():
    """
    Get authentication status
    """
    user = getattr(g, 'user', None)
    if user:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'role': user['role']
            }
        }), 200
    else:
        return jsonify({'authenticated': False}), 200