const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Safe logger import that handles testing scenarios
function createFallbackLogger() {
  return {
    info: (msg, meta) => console.log(`INFO: ${msg}`, meta ? JSON.stringify(meta) : ''),
    warn: (msg, meta) => console.warn(`WARN: ${msg}`, meta ? JSON.stringify(meta) : ''),
    error: (msg, meta) => console.error(`ERROR: ${msg}`, meta ? JSON.stringify(meta) : ''),
    debug: (msg, meta) => console.log(`DEBUG: ${msg}`, meta ? JSON.stringify(meta) : ''),
  };
}

let logger;
try {
  logger = require('../utils/logger');
  // Verify logger has required methods
  if (!logger.error || !logger.info || !logger.warn) {
    logger = createFallbackLogger();
  }
} catch (error) {
  logger = createFallbackLogger();
}

/**
 * Email service for sending verification emails and other notifications
 * Implements secure email functionality with SMTP configuration
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.verificationTokens = new Map(); // In-memory storage for demo - replace with Redis/DB
    this.initTransporter();
  }

  /**
   * Initialize email transporter with SMTP configuration
   */
  initTransporter() {
    try {
      // Skip if SMTP configuration is not provided
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        logger.warn('SMTP configuration missing - email functionality disabled');
        return;
      }

      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: (parseInt(process.env.SMTP_PORT) || 587) === 465, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        // Additional security options
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        },
      });

      // Verify SMTP connection
      this.verifyConnection();
    } catch (error) {
      logger.error('Failed to initialize email transporter', { error: error.message });
    }
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection() {
    if (!this.transporter) return false;

    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      logger.error('SMTP connection verification failed', { error: error.message });
      return false;
    }
  }

  /**
   * Generate secure verification token
   * @param {string} email - User email
   * @param {string} type - Token type (email_verification, password_reset, etc.)
   * @returns {Object} Token data
   */
  generateVerificationToken(email, type = 'email_verification') {
    // Generate cryptographically secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const tokenData = {
      email,
      type,
      token: hashedToken,
      plainToken: token, // Store plain token only for return
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      createdAt: new Date(),
      used: false,
    };

    // Store hashed token (more secure)
    this.verificationTokens.set(hashedToken, {
      ...tokenData,
      plainToken: undefined, // Don't store plain token
    });

    // Cleanup expired tokens periodically
    this.cleanupExpiredTokens();

    return {
      token: token, // Return plain token for email
      expiresAt: tokenData.expiresAt,
    };
  }

  /**
   * Verify token
   * @param {string} token - Plain token from email
   * @param {string} type - Expected token type
   * @returns {Object|null} Token data if valid
   */
  verifyToken(token, type = 'email_verification') {
    if (!token) return null;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const tokenData = this.verificationTokens.get(hashedToken);

    if (!tokenData) {
      return null;
    }

    // Check if token is expired
    if (new Date() > tokenData.expiresAt) {
      this.verificationTokens.delete(hashedToken);
      return null;
    }

    // Check if token is already used
    if (tokenData.used) {
      return null;
    }

    // Check token type
    if (tokenData.type !== type) {
      return null;
    }

    return tokenData;
  }

  /**
   * Mark token as used
   * @param {string} token - Plain token
   */
  markTokenAsUsed(token) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const tokenData = this.verificationTokens.get(hashedToken);
    
    if (tokenData) {
      tokenData.used = true;
      this.verificationTokens.set(hashedToken, tokenData);
    }
  }

  /**
   * Clean up expired tokens
   */
  cleanupExpiredTokens() {
    const now = new Date();
    for (const [hashedToken, tokenData] of this.verificationTokens.entries()) {
      if (now > tokenData.expiresAt) {
        this.verificationTokens.delete(hashedToken);
      }
    }
  }

  /**
   * Send email verification email
   * @param {string} email - User email
   * @param {string} username - Username
   * @param {string} token - Verification token
   */
  async sendVerificationEmail(email, username, token) {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const verificationUrl = `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/verify-email?token=${token}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Verify your email address - YouTube Outlier Discovery',
      html: this.getVerificationEmailTemplate(username, verificationUrl, token),
      text: this.getVerificationEmailText(username, verificationUrl),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Verification email sent successfully', {
        email,
        messageId: info.messageId,
      });
      return info;
    } catch (error) {
      logger.error('Failed to send verification email', {
        email,
        error: error.message,
      });
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Send password reset email
   * @param {string} email - User email
   * @param {string} username - Username
   * @param {string} token - Reset token
   */
  async sendPasswordResetEmail(email, username, token) {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const resetUrl = `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Reset your password - YouTube Outlier Discovery',
      html: this.getPasswordResetEmailTemplate(username, resetUrl, token),
      text: this.getPasswordResetEmailText(username, resetUrl),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Password reset email sent successfully', {
        email,
        messageId: info.messageId,
      });
      return info;
    } catch (error) {
      logger.error('Failed to send password reset email', {
        email,
        error: error.message,
      });
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Send security notification email for password change
   * @param {string} email - User email
   * @param {string} username - Username
   * @param {Object} context - Security context (IP, timestamp, etc.)
   */
  async sendPasswordChangedNotification(email, username, context = {}) {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const timestamp = new Date().toLocaleString();
    const ipAddress = context.ip || 'Unknown';
    const userAgent = context.userAgent || 'Unknown';
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Security Alert: Password Changed - YouTube Outlier Discovery',
      html: this.getPasswordChangedEmailTemplate(username, timestamp, ipAddress, userAgent),
      text: this.getPasswordChangedEmailText(username, timestamp, ipAddress),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Password changed notification sent successfully', {
        email,
        messageId: info.messageId,
      });
      return info;
    } catch (error) {
      logger.error('Failed to send password changed notification', {
        email,
        error: error.message,
      });
      throw new Error('Failed to send password changed notification');
    }
  }

  /**
   * Get email verification HTML template
   * @param {string} username - Username
   * @param {string} verificationUrl - Verification URL
   * @param {string} token - Verification token
   * @returns {string} HTML template
   */
  getVerificationEmailTemplate(username, verificationUrl, token) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 5px 5px; }
        .button { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .button:hover { background: #218838; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
        .token { background: #e9ecef; padding: 10px; border-radius: 3px; font-family: monospace; word-break: break-all; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>YouTube Outlier Discovery</h1>
        <p>Email Verification Required</p>
    </div>
    <div class="content">
        <h2>Welcome, ${username}!</h2>
        <p>Thank you for registering with YouTube Outlier Discovery. To complete your account setup and start discovering high-performing content, please verify your email address.</p>
        
        <p>Click the button below to verify your email:</p>
        <a href="${verificationUrl}" class="button">Verify Email Address</a>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        
        <div class="token">
            <strong>Verification Code:</strong> ${token}
        </div>
        
        <p><strong>Important:</strong></p>
        <ul>
            <li>This verification link will expire in 24 hours</li>
            <li>If you didn't create this account, please ignore this email</li>
            <li>For security reasons, never share this verification code with anyone</li>
        </ul>
    </div>
    <div class="footer">
        <p>This email was sent from YouTube Outlier Discovery. If you have any questions, please contact our support team.</p>
        <p>© ${new Date().getFullYear()} YouTube Outlier Discovery. All rights reserved.</p>
    </div>
</body>
</html>`;
  }

  /**
   * Get email verification plain text template
   * @param {string} username - Username
   * @param {string} verificationUrl - Verification URL
   * @returns {string} Plain text template
   */
  getVerificationEmailText(username, verificationUrl) {
    return `
Welcome to YouTube Outlier Discovery, ${username}!

Thank you for registering. To complete your account setup, please verify your email address by clicking the link below:

${verificationUrl}

This verification link will expire in 24 hours.

If you didn't create this account, please ignore this email.

Best regards,
YouTube Outlier Discovery Team`;
  }

  /**
   * Get password reset HTML template
   * @param {string} username - Username
   * @param {string} resetUrl - Reset URL
   * @param {string} token - Reset token
   * @returns {string} HTML template
   */
  getPasswordResetEmailTemplate(username, resetUrl, token) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 5px 5px; }
        .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .button:hover { background: #c82333; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
        .token { background: #e9ecef; padding: 10px; border-radius: 3px; font-family: monospace; word-break: break-all; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>YouTube Outlier Discovery</h1>
        <p>Password Reset Request</p>
    </div>
    <div class="content">
        <h2>Hello, ${username}</h2>
        <p>We received a request to reset your password. If you didn't make this request, please ignore this email and your password will remain unchanged.</p>
        
        <p>To reset your password, click the button below:</p>
        <a href="${resetUrl}" class="button">Reset Password</a>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        
        <div class="token">
            <strong>Reset Code:</strong> ${token}
        </div>
        
        <p><strong>Security Information:</strong></p>
        <ul>
            <li>This reset link will expire in 24 hours</li>
            <li>For your security, use a strong, unique password</li>
            <li>Never share this reset code with anyone</li>
            <li>If you didn't request this reset, please secure your account</li>
        </ul>
    </div>
    <div class="footer">
        <p>This email was sent from YouTube Outlier Discovery. If you have any questions, please contact our support team.</p>
        <p>© ${new Date().getFullYear()} YouTube Outlier Discovery. All rights reserved.</p>
    </div>
</body>
</html>`;
  }

  /**
   * Get password reset plain text template
   * @param {string} username - Username
   * @param {string} resetUrl - Reset URL
   * @returns {string} Plain text template
   */
  getPasswordResetEmailText(username, resetUrl) {
    return `
Password Reset Request - YouTube Outlier Discovery

Hello ${username},

We received a request to reset your password. If you didn't make this request, please ignore this email.

To reset your password, visit the following link:
${resetUrl}

This reset link will expire in 24 hours.

If you have any questions, please contact our support team.

Best regards,
YouTube Outlier Discovery Team`;
  }

  /**
   * Send email change verification email
   * @param {string} newEmail - New email address
   * @param {string} username - Username
   * @param {string} token - Verification token
   */
  async sendEmailChangeVerification(newEmail, username, token) {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const verificationUrl = `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/verify-email-change?token=${token}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: newEmail,
      subject: 'Verify your new email address - YouTube Outlier Discovery',
      html: this.getEmailChangeVerificationTemplate(username, verificationUrl, token),
      text: this.getEmailChangeVerificationText(username, verificationUrl),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Email change verification sent successfully', {
        email: newEmail,
        messageId: info.messageId,
      });
      return info;
    } catch (error) {
      logger.error('Failed to send email change verification', {
        email: newEmail,
        error: error.message,
      });
      throw new Error('Failed to send email change verification');
    }
  }

  /**
   * Get password changed notification HTML template
   * @param {string} username - Username
   * @param {string} timestamp - Change timestamp
   * @param {string} ipAddress - IP address
   * @param {string} userAgent - User agent
   * @returns {string} HTML template
   */
  getPasswordChangedEmailTemplate(username, timestamp, ipAddress, userAgent) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Alert: Password Changed</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 5px 5px; }
        .alert-box { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0; }
        .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .info-table th, .info-table td { padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6; }
        .info-table th { background: #e9ecef; font-weight: bold; }
        .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .button:hover { background: #c82333; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 Security Alert</h1>
        <p>Your password has been changed</p>
    </div>
    <div class="content">
        <p>Hello <strong>${username}</strong>,</p>
        
        <div class="alert-box">
            <strong>⚠️ Important Security Notice:</strong> Your account password was successfully changed.
        </div>
        
        <p>If this was you, no further action is required. However, if you did not make this change, your account may have been compromised.</p>
        
        <h3>Change Details:</h3>
        <table class="info-table">
            <tr>
                <th>When:</th>
                <td>${timestamp}</td>
            </tr>
            <tr>
                <th>IP Address:</th>
                <td>${ipAddress}</td>
            </tr>
            <tr>
                <th>Device/Browser:</th>
                <td>${userAgent}</td>
            </tr>
        </table>
        
        <h3>What to do if this wasn't you:</h3>
        <ul>
            <li>Reset your password immediately using the forgot password option</li>
            <li>Review your account for any unauthorized activity</li>
            <li>Contact our support team if you need assistance</li>
            <li>Consider enabling two-factor authentication for added security</li>
        </ul>
        
        <p>For your security, you have been logged out of all devices and will need to sign in again with your new password.</p>
        
        <div class="footer">
            <p>This is an automated security notification from YouTube Outlier Discovery Tool.</p>
            <p>If you have questions about your account security, please contact our support team.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Get password changed notification plain text template
   * @param {string} username - Username
   * @param {string} timestamp - Change timestamp
   * @param {string} ipAddress - IP address
   * @returns {string} Plain text template
   */
  getPasswordChangedEmailText(username, timestamp, ipAddress) {
    return `Security Alert: Password Changed

Hello ${username},

Your account password was successfully changed.

Change Details:
- When: ${timestamp}
- IP Address: ${ipAddress}

If this was you, no further action is required. However, if you did not make this change, your account may have been compromised.

What to do if this wasn't you:
1. Reset your password immediately using the forgot password option
2. Review your account for any unauthorized activity
3. Contact our support team if you need assistance
4. Consider enabling two-factor authentication for added security

For your security, you have been logged out of all devices and will need to sign in again with your new password.

This is an automated security notification from YouTube Outlier Discovery Tool.

Best regards,
YouTube Outlier Discovery Team`;
  }

  /**
   * Get email change verification HTML template
   * @param {string} username - Username
   * @param {string} verificationUrl - Verification URL
   * @param {string} token - Verification token
   * @returns {string} HTML template
   */
  getEmailChangeVerificationTemplate(username, verificationUrl, token) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your New Email Address</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 5px 5px; }
        .button { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .button:hover { background: #218838; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
        .token { background: #e9ecef; padding: 10px; border-radius: 3px; font-family: monospace; word-break: break-all; margin: 10px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📧 Verify Your New Email</h1>
        <p>Confirm your email address change</p>
    </div>
    <div class="content">
        <p>Hello <strong>${username}</strong>,</p>
        
        <p>We received a request to change your email address for your YouTube Outlier Discovery account. To complete this change, please verify your new email address by clicking the button below:</p>
        
        <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify New Email Address</a>
        </div>
        
        <div class="warning">
            <strong>⚠️ Important:</strong> If you did not request this email change, please ignore this message and contact our support team immediately.
        </div>
        
        <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
        <div class="token">${verificationUrl}</div>
        
        <p><strong>Security Information:</strong></p>
        <ul>
            <li>This verification link will expire in 24 hours</li>
            <li>Your account email will only change after verification</li>
            <li>Until verified, you can continue using your current email</li>
        </ul>
        
        <div class="footer">
            <p>This verification was requested for the YouTube Outlier Discovery Tool.</p>
            <p>If you have questions, please contact our support team.</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Get email change verification plain text template
   * @param {string} username - Username
   * @param {string} verificationUrl - Verification URL
   * @returns {string} Plain text template
   */
  getEmailChangeVerificationText(username, verificationUrl) {
    return `Verify Your New Email Address

Hello ${username},

We received a request to change your email address for your YouTube Outlier Discovery account. To complete this change, please verify your new email address by visiting this link:

${verificationUrl}

Important: If you did not request this email change, please ignore this message and contact our support team immediately.

Security Information:
- This verification link will expire in 24 hours
- Your account email will only change after verification
- Until verified, you can continue using your current email

This verification was requested for the YouTube Outlier Discovery Tool.

Best regards,
YouTube Outlier Discovery Team`;
  }

  /**
   * Check if email service is available
   * @returns {boolean} Service availability
   */
  isAvailable() {
    return this.transporter !== null;
  }

  /**
   * Get verification token statistics (for monitoring)
   * @returns {Object} Token statistics
   */
  getTokenStats() {
    const now = new Date();
    let activeTokens = 0;
    let expiredTokens = 0;
    let usedTokens = 0;

    for (const tokenData of this.verificationTokens.values()) {
      if (tokenData.used) {
        usedTokens++;
      } else if (now > tokenData.expiresAt) {
        expiredTokens++;
      } else {
        activeTokens++;
      }
    }

    return {
      total: this.verificationTokens.size,
      active: activeTokens,
      expired: expiredTokens,
      used: usedTokens,
    };
  }
}

// Export singleton instance
module.exports = new EmailService();