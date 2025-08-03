const { User, ApiKey } = require('../models');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('./emailService');

/**
 * Authentication service for user management and authentication
 * Implements secure password hashing, JWT tokens, and user operations
 */
class AuthService {
  constructor() {
    // In-memory storage for demo - replace with actual database
    this.users = new Map();
    this.apiKeys = new Map();
    this.refreshTokens = new Set();

    // Create default admin user for initial setup
    this.createDefaultAdmin();
  }

  /**
   * Create default admin user
   */
  async createDefaultAdmin() {
    const adminExists = Array.from(this.users.values()).some(user => user.role === 'admin');

    if (!adminExists) {
      const defaultAdmin = {
        email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@outlier.com',
        username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
        password: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123!@#',
        role: 'admin',
        isEmailVerified: true, // Admin is pre-verified
        emailVerifiedAt: new Date(),
      };

      try {
        await this.register(defaultAdmin);
        console.log('Default admin user created');
      } catch (error) {
        console.error('Failed to create default admin:', error.message);
      }
    }
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Created user and tokens
   */
  async register(userData) {
    const { email, username, password, role = 'user' } = userData;

    // Validate input
    if (!email || !username || !password) {
      throw new Error('Email, username, and password are required');
    }

    if (!User.validateEmail(email)) {
      throw new Error('Invalid email format');
    }

    const usernameValidation = User.validateUsername(username);
    if (!usernameValidation.isValid) {
      throw new Error(usernameValidation.errors.join(', '));
    }

    const passwordValidation = User.validatePassword(password);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.errors.join(', '));
    }

    // Check if user already exists
    const existingUser = Array.from(this.users.values()).find(
      user => user.email === email || user.username === username,
    );

    if (existingUser) {
      throw new Error('User with this email or username already exists');
    }

    // Hash password
    const passwordHash = await User.hashPassword(password);

    // Create user
    const user = new User({
      email,
      username,
      passwordHash,
      role,
      isEmailVerified: userData.isEmailVerified,
      emailVerifiedAt: userData.emailVerifiedAt,
    });

    // Store user
    this.users.set(user.id, user);

