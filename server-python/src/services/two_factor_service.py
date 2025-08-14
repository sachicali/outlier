import pyotp
import qrcode
import io
import base64
import secrets
import json
from datetime import datetime, timedelta
from cryptography.fernet import Fernet
from flask import current_app
from utils.logger import logger
import os


class TwoFactorService:
    def __init__(self):
        # Initialize encryption key for 2FA secrets
        # In production, this should be stored securely and consistent across instances
        self.encryption_key = os.environ.get('TWO_FACTOR_ENCRYPTION_KEY')
        if not self.encryption_key:
            # Generate a key for development (not recommended for production)
            self.encryption_key = base64.urlsafe_b64encode(os.urandom(32)).decode()
            logger.warning("Using generated encryption key. Set TWO_FACTOR_ENCRYPTION_KEY in production.")
        
        self.cipher_suite = Fernet(self.encryption_key.encode())
        
        # Rate limiting storage (in production, use Redis)
        self.rate_limit_storage = {}
    
    def generate_secret(self):
        """Generate a new TOTP secret"""
        return pyotp.random_base32()
    
    def encrypt_secret(self, secret):
        """Encrypt the TOTP secret for database storage"""
        return self.cipher_suite.encrypt(secret.encode()).decode()
    
    def decrypt_secret(self, encrypted_secret):
        """Decrypt the TOTP secret from database"""
        return self.cipher_suite.decrypt(encrypted_secret.encode()).decode()
    
    def generate_qr_code(self, user, secret, issuer_name="YouTube Outlier Discovery"):
        """Generate QR code for TOTP setup"""
        # Create TOTP URL
        totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=user.email,
            issuer_name=issuer_name
        )
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(totp_uri)
        qr.make(fit=True)
        
        # Create QR code image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64 string
        img_buffer = io.BytesIO()
        img.save(img_buffer, format='PNG')
        img_str = base64.b64encode(img_buffer.getvalue()).decode()
        
        return f"data:image/png;base64,{img_str}"
    
    def verify_totp_code(self, secret, code, window=1):
        """Verify TOTP code with time window tolerance"""
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=window)
    
    def generate_backup_codes(self, count=10):
        """Generate secure backup codes"""
        codes = []
        for _ in range(count):
            # Generate 8-character alphanumeric codes
            code = secrets.token_urlsafe(6)[:8].upper().replace('_', '0').replace('-', '1')
            codes.append(code)
        return codes
    
    def encrypt_backup_codes(self, codes):
        """Encrypt backup codes for database storage"""
        codes_json = json.dumps(codes)
        return self.cipher_suite.encrypt(codes_json.encode()).decode()
    
    def decrypt_backup_codes(self, encrypted_codes):
        """Decrypt backup codes from database"""
        if not encrypted_codes:
            return []
        decrypted_json = self.cipher_suite.decrypt(encrypted_codes.encode()).decode()
        return json.loads(decrypted_json)
    
    def setup_two_factor(self, user):
        """Initialize 2FA setup for a user"""
        try:
            # Generate new secret
            secret = self.generate_secret()
            
            # Generate QR code
            qr_code = self.generate_qr_code(user, secret)
            
            # Generate backup codes
            backup_codes = self.generate_backup_codes()
            
            # Don't save to database yet - only save after verification
            return {
                'secret': secret,  # Temporary, for verification only
                'qrCode': qr_code,
                'backupCodes': backup_codes,
                'manualEntryKey': secret
            }
        except Exception as e:
            logger.error(f"Error setting up 2FA for user {user.id}: {e}")
            raise Exception("Failed to setup two-factor authentication")
    
    def enable_two_factor(self, user, secret, verification_code, backup_codes):
        """Enable 2FA after successful verification"""
        try:
            # Verify the TOTP code
            if not self.verify_totp_code(secret, verification_code):
                raise ValueError("Invalid verification code")
            
            # Encrypt and save the secret and backup codes
            user.two_factor_secret = self.encrypt_secret(secret)
            user.backup_codes = self.encrypt_backup_codes(backup_codes)
            user.two_factor_enabled = True
            user.two_factor_backup_codes_used = []
            
            logger.info(f"2FA enabled for user {user.id} ({user.username})")
            return True
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error enabling 2FA for user {user.id}: {e}")
            raise Exception("Failed to enable two-factor authentication")
    
    def disable_two_factor(self, user, password):
        """Disable 2FA (requires password confirmation)"""
        try:
            # Verify password
            if not user.check_password(password):
                raise ValueError("Invalid password")
            
            # Clear 2FA settings
            user.two_factor_enabled = False
            user.two_factor_secret = None
            user.backup_codes = None
            user.two_factor_backup_codes_used = []
            
            logger.info(f"2FA disabled for user {user.id} ({user.username})")
            return True
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error disabling 2FA for user {user.id}: {e}")
            raise Exception("Failed to disable two-factor authentication")
    
    def verify_two_factor(self, user, code):
        """Verify 2FA code (TOTP or backup code)"""
        try:
            if not user.two_factor_enabled or not user.two_factor_secret:
                raise ValueError("Two-factor authentication is not enabled")
            
            # Check rate limiting
            if self.is_rate_limited(user.id):
                raise ValueError("Too many verification attempts. Please wait before trying again.")
            
            # Try TOTP first
            secret = self.decrypt_secret(user.two_factor_secret)
            if self.verify_totp_code(secret, code):
                self.reset_rate_limit(user.id)
                return True
            
            # Try backup codes
            backup_codes = self.decrypt_backup_codes(user.backup_codes)
            used_codes = user.two_factor_backup_codes_used or []
            
            if code in backup_codes and code not in used_codes:
                # Mark backup code as used
                if not user.two_factor_backup_codes_used:
                    user.two_factor_backup_codes_used = []
                user.two_factor_backup_codes_used.append(code)
                
                self.reset_rate_limit(user.id)
                logger.info(f"Backup code used for user {user.id} ({user.username})")
                return True
            
            # Invalid code - increment rate limit
            self.increment_rate_limit(user.id)
            return False
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error verifying 2FA for user {user.id}: {e}")
            raise Exception("Failed to verify two-factor authentication")
    
    def regenerate_backup_codes(self, user):
        """Generate new backup codes"""
        try:
            if not user.two_factor_enabled:
                raise ValueError("Two-factor authentication is not enabled")
            
            # Generate new backup codes
            new_codes = self.generate_backup_codes()
            
            # Encrypt and save
            user.backup_codes = self.encrypt_backup_codes(new_codes)
            user.two_factor_backup_codes_used = []  # Reset used codes
            
            logger.info(f"Backup codes regenerated for user {user.id} ({user.username})")
            return new_codes
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error regenerating backup codes for user {user.id}: {e}")
            raise Exception("Failed to regenerate backup codes")
    
    def is_rate_limited(self, user_id):
        """Check if user is rate limited for 2FA attempts"""
        key = f"2fa_attempts_{user_id}"
        if key not in self.rate_limit_storage:
            return False
        
        attempts, last_attempt = self.rate_limit_storage[key]
        
        # Reset if more than 15 minutes have passed
        if datetime.now() - last_attempt > timedelta(minutes=15):
            del self.rate_limit_storage[key]
            return False
        
        # Rate limit after 5 attempts in 15 minutes
        return attempts >= 5
    
    def increment_rate_limit(self, user_id):
        """Increment rate limit counter for failed 2FA attempts"""
        key = f"2fa_attempts_{user_id}"
        if key in self.rate_limit_storage:
            attempts, _ = self.rate_limit_storage[key]
            self.rate_limit_storage[key] = (attempts + 1, datetime.now())
        else:
            self.rate_limit_storage[key] = (1, datetime.now())
    
    def reset_rate_limit(self, user_id):
        """Reset rate limit counter on successful verification"""
        key = f"2fa_attempts_{user_id}"
        if key in self.rate_limit_storage:
            del self.rate_limit_storage[key]
    
    def get_backup_codes_status(self, user):
        """Get status of backup codes (how many unused)"""
        try:
            if not user.two_factor_enabled:
                return {'total': 0, 'used': 0, 'remaining': 0}
            
            backup_codes = self.decrypt_backup_codes(user.backup_codes)
            used_codes = user.two_factor_backup_codes_used or []
            
            return {
                'total': len(backup_codes),
                'used': len(used_codes),
                'remaining': len(backup_codes) - len(used_codes)
            }
        except Exception as e:
            logger.error(f"Error getting backup codes status for user {user.id}: {e}")
            return {'total': 0, 'used': 0, 'remaining': 0}