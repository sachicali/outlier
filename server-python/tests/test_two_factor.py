import pytest
import json
import pyotp
import time
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

# Test the 2FA service
def test_two_factor_service():
    from src.services.two_factor_service import TwoFactorService
    
    service = TwoFactorService()
    
    # Test secret generation
    secret = service.generate_secret()
    assert len(secret) == 32
    assert secret.isalnum()
    assert secret.isupper()
    
    # Test encryption/decryption
    encrypted = service.encrypt_secret(secret)
    decrypted = service.decrypt_secret(encrypted)
    assert decrypted == secret
    
    # Test TOTP verification
    totp = pyotp.TOTP(secret)
    current_code = totp.now()
    
    assert service.verify_totp_code(secret, current_code)
    assert not service.verify_totp_code(secret, "000000")
    
    # Test backup codes generation
    codes = service.generate_backup_codes()
    assert len(codes) == 10
    for code in codes:
        assert len(code) == 8
        assert code.isupper()
        assert code.isalnum()

def test_2fa_setup_endpoint(client, auth_headers):
    """Test 2FA setup endpoint"""
    response = client.post('/api/auth/2fa/setup', headers=auth_headers)
    
    assert response.status_code == 200
    data = response.get_json()
    
    assert 'qrCode' in data
    assert 'manualEntryKey' in data
    assert 'backupCodes' in data
    assert data['qrCode'].startswith('data:image/png;base64,')
    assert len(data['manualEntryKey']) == 32
    assert len(data['backupCodes']) == 10

def test_2fa_enable_endpoint(client, auth_headers):
    """Test 2FA enable endpoint"""
    # First setup 2FA
    setup_response = client.post('/api/auth/2fa/setup', headers=auth_headers)
    setup_data = setup_response.get_json()
    
    secret = setup_data['manualEntryKey']
    backup_codes = setup_data['backupCodes']
    
    # Generate valid TOTP code
    totp = pyotp.TOTP(secret)
    verification_code = totp.now()
    
    # Enable 2FA
    response = client.post('/api/auth/2fa/enable', 
                          headers=auth_headers,
                          json={
                              'secret': secret,
                              'verificationCode': verification_code,
                              'backupCodes': backup_codes
                          })
    
    assert response.status_code == 200
    data = response.get_json()
    assert 'message' in data
    assert 'backupCodes' in data

def test_2fa_enable_invalid_code(client, auth_headers):
    """Test 2FA enable with invalid code"""
    # First setup 2FA
    setup_response = client.post('/api/auth/2fa/setup', headers=auth_headers)
    setup_data = setup_response.get_json()
    
    secret = setup_data['manualEntryKey']
    backup_codes = setup_data['backupCodes']
    
    # Try to enable with invalid code
    response = client.post('/api/auth/2fa/enable', 
                          headers=auth_headers,
                          json={
                              'secret': secret,
                              'verificationCode': '000000',
                              'backupCodes': backup_codes
                          })
    
    assert response.status_code == 400
    data = response.get_json()
    assert 'error' in data

def test_2fa_login_flow(client, test_user):
    """Test complete 2FA login flow"""
    # Enable 2FA for test user first
    login_response = client.post('/api/auth/login', json={
        'username': test_user['username'],
        'password': 'testpass123'
    })
    
    tokens = login_response.get_json()['tokens']
    auth_headers = {'Authorization': f"Bearer {tokens['accessToken']}"}
    
    # Setup 2FA
    setup_response = client.post('/api/auth/2fa/setup', headers=auth_headers)
    setup_data = setup_response.get_json()
    
    secret = setup_data['manualEntryKey']
    backup_codes = setup_data['backupCodes']
    
    # Enable 2FA
    totp = pyotp.TOTP(secret)
    verification_code = totp.now()
    
    client.post('/api/auth/2fa/enable', 
                headers=auth_headers,
                json={
                    'secret': secret,
                    'verificationCode': verification_code,
                    'backupCodes': backup_codes
                })
    
    # Logout
    client.post('/api/auth/logout', headers=auth_headers)
    
    # Try to login - should require 2FA
    login_response = client.post('/api/auth/login', json={
        'username': test_user['username'],
        'password': 'testpass123'
    })
    
    assert login_response.status_code == 200
    login_data = login_response.get_json()
    assert login_data['requiresTwoFactor'] == True
    assert 'sessionId' in login_data
    
    # Complete 2FA verification
    session_id = login_data['sessionId']
    totp_code = totp.now()
    
    verify_response = client.post('/api/auth/2fa/verify', json={
        'sessionId': session_id,
        'totpCode': totp_code
    })
    
    assert verify_response.status_code == 200
    verify_data = verify_response.get_json()
    assert 'user' in verify_data
    assert 'tokens' in verify_data

