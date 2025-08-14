# Two-Factor Authentication (2FA) Implementation

This document describes the complete Two-Factor Authentication system implemented for the YouTube Outlier Discovery Tool.

## Overview

The 2FA system provides an additional layer of security using Time-based One-Time Passwords (TOTP) compatible with popular authenticator apps like Google Authenticator, Authy, and Microsoft Authenticator.

## Features

### ✅ TOTP Implementation
- **Standard Compliance**: RFC 6238 compliant TOTP implementation
- **QR Code Generation**: Automatic QR code generation for easy setup
- **Manual Entry**: Manual key entry support for environments where QR codes can't be scanned
- **Time Window**: 30-second time windows with 1-window tolerance for clock drift

### ✅ Backup Codes
- **Recovery Codes**: 10 single-use backup codes for account recovery
- **Secure Generation**: Cryptographically secure 8-character alphanumeric codes
- **Usage Tracking**: Tracks which backup codes have been used
- **Regeneration**: Ability to generate new backup codes (invalidates old ones)

### ✅ Security Features
- **Encrypted Storage**: All 2FA secrets and backup codes encrypted at rest
- **Rate Limiting**: Protection against brute force attacks (5 attempts per 15 minutes)
- **Account Lockout**: Temporary lockout after 5 failed login attempts
- **Session Management**: Secure temporary sessions for 2FA verification flow
- **Audit Logging**: Comprehensive logging of all 2FA events

### ✅ User Experience
- **Progressive Setup**: Step-by-step 2FA setup process
- **Backup Code Management**: Easy backup code regeneration and download
- **Recovery Flow**: Clear recovery process using backup codes
- **Status Management**: Easy enable/disable with password confirmation

## Architecture

### Backend Components

#### 1. TwoFactorService (`src/services/two_factor_service.py`)
Core service handling all 2FA operations:
- Secret generation and encryption
- QR code generation
- TOTP verification
- Backup code management
- Rate limiting

#### 2. Authentication Integration (`src/services/auth_service.py`)
Enhanced authentication service with 2FA support:
- 2FA-aware login flow
- Session management for pending 2FA verification
- Token generation with 2FA verification status

#### 3. API Endpoints (`src/routes/two_factor.py`)
RESTful API endpoints:
- `POST /api/auth/2fa/setup` - Initialize 2FA setup
- `POST /api/auth/2fa/enable` - Enable 2FA after verification
- `POST /api/auth/2fa/verify` - Verify TOTP code during login
- `POST /api/auth/2fa/recovery` - Login using backup code
- `POST /api/auth/2fa/disable` - Disable 2FA with password
- `POST /api/auth/2fa/backup-codes` - Regenerate backup codes
- `GET /api/auth/2fa/status` - Get 2FA status

#### 4. Security Middleware (`src/middleware/auth.py`)
Enhanced authentication middleware:
- 2FA verification status checking
- Account lockout protection
- JWT token validation with 2FA claims

#### 5. Database Schema (`migrations/002_add_2fa_fields.py`)
Database fields for 2FA support:
```sql
-- 2FA Configuration
two_factor_enabled BOOLEAN DEFAULT FALSE
two_factor_secret TEXT NULL -- Encrypted TOTP secret
backup_codes TEXT NULL -- Encrypted backup codes
two_factor_backup_codes_used JSONB DEFAULT '[]'

-- Security Features
failed_login_attempts INTEGER DEFAULT 0
locked_until TIMESTAMP NULL
password_reset_token TEXT NULL
password_reset_expires TIMESTAMP NULL
last_login TIMESTAMP NULL
```

### Frontend Components

#### 1. TwoFactorSetup (`client/components/auth/TwoFactorSetup.tsx`)
Complete 2FA setup wizard:
- QR code display
- Manual key entry option
- TOTP verification
- Backup codes display and download

#### 2. TwoFactorVerification (`client/components/auth/TwoFactorVerification.tsx`)
2FA verification during login:
- TOTP code input
- Backup code recovery option
- Rate limiting handling
- Session management

#### 3. TwoFactorManagement (`client/components/auth/TwoFactorManagement.tsx`)
2FA management interface:
- Current status display
- Enable/disable functionality
- Backup code regeneration
- Security settings

#### 4. Enhanced LoginForm (`client/components/auth/LoginForm.tsx`)
Updated login flow:
- 2FA detection
- Seamless transition to 2FA verification
- Session handling

## Security Considerations

### Encryption at Rest
- **Algorithm**: AES-256 via Fernet (cryptography library)
- **Key Management**: Environment variable `TWO_FACTOR_ENCRYPTION_KEY`
- **Data Encrypted**: TOTP secrets, backup codes
- **Key Rotation**: Supported via migration scripts

### Rate Limiting
- **TOTP Verification**: 10 attempts per minute per endpoint
- **Setup/Management**: 5 attempts per minute for setup operations
- **Account Lockout**: 5 failed login attempts = 30-minute lockout
- **2FA Attempts**: 5 failed 2FA attempts = 15-minute cooldown

### Session Security
- **Temporary Sessions**: 5-minute expiry for 2FA verification
- **Encrypted Storage**: Session data encrypted in memory
- **Automatic Cleanup**: Expired sessions automatically removed
- **Token Invalidation**: All sessions invalidated when 2FA status changes

### Backup Code Security
- **Single Use**: Each backup code can only be used once
- **Secure Generation**: Cryptographically secure random generation
- **Usage Tracking**: Tracks which codes have been used
- **Regeneration**: Old codes invalidated when new ones generated

## API Reference

