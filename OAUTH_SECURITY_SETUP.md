# OAuth Security Implementation Guide

## Overview

This document outlines the OAuth integration implementation for Google and GitHub authentication in the YouTube Outlier Discovery Tool. The implementation follows security best practices and integrates seamlessly with the existing JWT-based authentication system.

## Security Features Implemented

### 1. OAuth Provider Support
- **Google OAuth 2.0**: Full integration with Google's OAuth 2.0 service
- **GitHub OAuth**: Integration with GitHub's OAuth application system
- **Extensible Design**: Easy to add additional OAuth providers

### 2. Security Measures

#### Authentication Flow Security
- **State Parameter**: CSRF protection through OAuth state parameter (handled by passport.js)
- **Secure Redirects**: Validated redirect URLs to prevent open redirect attacks
- **Token Validation**: Proper validation of OAuth tokens and user data
- **Error Handling**: Secure error handling that doesn't leak sensitive information

#### Database Security
- **OAuth Data Storage**: Secure storage of OAuth provider data in JSONB format
- **Data Encryption**: Sensitive OAuth data is properly structured and validated
- **Index Optimization**: GIN indexes for efficient OAuth provider queries
- **Account Linking**: Secure linking/unlinking of OAuth accounts

#### Session Security
- **JWT Integration**: OAuth authentication generates standard JWT tokens
- **Refresh Token Management**: Proper refresh token handling for OAuth users
- **httpOnly Cookies**: Secure cookie handling for refresh tokens
- **CORS Protection**: Proper CORS configuration for OAuth callbacks

### 3. User Experience Security

#### Account Protection
- **Account Linking**: Secure linking of OAuth accounts to existing users
- **Duplicate Prevention**: Prevents duplicate accounts for same OAuth identity
- **Email Verification**: OAuth emails are considered pre-verified
- **Username Generation**: Secure username generation from OAuth data

#### Fallback Security
- **Multiple Auth Methods**: Users can have both password and OAuth authentication
- **Account Recovery**: Prevents users from locking themselves out
- **Minimum Auth Requirement**: Requires at least one authentication method

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# OAuth Configuration
BASE_URL=http://localhost:5000

# Google OAuth (get from https://console.developers.google.com/)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth (get from https://github.com/settings/applications/new)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### OAuth Provider Setup

#### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.developers.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Set authorized redirect URIs:
   - `http://localhost:5000/api/auth/google/callback` (development)
   - `https://yourdomain.com/api/auth/google/callback` (production)

#### GitHub OAuth Setup
1. Go to [GitHub Developer Settings](https://github.com/settings/applications/new)
2. Create a new OAuth App
3. Set Authorization callback URL:
   - `http://localhost:5000/api/auth/github/callback` (development)
   - `https://yourdomain.com/api/auth/github/callback` (production)

## Database Migration

Run the OAuth migration to add required fields:

```bash
bun run db:migrate
```

The migration adds:
- `oauth_providers` JSONB field for provider data
- `profile_picture_url` for OAuth profile pictures  
- `account_linked_at` timestamp
- GIN index for efficient OAuth queries

## API Endpoints

### Public OAuth Routes
- `GET /api/auth/oauth/config` - Get OAuth provider configuration
- `GET /api/auth/google` - Initiate Google OAuth flow
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/github` - Initiate GitHub OAuth flow
- `GET /api/auth/github/callback` - GitHub OAuth callback

### Protected OAuth Routes  
- `GET /api/auth/oauth/connections` - Get user's OAuth connections
- `DELETE /api/auth/oauth/:provider` - Unlink OAuth provider

## Frontend Integration

### Components Added
- `OAuthButtons.tsx` - OAuth login buttons component
- `OAuthConnections.tsx` - OAuth account management component
- `oauth-callback.tsx` - OAuth callback handler page

### Usage Example

```typescript
import OAuthButtons from './components/auth/OAuthButtons';

// In login/register forms
<OAuthButtons 
  isLoading={isSubmitting}
  disabled={isSubmitting}
  showDivider={true}
/>
```

## Security Considerations

### Production Deployment

1. **HTTPS Required**: OAuth must use HTTPS in production
2. **Secure Headers**: Ensure security headers are properly configured
3. **Rate Limiting**: OAuth endpoints are protected by rate limiting
4. **CORS Configuration**: Properly configure CORS for your domain
5. **Secret Management**: Store OAuth secrets securely (environment variables)

### OAuth Token Handling

1. **Token Storage**: OAuth tokens are not permanently stored client-side
2. **JWT Integration**: OAuth authentication generates standard JWT tokens
3. **Refresh Strategy**: Standard refresh token rotation applies
4. **Logout Handling**: OAuth logout clears all authentication data

### Error Handling

1. **No Information Leakage**: Error messages don't reveal sensitive information
2. **Graceful Degradation**: System works even if OAuth providers are unavailable
3. **User Feedback**: Clear error messages for users during OAuth flows
4. **Logging**: Comprehensive logging for debugging OAuth issues

## Testing OAuth Integration

### Development Testing
1. Set up OAuth applications with localhost callbacks
2. Test login, registration, and account linking flows
3. Verify error handling with invalid OAuth responses
4. Test account unlinking and security restrictions

### Security Testing
1. Test CSRF protection in OAuth flows
2. Verify proper redirect validation
3. Test account takeover prevention
4. Verify proper session handling

## Monitoring and Logging

OAuth events are logged with the following information:
- OAuth provider used
- Success/failure status
- User ID and email (for successful auth)
- IP address and user agent
- Error details (for failures)

## Compliance and Privacy

1. **OAuth Scopes**: Minimal scopes requested (profile, email only)
2. **Data Storage**: Only necessary OAuth data is stored
3. **User Control**: Users can unlink OAuth accounts at any time
4. **Privacy**: OAuth data handling complies with provider policies

## Troubleshooting

### Common Issues
1. **Invalid Redirect URI**: Check OAuth app configuration
2. **Scope Issues**: Verify requested scopes are approved
3. **CORS Errors**: Check CORS configuration for OAuth callbacks
4. **Token Errors**: Verify OAuth secrets are correctly configured

### Debug Information
OAuth errors are logged with correlation IDs for tracking. Check server logs for detailed error information.

---

This OAuth implementation provides secure, user-friendly authentication while maintaining the existing security standards of the application.