def test_2fa_backup_code_login(client, test_user):
    """Test login with backup code"""
    # Enable 2FA for test user first (similar to previous test)
    login_response = client.post('/api/auth/login', json={
        'username': test_user['username'],
        'password': 'testpass123'
    })
    
    tokens = login_response.get_json()['tokens']
    auth_headers = {'Authorization': f"Bearer {tokens['accessToken']}"}
    
    setup_response = client.post('/api/auth/2fa/setup', headers=auth_headers)
    setup_data = setup_response.get_json()
    
    secret = setup_data['manualEntryKey']
    backup_codes = setup_data['backupCodes']
    
    totp = pyotp.TOTP(secret)
    verification_code = totp.now()
    
    client.post('/api/auth/2fa/enable', 
                headers=auth_headers,
                json={
                    'secret': secret,
                    'verificationCode': verification_code,
                    'backupCodes': backup_codes
                })
    
    client.post('/api/auth/logout', headers=auth_headers)
    
    # Login and get session
    login_response = client.post('/api/auth/login', json={
        'username': test_user['username'],
        'password': 'testpass123'
    })
    
    session_id = login_response.get_json()['sessionId']
    backup_code = backup_codes[0]
    
    # Use backup code for recovery
    recovery_response = client.post('/api/auth/2fa/recovery', json={
        'sessionId': session_id,
        'backupCode': backup_code
    })
    
    assert recovery_response.status_code == 200
    recovery_data = recovery_response.get_json()
    assert 'user' in recovery_data
    assert 'tokens' in recovery_data

def test_2fa_disable(client, test_user):
    """Test disabling 2FA"""
    # Enable 2FA first (similar setup as previous tests)
    login_response = client.post('/api/auth/login', json={
        'username': test_user['username'],
        'password': 'testpass123'
    })
    
    tokens = login_response.get_json()['tokens']
    auth_headers = {'Authorization': f"Bearer {tokens['accessToken']}"}
    
    setup_response = client.post('/api/auth/2fa/setup', headers=auth_headers)
    setup_data = setup_response.get_json()
    
    secret = setup_data['manualEntryKey']
    backup_codes = setup_data['backupCodes']
    
    totp = pyotp.TOTP(secret)
    verification_code = totp.now()
    
    client.post('/api/auth/2fa/enable', 
                headers=auth_headers,
                json={
                    'secret': secret,
                    'verificationCode': verification_code,
                    'backupCodes': backup_codes
                })
    
    # Disable 2FA
    disable_response = client.post('/api/auth/2fa/disable', 
                                  headers=auth_headers,
                                  json={'password': 'testpass123'})
    
    assert disable_response.status_code == 200
    
    # Check status
    status_response = client.get('/api/auth/2fa/status', headers=auth_headers)
    status_data = status_response.get_json()
    assert status_data['enabled'] == False

def test_2fa_regenerate_backup_codes(client, test_user):
    """Test regenerating backup codes"""
    # Enable 2FA first
    login_response = client.post('/api/auth/login', json={
        'username': test_user['username'],
        'password': 'testpass123'
    })
    
    tokens = login_response.get_json()['tokens']
    auth_headers = {'Authorization': f"Bearer {tokens['accessToken']}"}
    
    setup_response = client.post('/api/auth/2fa/setup', headers=auth_headers)
    setup_data = setup_response.get_json()
    
    secret = setup_data['manualEntryKey']
    backup_codes = setup_data['backupCodes']
    
    totp = pyotp.TOTP(secret)
    verification_code = totp.now()
    
    client.post('/api/auth/2fa/enable', 
                headers=auth_headers,
                json={
                    'secret': secret,
                    'verificationCode': verification_code,
                    'backupCodes': backup_codes
                })
    
    # Regenerate backup codes
    regenerate_response = client.post('/api/auth/2fa/backup-codes', headers=auth_headers)
    
    assert regenerate_response.status_code == 200
    regenerate_data = regenerate_response.get_json()
    assert 'backupCodes' in regenerate_data
    assert len(regenerate_data['backupCodes']) == 10
    
    # New codes should be different from original
    new_codes = regenerate_data['backupCodes']
    assert set(new_codes) != set(backup_codes)