    // Send verification email if email service is available
    try {
      if (emailService.isAvailable()) {
        const tokenData = emailService.generateVerificationToken(email, 'email_verification');
        await emailService.sendVerificationEmail(email, username, tokenData.token);
      }
    } catch (error) {
      // Log error but don't fail registration
      console.error('Failed to send verification email:', error.message);
    }

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user);
    user.addRefreshToken(refreshToken);

    return {
      user: user.toSafeObject(),
      accessToken,
      refreshToken,
      requiresEmailVerification: !user.isEmailVerified,
    };
  }

  /**
   * Authenticate user login
   * @param {Object} credentials - Login credentials
   * @returns {Promise<Object>} User and tokens
   */
  async login(credentials) {
    const { identifier, password } = credentials; // identifier can be email or username

    if (!identifier || !password) {
      throw new Error('Identifier and password are required');
    }

    // Find user by email or username
    const user = Array.from(this.users.values()).find(
      user => user.email === identifier || user.username === identifier,
    );

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Check if email verification is required (but allow login)
    // Note: We allow login but will restrict certain features
    const requiresEmailVerification = user.requiresEmailVerification();

    // Verify password
    const isValidPassword = await User.verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Check if 2FA is enabled
    const requires2FA = user.twoFactorEnabled || (user.hasTwoFactorEnabled && user.hasTwoFactorEnabled());
    
    if (requires2FA) {
      // Don't generate full tokens yet, return partial login success
      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          two_factor_enabled: true,
        },
        requires2FA: true,
        requiresEmailVerification,
        message: 'Please provide your 2FA code to complete login',
      };
    }

    // Update last login
    user.updateLastLogin();

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user);
    user.addRefreshToken(refreshToken);

    return {
      user: user.toSafeObject(),
      accessToken,
      refreshToken,
      requiresEmailVerification,
      requires2FA: false,
    };
  }

  /**
   * Refresh access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New tokens
   */
  async refreshToken(refreshToken) {
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }

    // Find user
    const user = this.users.get(decoded.userId);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // Check if refresh token exists in user's tokens
    if (!user.hasValidRefreshToken(refreshToken)) {
      throw new Error('Invalid refresh token');
    }

    // Generate new tokens
    const tokens = this.generateTokens(user);

    // Remove old refresh token and add new one
    user.removeRefreshToken(refreshToken);
    user.addRefreshToken(tokens.refreshToken);

    return {
      user: user.toSafeObject(),
      ...tokens,
    };
  }

  /**
   * Logout user
   * @param {string} userId - User ID
   * @param {string} refreshToken - Refresh token to remove
   */
  async logout(userId, refreshToken) {
    const user = this.users.get(userId);
    if (user && refreshToken) {
      user.removeRefreshToken(refreshToken);
    }
  }

  /**
   * Logout user from all devices
   * @param {string} userId - User ID
   */
  async logoutAll(userId) {
    const user = this.users.get(userId);
    if (user) {
      user.clearRefreshTokens();
    }
  }

  /**
   * Generate JWT tokens
   * @param {User} user - User object
   * @returns {Object} Access and refresh tokens
   */
  generateTokens(user) {
    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(
      payload,
      process.env.JWT_ACCESS_SECRET,
      {
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        issuer: 'outlier-discovery',
        audience: 'outlier-api',
      },
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        issuer: 'outlier-discovery',
        audience: 'outlier-api',
      },
    );

    return { accessToken, refreshToken };
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} Decoded token payload
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {User|null} User object
   */
  getUserById(userId) {
    return this.users.get(userId);
  }

  /**
   * Get user by email
   * @param {string} email - User email
   * @returns {User|null} User object
   */
  getUserByEmail(email) {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updates - Profile updates
   * @returns {Promise<Object>} Updated user
   */
  async updateProfile(userId, updates) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const allowedUpdates = ['username', 'email'];
    const validUpdates = {};

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key) && value !== undefined) {
        validUpdates[key] = value;
      }
    }

    // Validate username if provided
    if (validUpdates.username) {
      const usernameValidation = User.validateUsername(validUpdates.username);
      if (!usernameValidation.isValid) {
        throw new Error(usernameValidation.errors.join(', '));
      }

      // Check if username is already taken
      const existingUser = Array.from(this.users.values()).find(
        u => u.id !== userId && u.username === validUpdates.username,
      );
      if (existingUser) {
        throw new Error('Username is already taken');
      }
    }

    // Handle email change separately (requires verification)
    if (validUpdates.email && validUpdates.email !== user.email) {
      if (!User.validateEmail(validUpdates.email)) {
        throw new Error('Invalid email format');
      }

      // Check if email is already taken
      const existingUser = Array.from(this.users.values()).find(
        u => u.id !== userId && u.email === validUpdates.email,
      );
      if (existingUser) {
        throw new Error('Email is already taken');
      }

      // Store pending email change and send verification
      await this.initiateEmailChange(userId, validUpdates.email);
      
      // Remove email from updates to apply immediately
      delete validUpdates.email;
    }

    // Apply other updates immediately
    Object.assign(user, validUpdates, { updatedAt: new Date() });

    return user.toSafeObject();
  }

  /**
   * Initiate email change process
   * @param {string} userId - User ID
   * @param {string} newEmail - New email address
   * @returns {Promise<void>}
   */
  async initiateEmailChange(userId, newEmail) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate verification token
    const emailService = require('./emailService');
    const token = await emailService.generateVerificationToken(newEmail, 'email_change');

    // Store pending email change
    user.pendingEmailChange = {
      newEmail,
      token,
      initiatedAt: new Date(),
    };

    // Send verification email to new address
    if (emailService.isAvailable()) {
      await emailService.sendEmailChangeVerification(newEmail, user.username, token);
    } else {
      throw new Error('Email service not available - cannot verify email change');
    }
  }

  /**
   * Confirm email change with verification token
   * @param {string} token - Verification token
   * @returns {Promise<Object>} Updated user
   */
  async confirmEmailChange(token) {
    const emailService = require('./emailService');
    
    // Verify token
    const tokenData = await emailService.verifyToken(token);
    if (!tokenData || tokenData.type !== 'email_change') {
      throw new Error('Invalid or expired email change token');
    }

    // Find user with pending email change
    const user = Array.from(this.users.values()).find(
      u => u.pendingEmailChange?.newEmail === tokenData.email
    );

    if (!user) {
      throw new Error('No pending email change found');
    }

    // Apply email change
    user.email = user.pendingEmailChange.newEmail;
    user.pendingEmailChange = null;
    user.updatedAt = new Date();

    // Mark token as used
    emailService.markTokenAsUsed(token);

    return user.toSafeObject();
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @param {Object} context - Security context (IP, userAgent, etc.)
   * @returns {Promise<void>}
   */
  async changePassword(userId, currentPassword, newPassword, context = {}) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await User.verifyPassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    const passwordValidation = User.validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.errors.join(', '));
    }

    // Hash new password
    user.passwordHash = await User.hashPassword(newPassword);
    user.updatedAt = new Date();

    // Clear all refresh tokens to force re-login on all devices
    user.clearRefreshTokens();

    // Send security notification email
    try {
      const emailService = require('./emailService');
      if (emailService.isAvailable()) {
        await emailService.sendPasswordChangedNotification(user.email, user.username, context);
      }
    } catch (emailError) {
      // Log error but don't fail the password change
      logger.warn('Failed to send password change notification email', {
        userId,
        error: emailError.message,
      });
    }
  }

  /**
   * Create API key for user
   * @param {string} userId - User ID
   * @param {Object} keyData - API key data
   * @returns {Promise<Object>} Created API key with plaintext key
   */
  async createApiKey(userId, keyData) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const { name, scopes = ['read'], expiresIn } = keyData;

    // Validate name
    const nameValidation = ApiKey.validateName(name);
    if (!nameValidation.isValid) {
      throw new Error(nameValidation.errors.join(', '));
    }

    // Validate scopes
    const scopeValidation = ApiKey.validateScopes(scopes);
    if (!scopeValidation.isValid) {
      throw new Error(scopeValidation.errors.join(', '));
    }

    // Generate API key
    const { key, keyHash, keyPrefix } = ApiKey.generateApiKey();

    // Create API key object
    const apiKey = new ApiKey({
      userId,
      name,
      keyHash,
      keyPrefix,
      scopes,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn) : null,
    });

    // Store API key
    this.apiKeys.set(apiKey.id, apiKey);

    return {
      ...apiKey.toSafeObject(),
      key, // Only return the plaintext key once during creation
    };
  }

  /**
   * Verify API key
   * @param {string} key - API key
   * @returns {Promise<Object>} API key and user info
   */
  async verifyApiKey(key) {
    if (!ApiKey.validateKeyFormat(key)) {
      throw new Error('Invalid API key format');
    }

    const keyHash = ApiKey.hashKey(key);
    const apiKey = Array.from(this.apiKeys.values()).find(ak => ak.keyHash === keyHash);

    if (!apiKey) {
      throw new Error('Invalid API key');
    }

    if (!apiKey.isActive) {
      throw new Error('API key is deactivated');
    }

    if (apiKey.isExpired()) {
      throw new Error('API key has expired');
    }

    const user = this.users.get(apiKey.userId);
    if (!user || !user.isActive) {
      throw new Error('Associated user not found or inactive');
    }

    // Update usage
    apiKey.updateUsage();

    return {
      apiKey: apiKey.toSafeObject(),
      user: user.toSafeObject(),
    };
  }

  /**
   * Get user's API keys
   * @param {string} userId - User ID
   * @returns {Array} User's API keys
   */
  getUserApiKeys(userId) {
    return Array.from(this.apiKeys.values())
      .filter(apiKey => apiKey.userId === userId)
      .map(apiKey => apiKey.toSafeObject());
  }

  /**
   * Delete API key
   * @param {string} userId - User ID
   * @param {string} keyId - API key ID
   */
  async deleteApiKey(userId, keyId) {
    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey || apiKey.userId !== userId) {
      throw new Error('API key not found');
    }

    this.apiKeys.delete(keyId);
  }

  /**
   * Get all users (admin only)
   * @returns {Array} All users
   */
  getAllUsers() {
    return Array.from(this.users.values()).map(user => user.toSafeObject());
  }

  /**
   * Update user role (admin only)
   * @param {string} userId - User ID
   * @param {string} role - New role
   */
  async updateUserRole(userId, role) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!['user', 'admin'].includes(role)) {
      throw new Error('Invalid role');
    }

    user.role = role;
    user.updatedAt = new Date();

    return user.toSafeObject();
  }

  /**
   * Deactivate user (admin only)
   * @param {string} userId - User ID
   */
  async deactivateUser(userId) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.isActive = false;
    user.updatedAt = new Date();
    user.clearRefreshTokens();

    return user.toSafeObject();
  }

  /**
   * Activate user (admin only)
   * @param {string} userId - User ID
   */
  async activateUser(userId) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.isActive = true;
    user.updatedAt = new Date();

    return user.toSafeObject();
  }

  /**
   * Verify user email with token
   * @param {string} token - Verification token
   * @returns {Promise<Object>} User object
   */
  async verifyEmail(token) {
    if (!token) {
      throw new Error('Verification token is required');
    }

    // Verify token with email service
    const tokenData = emailService.verifyToken(token, 'email_verification');
    if (!tokenData) {
      throw new Error('Invalid or expired verification token');
    }

    // Find user by email
    const user = this.getUserByEmail(tokenData.email);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isEmailVerified) {
      throw new Error('Email is already verified');
    }

    // Mark email as verified
    user.verifyEmail();

    // Mark token as used
    emailService.markTokenAsUsed(token);

    return user.toSafeObject();
  }

  /**
   * Resend verification email
   * @param {string} email - User email
   * @returns {Promise<Object>} Result
   */
  async resendVerificationEmail(email) {
    if (!email) {
      throw new Error('Email is required');
    }

    if (!emailService.isAvailable()) {
      throw new Error('Email service is not configured');
    }

    // Find user by email
    const user = this.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isEmailVerified) {
      throw new Error('Email is already verified');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Generate new verification token
    const tokenData = emailService.generateVerificationToken(email, 'email_verification');
    
    // Send verification email
    await emailService.sendVerificationEmail(email, user.username, tokenData.token);

    return {
      message: 'Verification email sent successfully',
      email: email,
    };
  }

  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {Promise<Object>} Result
   */
  async requestPasswordReset(email) {
    if (!email) {
      throw new Error('Email is required');
    }

    if (!emailService.isAvailable()) {
      throw new Error('Email service is not configured');
    }

    // Find user by email
    const user = this.getUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists or not for security
      return {
        message: 'If an account with this email exists, a password reset link has been sent',
        email: email,
      };
    }

    if (!user.isActive) {
      return {
        message: 'If an account with this email exists, a password reset link has been sent',
        email: email,
      };
    }

    // Generate password reset token
    const tokenData = emailService.generateVerificationToken(email, 'password_reset');
    
    // Send password reset email
    await emailService.sendPasswordResetEmail(email, user.username, tokenData.token);

    return {
      message: 'If an account with this email exists, a password reset link has been sent',
      email: email,
    };
  }

  /**
   * Reset password with token
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Result
   */
  async resetPassword(token, newPassword) {
    if (!token || !newPassword) {
      throw new Error('Token and new password are required');
    }

    // Verify token
    const tokenData = emailService.verifyToken(token, 'password_reset');
    if (!tokenData) {
      throw new Error('Invalid or expired reset token');
    }

    // Find user by email
    const user = this.getUserByEmail(tokenData.email);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Validate new password
    const passwordValidation = User.validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.errors.join(', '));
    }

    // Hash new password
    user.passwordHash = await User.hashPassword(newPassword);
    user.updatedAt = new Date();

    // Clear all refresh tokens to force re-login on all devices
    user.clearRefreshTokens();

    // Mark token as used
    emailService.markTokenAsUsed(token);

    return {
      message: 'Password reset successfully',
      user: user.toSafeObject(),
    };
  }

  /**
   * Handle OAuth login/registration
   * @param {string} provider - OAuth provider (google, github)
   * @param {Object} providerData - Provider data
   * @returns {Promise<Object>} Login result
   */
  async handleOAuthLogin(provider, providerData) {
    if (!provider || !providerData) {
      throw new Error('Provider and provider data are required');
    }

    // Validate OAuth data
    const validation = User.validateOAuthData(providerData);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    // Check if user exists by email
    let user = this.getUserByEmail(providerData.email);
    let isNewUser = false;
    let wasLinked = false;

    if (user) {
      // User exists, check if provider is already linked
      if (user.hasOAuthProvider(provider)) {
        // Update provider usage and info
        user.updateOAuthProviderUsage(provider);
        user.addOAuthProvider(provider, providerData); // Updates existing provider data
      } else {
        // Link new provider to existing account
        user.addOAuthProvider(provider, providerData);
        wasLinked = true;
      }
    } else {
      // Create new user account
      const username = await this.generateUniqueUsername(
        User.generateUsernameFromOAuth(providerData, provider)
      );

      user = new User({
        email: providerData.email,
        username,
        // No password for OAuth-only accounts
        passwordHash: null,
        role: 'user',
        isEmailVerified: true, // OAuth emails are considered verified
        emailVerifiedAt: new Date(),
        profilePictureUrl: providerData.profilePictureUrl,
      });

      // Add OAuth provider
      user.addOAuthProvider(provider, providerData);
      
      // Store user
      this.users.set(user.id, user);
      isNewUser = true;
    }

    // Update last login
    user.updateLastLogin();

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user);
    user.addRefreshToken(refreshToken);

    return {
      user: user.toSafeObject(),
      accessToken,
      refreshToken,
      isNewUser,
      wasLinked,
      provider,
      requiresEmailVerification: false, // OAuth accounts don't need email verification
    };
  }

  /**
   * Link OAuth provider to existing authenticated user
   * @param {string} userId - User ID
   * @param {string} provider - OAuth provider
   * @param {Object} providerData - Provider data
   * @returns {Promise<Object>} Link result
   */
  async linkOAuthProvider(userId, provider, providerData) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate OAuth data
    const validation = User.validateOAuthData(providerData);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    // Check if provider is already linked
    if (user.hasOAuthProvider(provider)) {
      throw new Error(`${provider} account is already linked`);
    }

    // Check if another user has this OAuth account
    const existingUser = Array.from(this.users.values()).find(
      u => u.id !== userId && u.hasOAuthProvider(provider) && 
           u.oauthProviders[provider].id === providerData.id
    );
    
    if (existingUser) {
      throw new Error(`This ${provider} account is already linked to another user`);
    }

    // Link provider
    user.addOAuthProvider(provider, providerData);

    return {
      message: `${provider} account linked successfully`,
      user: user.toSafeObject(),
      provider,
    };
  }

  /**
   * Unlink OAuth provider from user
   * @param {string} userId - User ID
   * @param {string} provider - OAuth provider
   * @returns {Promise<Object>} Unlink result
   */
  async unlinkOAuthProvider(userId, provider) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.hasOAuthProvider(provider)) {
      throw new Error(`${provider} account is not linked`);
    }

    // Prevent unlinking if it's the only authentication method
    if (!user.passwordHash && user.getLinkedProviders().length === 1) {
      throw new Error('Cannot unlink the only authentication method. Please set a password first.');
    }

    // Unlink provider
    user.removeOAuthProvider(provider);

    return {
      message: `${provider} account unlinked successfully`,
      user: user.toSafeObject(),
      provider,
    };
  }

  /**
   * Generate unique username from base username
   * @param {string} baseUsername - Base username
   * @returns {Promise<string>} Unique username
   */
  async generateUniqueUsername(baseUsername) {
    let username = baseUsername;
    let counter = 1;

    while (this.isUsernameTaken(username)) {
      username = `${baseUsername}${counter}`;
      counter++;
      
      // Prevent infinite loop
      if (counter > 1000) {
        username = `user${Date.now()}`;
        break;
      }
    }

    return username;
  }

  /**
   * Check if username is taken
   * @param {string} username - Username to check
   * @returns {boolean} Username availability
   */
  isUsernameTaken(username) {
    return Array.from(this.users.values()).some(user => user.username === username);
  }

  /**
   * Get user's OAuth connections
   * @param {string} userId - User ID
   * @returns {Object} OAuth provider information
   */
  getUserOAuthConnections(userId) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const connections = {};
    const linkedProviders = user.getLinkedProviders();
    
    for (const provider of linkedProviders) {
      const providerData = user.oauthProviders[provider];
      connections[provider] = {
        id: providerData.id,
        email: providerData.email,
        name: providerData.name,
        username: providerData.username,
        linkedAt: providerData.linkedAt,
        lastUsed: providerData.lastUsed,
      };
    }

    return {
      userId: user.id,
      connections,
      hasPassword: !!user.passwordHash,
      canUnlinkAll: !!user.passwordHash, // Can only unlink all if password is set
    };
  }
}

// Export singleton instance
module.exports = new AuthService();