### Setup 2FA
```http
POST /api/auth/2fa/setup
Authorization: Bearer <access_token>

Response:
{
  "qrCode": "data:image/png;base64,iVBOR...",
  "manualEntryKey": "JBSWY3DPEHPK3PXP",
  "backupCodes": ["ABCD1234", "EFGH5678", ...],
  "message": "Scan the QR code with your authenticator app"
}
```

### Enable 2FA
```http
POST /api/auth/2fa/enable
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "secret": "JBSWY3DPEHPK3PXP",
  "verificationCode": "123456",
  "backupCodes": ["ABCD1234", "EFGH5678", ...]
}

Response:
{
  "message": "Two-factor authentication enabled successfully",
  "backupCodes": ["ABCD1234", "EFGH5678", ...]
}
```

### Login with 2FA
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password123"
}

Response (2FA Required):
{
  "requiresTwoFactor": true,
  "sessionId": "secure_session_id",
  "message": "Two-factor authentication required"
}
```

### Verify 2FA Code
```http
POST /api/auth/2fa/verify
Content-Type: application/json

{
  "sessionId": "secure_session_id",
  "totpCode": "123456"
}

Response:
{
  "user": { ... },
  "tokens": {
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token",
    "tokenType": "Bearer",
    "expiresIn": 3600
  }
}
```

### Recovery with Backup Code
```http
POST /api/auth/2fa/recovery
Content-Type: application/json

{
  "sessionId": "secure_session_id",
  "backupCode": "ABCD1234"
}

Response:
{
  "user": { ... },
  "tokens": { ... },
  "message": "Login successful using backup code"
}
```

## Installation & Setup

### 1. Install Dependencies
```bash
pip install pyotp qrcode[pil] bcrypt cryptography Flask-Limiter
```

### 2. Environment Variables
```bash
# Required for production
TWO_FACTOR_ENCRYPTION_KEY=<32-byte-base64-key>
JWT_ACCESS_SECRET=<64-char-secret>
JWT_REFRESH_SECRET=<64-char-secret>

# Optional
REDIS_URL=redis://localhost:6379  # For rate limiting
```

### 3. Generate System Keys
```bash
cd server-python
python src/utils/crypto_utils.py generate-keys
```

### 4. Run Database Migration
```bash
cd server-python
python migrations/002_add_2fa_fields.py up
```

### 5. Register Routes
Add to your Flask app:
```python
from src.routes.two_factor import bp as two_factor_bp
app.register_blueprint(two_factor_bp)
```

## Testing

### Unit Tests
```bash
cd server-python
python -m pytest tests/test_two_factor.py -v
```

### Integration Tests
```bash
python -m pytest tests/test_two_factor.py::test_2fa_login_flow -v
```

### Manual Testing
1. Register a new user
2. Enable 2FA in profile settings
3. Logout and login again
4. Verify 2FA code from authenticator app
5. Test backup code recovery
6. Test rate limiting with invalid codes

## Monitoring & Maintenance

### Logging
2FA events are logged with the following categories:
- `2FA_ENABLED`: User enables 2FA
- `2FA_DISABLED`: User disables 2FA
- `2FA_VERIFIED`: Successful 2FA verification
- `2FA_FAILED`: Failed 2FA verification
- `BACKUP_CODE_USED`: Backup code used for recovery
- `BACKUP_CODES_REGENERATED`: New backup codes generated

### Metrics
Monitor these metrics:
- 2FA adoption rate
- Failed verification attempts
- Backup code usage
- Account lockout frequency

### Security Considerations
- Regularly rotate encryption keys
- Monitor for unusual 2FA patterns
- Review failed attempt logs
- Ensure backup code usage is legitimate

## Troubleshooting

### Common Issues

#### 1. Invalid TOTP Codes
- **Cause**: Clock synchronization issues
- **Solution**: Check time synchronization on server and client
- **Prevention**: Use time window tolerance (±30 seconds)

#### 2. Lost Authenticator Device
- **Solution**: Use backup codes for recovery
- **Prevention**: Encourage users to save backup codes securely

#### 3. Rate Limiting Triggered
- **Cause**: Too many failed attempts
- **Solution**: Wait for cooldown period or contact admin
- **Prevention**: Clear error messages and attempt counters

#### 4. Encryption Key Issues
- **Cause**: Missing or invalid TWO_FACTOR_ENCRYPTION_KEY
- **Solution**: Generate new key or restore from backup
- **Prevention**: Secure key storage and backup procedures

### Recovery Procedures

#### 1. User Lost Access
1. Verify user identity
2. Temporarily disable 2FA in database
3. User logs in and re-enables 2FA
4. Generate new backup codes

#### 2. System Key Rotation
1. Generate new encryption key
2. Decrypt all existing data with old key
3. Re-encrypt with new key
4. Update environment variable
5. Test system functionality

## Future Enhancements

### Planned Features
- [ ] Hardware Security Key (WebAuthn) support
- [ ] SMS backup option (with warnings about security)
- [ ] Email-based backup verification
- [ ] Admin tools for 2FA management
- [ ] Bulk 2FA enforcement policies
- [ ] Advanced rate limiting per user type

### Security Improvements
- [ ] Hardware Security Module (HSM) integration
- [ ] Advanced fraud detection
- [ ] Geographic login analysis
- [ ] Device fingerprinting
- [ ] Adaptive authentication

## Compliance

This 2FA implementation follows industry best practices:
- **NIST SP 800-63B**: Multi-factor authentication guidelines
- **OWASP ASVS**: Application Security Verification Standard
- **RFC 6238**: TOTP algorithm specification
- **GDPR**: Privacy considerations for authentication data

## Support

For questions or issues:
1. Check this documentation
2. Review test cases for examples
3. Check application logs
4. Create issue with detailed reproduction steps