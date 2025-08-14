"""
Cryptographic utilities for secure 2FA implementation

This module provides utilities for:
- Generating secure encryption keys
- Encrypting/decrypting sensitive 2FA data
- Secure random token generation
- Password hashing with bcrypt

Security considerations:
- Uses Fernet (AES 128 in CBC mode with HMAC for authentication)
- Keys are base64 encoded for easy storage
- All sensitive operations use cryptographically secure random generation
- Constant-time comparison for sensitive operations
"""

import os
import base64
import secrets
import hashlib
import hmac
from typing import Optional, List
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import bcrypt


class CryptoUtils:
    """Utility class for cryptographic operations"""
    
    @staticmethod
    def generate_encryption_key() -> str:
        """
        Generate a new Fernet encryption key
        
        Returns:
            Base64 encoded encryption key
        """
        return base64.urlsafe_b64encode(os.urandom(32)).decode()
    
    @staticmethod
    def derive_key_from_password(password: str, salt: bytes) -> bytes:
        """
        Derive encryption key from password using PBKDF2
        
        Args:
            password: The password to derive from
            salt: Random salt bytes
            
        Returns:
            Derived key bytes
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,  # OWASP recommended minimum
        )
        return kdf.derive(password.encode())
    
    @staticmethod
    def encrypt_data(data: str, key: str) -> str:
        """
        Encrypt data using Fernet symmetric encryption
        
        Args:
            data: The data to encrypt
            key: Base64 encoded encryption key
            
        Returns:
            Encrypted data as base64 string
        """
        f = Fernet(key.encode())
        encrypted = f.encrypt(data.encode())
        return base64.urlsafe_b64encode(encrypted).decode()
    
    @staticmethod
    def decrypt_data(encrypted_data: str, key: str) -> str:
        """
        Decrypt data using Fernet symmetric encryption
        
        Args:
            encrypted_data: Base64 encoded encrypted data
            key: Base64 encoded encryption key
            
        Returns:
            Decrypted data as string
        """
        f = Fernet(key.encode())
        encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode())
        decrypted = f.decrypt(encrypted_bytes)
        return decrypted.decode()
    
    @staticmethod
    def hash_password(password: str, rounds: int = 12) -> str:
        """
        Hash password using bcrypt
        
        Args:
            password: The password to hash
            rounds: Number of bcrypt rounds (default 12)
            
        Returns:
            Hashed password as string
        """
        salt = bcrypt.gensalt(rounds=rounds)
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')
    
    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        """
        Verify password against bcrypt hash
        
        Args:
            password: The password to verify
            hashed: The bcrypt hash to verify against
            
        Returns:
            True if password matches, False otherwise
        """
        try:
            return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
        except (ValueError, TypeError):
            return False
    
    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """
        Generate cryptographically secure random token
        
        Args:
            length: Length of token in bytes
            
        Returns:
            URL-safe base64 encoded token
        """
        return secrets.token_urlsafe(length)
    
    @staticmethod
    def generate_backup_codes(count: int = 10, length: int = 8) -> List[str]:
        """
        Generate secure backup codes
        
        Args:
            count: Number of codes to generate
            length: Length of each code
            
        Returns:
            List of backup codes
        """
        codes = []
        for _ in range(count):
            # Generate code with mix of letters and numbers
            code = ''.join(secrets.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') 
                          for _ in range(length))
            codes.append(code)
        return codes
    
    @staticmethod
    def constant_time_compare(a: str, b: str) -> bool:
        """
        Compare two strings in constant time to prevent timing attacks
        
        Args:
            a: First string
            b: Second string
            
        Returns:
            True if strings are equal, False otherwise
        """
        return hmac.compare_digest(a.encode(), b.encode())
    
    @staticmethod
    def generate_csrf_token() -> str:
        """
        Generate CSRF token
        
        Returns:
            CSRF token as hex string
        """
        return secrets.token_hex(32)
    
    @staticmethod
    def validate_encryption_key(key: str) -> bool:
        """
        Validate that a key is a valid Fernet key
        
        Args:
            key: The key to validate
            
        Returns:
            True if valid, False otherwise
        """
        try:
            Fernet(key.encode())
            return True
        except Exception:
            return False


class SecureSessionManager:
    """Manage secure temporary sessions for 2FA"""
    
    def __init__(self, encryption_key: str):
        self.cipher = Fernet(encryption_key.encode())
        self.sessions = {}
    
    def create_session(self, user_id: int, data: dict, expires_in_minutes: int = 5) -> str:
        """
        Create a secure temporary session
        
        Args:
            user_id: User ID
            data: Session data to store
            expires_in_minutes: Session expiry time
            
        Returns:
            Session ID
        """
        import json
        from datetime import datetime, timedelta
        
        session_id = secrets.token_urlsafe(32)
        session_data = {
            'user_id': user_id,
            'data': data,
            'expires_at': (datetime.utcnow() + timedelta(minutes=expires_in_minutes)).isoformat(),
            'created_at': datetime.utcnow().isoformat()
        }
        
        # Encrypt session data
        encrypted_data = self.cipher.encrypt(json.dumps(session_data).encode())
        self.sessions[session_id] = encrypted_data
        
        return session_id
    
    def get_session(self, session_id: str) -> Optional[dict]:
        """
        Retrieve and validate session
        
        Args:
            session_id: Session ID
            
        Returns:
            Session data if valid, None otherwise
        """
        import json
        from datetime import datetime
        
        if session_id not in self.sessions:
            return None
        
        try:
            # Decrypt session data
            encrypted_data = self.sessions[session_id]
            decrypted_data = self.cipher.decrypt(encrypted_data)
            session_data = json.loads(decrypted_data.decode())
            
            # Check expiry
            expires_at = datetime.fromisoformat(session_data['expires_at'])
            if datetime.utcnow() > expires_at:
                del self.sessions[session_id]
                return None
            
            return session_data
        except Exception:
            # Invalid session data
            if session_id in self.sessions:
                del self.sessions[session_id]
            return None
    
    def destroy_session(self, session_id: str) -> bool:
        """
        Destroy a session
        
        Args:
            session_id: Session ID
            
        Returns:
            True if session was destroyed, False if not found
        """
        if session_id in self.sessions:
            del self.sessions[session_id]
            return True
        return False
    
    def cleanup_expired_sessions(self):
        """Remove all expired sessions"""
        import json
        from datetime import datetime
        
        expired_sessions = []
        for session_id, encrypted_data in self.sessions.items():
            try:
                decrypted_data = self.cipher.decrypt(encrypted_data)
                session_data = json.loads(decrypted_data.decode())
                expires_at = datetime.fromisoformat(session_data['expires_at'])
                
                if datetime.utcnow() > expires_at:
                    expired_sessions.append(session_id)
            except Exception:
                expired_sessions.append(session_id)
        
        for session_id in expired_sessions:
            del self.sessions[session_id]


def setup_encryption_key() -> str:
    """
    Setup encryption key from environment or generate new one
    
    Returns:
        Encryption key
    """
    key = os.environ.get('TWO_FACTOR_ENCRYPTION_KEY')
    
    if not key:
        # Generate new key for development
        key = CryptoUtils.generate_encryption_key()
        print("⚠️  Generated new encryption key for development.")
        print("   Set TWO_FACTOR_ENCRYPTION_KEY environment variable in production:")
        print(f"   TWO_FACTOR_ENCRYPTION_KEY={key}")
    
    if not CryptoUtils.validate_encryption_key(key):
        raise ValueError("Invalid encryption key format")
    
    return key


def generate_system_keys():
    """Generate all required system keys"""
    keys = {
        'TWO_FACTOR_ENCRYPTION_KEY': CryptoUtils.generate_encryption_key(),
        'JWT_ACCESS_SECRET': CryptoUtils.generate_secure_token(64),
        'JWT_REFRESH_SECRET': CryptoUtils.generate_secure_token(64),
        'SESSION_SECRET': CryptoUtils.generate_secure_token(64),
    }
    
    print("Generated system keys for production:")
    print("=" * 50)
    for key_name, key_value in keys.items():
        print(f"{key_name}={key_value}")
    print("=" * 50)
    print("⚠️  Store these keys securely and set them as environment variables")
    print("⚠️  Never commit these keys to version control")
    
    return keys


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == 'generate-keys':
            generate_system_keys()
        elif command == 'test-encryption':
            # Test encryption/decryption
            key = CryptoUtils.generate_encryption_key()
            test_data = "This is a test message for encryption"
            
            encrypted = CryptoUtils.encrypt_data(test_data, key)
            decrypted = CryptoUtils.decrypt_data(encrypted, key)
            
            print(f"Original: {test_data}")
            print(f"Encrypted: {encrypted}")
            print(f"Decrypted: {decrypted}")
            print(f"Match: {test_data == decrypted}")
        elif command == 'test-password':
            # Test password hashing
            password = "test_password_123"
            hashed = CryptoUtils.hash_password(password)
            valid = CryptoUtils.verify_password(password, hashed)
            invalid = CryptoUtils.verify_password("wrong_password", hashed)
            
            print(f"Password: {password}")
            print(f"Hashed: {hashed}")
            print(f"Valid verification: {valid}")
            print(f"Invalid verification: {invalid}")
        else:
            print("Usage: python crypto_utils.py [generate-keys|test-encryption|test-password]")
    else:
        print("Crypto utilities for 2FA implementation")
        print("Run with 'generate-keys' to generate production keys")