# Security Setup Guide

This guide walks you through setting up the secure authentication and authorization system for the YouTube Outlier Discovery platform.

## 🔐 Authentication & Authorization System Overview

The implementation includes:
- **JWT-based authentication** with access and refresh tokens
- **Role-based access control (RBAC)** with user/admin roles
- **Per-user API key management** with scoped permissions
- **Secure password hashing** using bcrypt with 12+ rounds
- **httpOnly cookies** for refresh token storage
- **Protected routes** with authentication middleware
- **Complete UI components** for login/register/profile management

## 🚀 Quick Setup

1. **Copy environment configuration:**
   ```bash
   cp .env.example .env
   ```

2. **Generate secure JWT secrets:**
   ```bash
   # Generate access token secret
   node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
   
   # Generate refresh token secret
   node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
   ```

3. **Update your .env file** with the generated secrets and configure other settings

4. **Install dependencies:**
   ```bash
   # Server dependencies
   cd server && bun install
   
   # Client dependencies
   cd ../client && bun install
   ```

5. **Start the application:**
   ```bash
   # From root directory
   bun run dev
   ```

## 🔧 Environment Configuration

### Critical Security Settings

```env
# JWT Secrets (MUST be changed for production)
JWT_ACCESS_SECRET=your-generated-64-char-secret
JWT_REFRESH_SECRET=your-different-64-char-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Password Security
BCRYPT_ROUNDS=12

# Default Admin (Change immediately in production)
DEFAULT_ADMIN_EMAIL=admin@outlier.com
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=Admin123!@#
```

### Production Recommendations

```env
# Production settings
NODE_ENV=production
HTTPS_REDIRECT=true
ENABLE_SECURITY_HEADERS=true
CORS_ORIGIN=https://yourdomain.com

# Rate limiting
API_RATE_LIMIT=100
API_RATE_WINDOW=900000

# Database (recommended: PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis for session management
REDIS_URL=redis://localhost:6379
```

## 📋 Security Features

### 1. JWT Authentication
- **Access tokens**: Short-lived (15 minutes), stored in memory
- **Refresh tokens**: Long-lived (7 days), stored in httpOnly cookies
- **Automatic token refresh**: Seamless user experience
- **Token validation**: Issuer, audience, and expiration checks

### 2. Password Security
- **Bcrypt hashing**: Minimum 12 rounds (configurable)
- **Strong password policy**: 8+ chars, uppercase, lowercase, numbers, special chars
- **Password validation**: Client and server-side validation
- **Secure password change**: Requires current password verification

### 3. Role-Based Access Control (RBAC)
- **User role**: Access to personal analyses and API keys
- **Admin role**: Full system access, user management
- **Permission system**: Granular resource-based permissions
- **Ownership checks**: Users can only access their own resources

### 4. API Key Management
- **Per-user API keys**: Up to 10 keys per user (configurable)
- **Scoped permissions**: read, write, admin scopes
- **Rate limiting**: Per-key rate limits
- **Key rotation**: Regenerate keys without losing access
- **Usage tracking**: Monitor API key usage statistics

### 5. Protected Routes
- **Authentication middleware**: Validates JWT tokens and API keys
- **Authorization middleware**: Checks user permissions and roles
- **Ownership validation**: Ensures users access only their resources
- **Business rule enforcement**: Additional security constraints

## 🛡️ Security Best Practices

### Development
1. **Never commit secrets** to version control
2. **Use strong, unique secrets** for JWT tokens
3. **Test authentication flows** thoroughly
4. **Validate all user inputs** on both client and server

### Production
1. **Use HTTPS only** for all traffic
2. **Set secure headers** (HSTS, CSP, etc.)
3. **Monitor authentication logs** for suspicious activity
4. **Regularly rotate secrets** and API keys
5. **Use a proper database** (PostgreSQL recommended)
6. **Implement rate limiting** and DDoS protection
7. **Set up monitoring and alerting**

## 🔑 User Management

### Default Admin Account
- **Username**: admin
- **Email**: admin@outlier.com
- **Password**: Admin123!@# (CHANGE IMMEDIATELY)

### Creating Users
Users can register through the `/register` page or admins can create accounts programmatically.

### User Roles
- **user**: Can create analyses, manage own API keys, view own data
- **admin**: All user permissions plus user management, system administration

## 🔐 API Authentication

### Using JWT Tokens
```javascript
// Include in Authorization header
headers: {
  'Authorization': 'Bearer <access_token>'
}
```

### Using API Keys
```javascript
// Include in X-API-Key header
headers: {
  'X-API-Key': 'ak_xxxxxxxxxxxxxxxx.yyyyyyyy...'
}

// Or in Authorization header
headers: {
  'Authorization': 'ApiKey ak_xxxxxxxxxxxxxxxx.yyyyyyyy...'
}
```

## 📊 Monitoring and Logging

### Authentication Events
All authentication events are logged including:
- Login attempts (successful/failed)
- Token refresh operations
- API key usage
- Password changes
- Admin actions

### Security Monitoring
Monitor for:
- Failed login attempts
- Unusual API usage patterns
- Permission violations
- Token validation failures

## 🚨 Incident Response

### Compromised Account
1. Immediately deactivate the user account
2. Revoke all refresh tokens
3. Disable all API keys
4. Review access logs
5. Reset user password

### Compromised API Key
1. Immediately revoke the API key
2. Review usage logs
3. Generate new key if needed
4. Notify user if suspicious activity

### Security Breach
1. Rotate all JWT secrets
2. Force logout all users
3. Review all access logs
4. Update security measures

## 🔄 Updates and Maintenance

### Regular Tasks
1. **Review user accounts** and remove inactive ones
2. **Monitor API key usage** and investigate anomalies
3. **Update dependencies** regularly
4. **Review and rotate secrets** periodically
5. **Backup user data** and test recovery procedures

### Security Audits
Perform regular security audits including:
- Penetration testing
- Code security reviews
- Dependency vulnerability scans
- Configuration reviews

## 📞 Support

For security-related issues or questions:
1. Check this documentation first
2. Review the codebase comments
3. Test in development environment
4. Contact the development team

Remember: **Security is everyone's responsibility!**