def test_2fa_rate_limiting(client, test_user):
    """Test rate limiting on 2FA verification"""
    # Setup 2FA and get session
    login_response = client.post('/api/auth/login', json={
        'username': test_user['username'],
        'password': 'testpass123'
    })
    
    tokens = login_response.get_json()['tokens']
    auth_headers = {'Authorization': f"Bearer {tokens['accessToken']}"}
    
    setup_response = client.post('/api/auth/2fa/setup', headers=auth_headers)
    setup_data = setup_response.get_json()
    
    secret = setup_data['manualEntryKey']
    backup_codes = setup_data['backupCodes']
    
    totp = pyotp.TOTP(secret)
    verification_code = totp.now()
    
    client.post('/api/auth/2fa/enable', 
                headers=auth_headers,
                json={
                    'secret': secret,
                    'verificationCode': verification_code,
                    'backupCodes': backup_codes
                })
    
    client.post('/api/auth/logout', headers=auth_headers)
    
    # Get session for login
    login_response = client.post('/api/auth/login', json={
        'username': test_user['username'],
        'password': 'testpass123'
    })
    
    session_id = login_response.get_json()['sessionId']
    
    # Make multiple failed attempts
    for _ in range(6):
        client.post('/api/auth/2fa/verify', json={
            'sessionId': session_id,
            'totpCode': '000000'
        })
    
    # Next attempt should be rate limited
    response = client.post('/api/auth/2fa/verify', json={
        'sessionId': session_id,
        'totpCode': '000000'
    })
    
    assert response.status_code == 429

def test_2fa_status_endpoint(client, auth_headers):
    """Test 2FA status endpoint"""
    # Initially should be disabled
    response = client.get('/api/auth/2fa/status', headers=auth_headers)
    
    assert response.status_code == 200
    data = response.get_json()
    assert data['enabled'] == False
    assert data['backupCodes']['total'] == 0

def test_2fa_without_authentication(client):
    """Test 2FA endpoints without authentication"""
    endpoints = [
        '/api/auth/2fa/setup',
        '/api/auth/2fa/enable',
        '/api/auth/2fa/disable',
        '/api/auth/2fa/backup-codes',
        '/api/auth/2fa/status'
    ]
    
    for endpoint in endpoints:
        response = client.post(endpoint) if endpoint != '/api/auth/2fa/status' else client.get(endpoint)
        assert response.status_code == 401

def test_session_expiry(client, test_user):
    """Test that 2FA sessions expire"""
    # Get login session
    login_response = client.post('/api/auth/login', json={
        'username': test_user['username'],
        'password': 'testpass123'
    })
    
    # Mock expired session by trying to verify with old session
    with patch('src.services.auth_service.PENDING_2FA', {
        'expired_session': {
            'user_id': 1,
            'username': 'testuser',
            'expires_at': datetime.utcnow() - timedelta(minutes=10)
        }
    }):
        response = client.post('/api/auth/2fa/verify', json={
            'sessionId': 'expired_session',
            'totpCode': '123456'
        })
        
        assert response.status_code == 401
        data = response.get_json()
        assert 'expired' in data['error'].lower()

# Fixtures for testing
@pytest.fixture
def client():
    """Create test client"""
    from src.index import create_app
    app = create_app()
    app.config['TESTING'] = True
    
    with app.test_client() as client:
        yield client

@pytest.fixture
def test_user():
    """Create test user"""
    return {
        'username': 'testuser',
        'email': 'test@example.com',
        'password': 'testpass123'
    }

@pytest.fixture
def auth_headers(client, test_user):
    """Get auth headers for test user"""
    # Register and login test user
    client.post('/api/auth/register', json={
        'username': test_user['username'],
        'email': test_user['email'],
        'password': test_user['password'],
        'confirmPassword': test_user['password']
    })
    
    login_response = client.post('/api/auth/login', json={
        'username': test_user['username'],
        'password': test_user['password']
    })
    
    tokens = login_response.get_json()['tokens']
    return {'Authorization': f"Bearer {tokens['accessToken']}"}

if __name__ == '__main__':
    pytest.main([__file__])