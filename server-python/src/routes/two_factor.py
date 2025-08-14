from flask import Blueprint, request, jsonify, g
from services.auth_service import AuthService
from services.two_factor_service import TwoFactorService
from middleware.auth import authenticate
from utils.logger import logger
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import os

# Initialize rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri=os.environ.get('REDIS_URL', 'redis://localhost:6379')
)

bp = Blueprint('two_factor', __name__, url_prefix='/api/auth/2fa')

# Initialize services
auth_service = AuthService()
two_factor_service = TwoFactorService()

@bp.route('/setup', methods=['POST'])
@authenticate
@limiter.limit("5 per minute")
def setup_two_factor():
    """
    Initialize 2FA setup - returns QR code and backup codes
    """
    try:
        user = g.user
        
        # Check if 2FA is already enabled
        if user.get('twoFactorEnabled', False):
            return jsonify({'error': 'Two-factor authentication is already enabled'}), 400
        
        # Setup 2FA
        setup_data = auth_service.setup_2fa(user)
        
        return jsonify({
            'qrCode': setup_data['qrCode'],
            'manualEntryKey': setup_data['manualEntryKey'],
            'backupCodes': setup_data['backupCodes'],
            'message': 'Scan the QR code with your authenticator app, then verify with a code to enable 2FA'
        }), 200
        
    except Exception as e:
        logger.error(f"2FA setup error: {e}")
        return jsonify({'error': 'Failed to setup two-factor authentication'}), 500

@bp.route('/enable', methods=['POST'])
@authenticate
@limiter.limit("10 per minute")
def enable_two_factor():
    """
    Enable 2FA after verifying TOTP code
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        user = g.user
        secret = data.get('secret')
        verification_code = data.get('verificationCode')
        backup_codes = data.get('backupCodes')
        
        if not secret or not verification_code or not backup_codes:
            return jsonify({'error': 'Secret, verification code, and backup codes are required'}), 400
        
        # Check if 2FA is already enabled
        if user.get('twoFactorEnabled', False):
            return jsonify({'error': 'Two-factor authentication is already enabled'}), 400
        
        # Enable 2FA
        auth_service.enable_2fa(user, secret, verification_code, backup_codes)
        
        return jsonify({
            'message': 'Two-factor authentication enabled successfully',
            'backupCodes': backup_codes
        }), 200
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"2FA enable error: {e}")
        return jsonify({'error': 'Failed to enable two-factor authentication'}), 500

@bp.route('/disable', methods=['POST'])
@authenticate
@limiter.limit("5 per minute")
def disable_two_factor():
    """
    Disable 2FA (requires password confirmation)
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        user = g.user
        password = data.get('password')
        
        if not password:
            return jsonify({'error': 'Password is required'}), 400
        
        # Check if 2FA is enabled
        if not user.get('twoFactorEnabled', False):
            return jsonify({'error': 'Two-factor authentication is not enabled'}), 400
        
        # Disable 2FA
        auth_service.disable_2fa(user, password)
        
        return jsonify({
            'message': 'Two-factor authentication disabled successfully'
        }), 200
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"2FA disable error: {e}")
        return jsonify({'error': 'Failed to disable two-factor authentication'}), 500

@bp.route('/verify', methods=['POST'])
@limiter.limit("10 per minute")
def verify_two_factor():
    """
    Verify 2FA code during login (complete login process)
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        session_id = data.get('sessionId')
        totp_code = data.get('totpCode')
        
        if not session_id or not totp_code:
            return jsonify({'error': 'Session ID and TOTP code are required'}), 400
        
        # Complete 2FA login
        result = auth_service.complete_2fa_login(session_id, totp_code)
        
        return jsonify(result), 200
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 401
    except Exception as e:
        logger.error(f"2FA verification error: {e}")
        return jsonify({'error': 'Failed to verify two-factor authentication'}), 500

@bp.route('/backup-codes', methods=['POST'])
@authenticate
@limiter.limit("3 per hour")
def regenerate_backup_codes():
    """
    Generate new backup codes
    """
    try:
        user = g.user
        
        # Check if 2FA is enabled
        if not user.get('twoFactorEnabled', False):
            return jsonify({'error': 'Two-factor authentication is not enabled'}), 400
        
        # Regenerate backup codes
        new_codes = auth_service.regenerate_backup_codes(user)
        
        return jsonify({
            'backupCodes': new_codes,
            'message': 'New backup codes generated. Please save them securely.'
        }), 200
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Backup codes regeneration error: {e}")
        return jsonify({'error': 'Failed to regenerate backup codes'}), 500

@bp.route('/status', methods=['GET'])
@authenticate
def get_two_factor_status():
    """
    Get 2FA status for current user
    """
    try:
        user = g.user
        
        status = {
            'enabled': user.get('twoFactorEnabled', False),
            'backupCodes': {
                'total': 0,
                'used': 0,
                'remaining': 0
            }
        }
        
        if status['enabled']:
            # Mock calculation for backup codes status
            backup_codes = user.get('backupCodes', [])
            used_codes = user.get('twoFactorBackupCodesUsed', [])
            
            if backup_codes:
                # In production, decrypt backup codes to get actual count
                status['backupCodes'] = {
                    'total': 10,  # Assuming 10 backup codes
                    'used': len(used_codes),
                    'remaining': 10 - len(used_codes)
                }
        
        return jsonify(status), 200
        
    except Exception as e:
        logger.error(f"2FA status error: {e}")
        return jsonify({'error': 'Failed to get two-factor authentication status'}), 500

@bp.route('/recovery', methods=['POST'])
@limiter.limit("3 per hour")
def recover_with_backup_code():
    """
    Login using backup code when TOTP is not available
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        session_id = data.get('sessionId')
        backup_code = data.get('backupCode')
        
        if not session_id or not backup_code:
            return jsonify({'error': 'Session ID and backup code are required'}), 400
        
        # Use backup code to complete login
        result = auth_service.complete_2fa_login(session_id, backup_code.upper())
        
        return jsonify({
            **result,
            'message': 'Login successful using backup code. Consider regenerating your backup codes.'
        }), 200
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 401
    except Exception as e:
        logger.error(f"Backup code recovery error: {e}")
        return jsonify({'error': 'Failed to recover using backup code'}), 500

# Rate limiting error handler
@bp.errorhandler(429)
def rate_limit_exceeded(e):
    """Handle rate limit exceeded"""
    return jsonify({
        'error': 'Rate limit exceeded',
        'message': 'Too many requests. Please try again later.',
        'retry_after': getattr(e, 'retry_after', None)
    }), 429