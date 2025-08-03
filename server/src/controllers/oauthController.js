const authService = require('../services/authService');
const logger = require('../utils/logger');

/**
 * OAuth controller for handling OAuth authentication flows
 * Handles Google and GitHub OAuth login, linking, and unlinking
 */
class OAuthController {
  /**
   * Handle OAuth callback success
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async handleOAuthCallback(req, res) {
    try {
      const { user, accessToken, refreshToken, isNewUser, wasLinked, provider } = req.user;

      // Set httpOnly cookie for refresh token
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Create redirect URL with success state and token
      const clientUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
      const redirectUrl = new URL('/auth/oauth-callback', clientUrl);
      
      redirectUrl.searchParams.append('success', 'true');
      redirectUrl.searchParams.append('provider', provider);
      redirectUrl.searchParams.append('isNewUser', isNewUser.toString());
      redirectUrl.searchParams.append('wasLinked', wasLinked.toString());
      redirectUrl.searchParams.append('token', accessToken);

      logger.info(`OAuth ${provider} callback successful`, {
        userId: user.id,
        email: user.email,
        provider,
        isNewUser,
        wasLinked,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.redirect(redirectUrl.toString());
    } catch (error) {
      logger.error('OAuth callback error', {
        error: error.message,
        provider: req.params.provider,
        ip: req.ip,
      });

      // Redirect to frontend with error
      const clientUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
      const redirectUrl = new URL('/auth/oauth-callback', clientUrl);
      redirectUrl.searchParams.append('error', 'oauth_callback_failed');
      redirectUrl.searchParams.append('message', 'Authentication failed');

      res.redirect(redirectUrl.toString());
    }
  }

  /**
   * Handle OAuth callback failure
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async handleOAuthFailure(req, res) {
    logger.warn('OAuth authentication failed', {
      provider: req.params.provider,
      error: req.query.error,
      errorDescription: req.query.error_description,
      ip: req.ip,
    });

    // Redirect to frontend with error
    const clientUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
    const redirectUrl = new URL('/auth/oauth-callback', clientUrl);
    redirectUrl.searchParams.append('error', 'oauth_failed');
    redirectUrl.searchParams.append('message', 'OAuth authentication failed');

    res.redirect(redirectUrl.toString());
  }

  /**
   * Link OAuth provider to authenticated user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async linkProvider(req, res) {\n    try {\n      const { provider } = req.params;\n      const userId = req.user.id;\n      const { providerData } = req.body;\n\n      if (!providerData) {\n        return res.status(400).json({\n          error: 'Provider data required',\n          message: 'OAuth provider data is missing',\n        });\n      }\n\n      const result = await authService.linkOAuthProvider(userId, provider, providerData);\n\n      logger.info(`OAuth provider linked: ${provider}`, {\n        userId,\n        provider,\n        ip: req.ip,\n      });\n\n      res.json(result);\n    } catch (error) {\n      logger.error('OAuth provider linking failed', {\n        error: error.message,\n        userId: req.user?.id,\n        provider: req.params.provider,\n        ip: req.ip,\n      });\n\n      res.status(400).json({\n        error: 'Provider linking failed',\n        message: error.message,\n      });\n    }\n  }\n\n  /**\n   * Unlink OAuth provider from authenticated user\n   * @param {Object} req - Express request object\n   * @param {Object} res - Express response object\n   */\n  static async unlinkProvider(req, res) {\n    try {\n      const { provider } = req.params;\n      const userId = req.user.id;\n\n      const result = await authService.unlinkOAuthProvider(userId, provider);\n\n      logger.info(`OAuth provider unlinked: ${provider}`, {\n        userId,\n        provider,\n        ip: req.ip,\n      });\n\n      res.json(result);\n    } catch (error) {\n      logger.error('OAuth provider unlinking failed', {\n        error: error.message,\n        userId: req.user?.id,\n        provider: req.params.provider,\n        ip: req.ip,\n      });\n\n      res.status(400).json({\n        error: 'Provider unlinking failed',\n        message: error.message,\n      });\n    }\n  }\n\n  /**\n   * Get user's OAuth connections\n   * @param {Object} req - Express request object\n   * @param {Object} res - Express response object\n   */\n  static async getConnections(req, res) {\n    try {\n      const userId = req.user.id;\n      const connections = authService.getUserOAuthConnections(userId);\n\n      res.json({\n        connections: connections.connections,\n        hasPassword: connections.hasPassword,\n        canUnlinkAll: connections.canUnlinkAll,\n        availableProviders: ['google', 'github'],\n      });\n    } catch (error) {\n      logger.error('Get OAuth connections failed', {\n        error: error.message,\n        userId: req.user?.id,\n        ip: req.ip,\n      });\n\n      res.status(500).json({\n        error: 'Failed to get connections',\n        message: 'An error occurred while retrieving OAuth connections',\n      });\n    }\n  }\n\n  /**\n   * Get OAuth provider configuration for frontend\n   * @param {Object} req - Express request object\n   * @param {Object} res - Express response object\n   */\n  static async getProviderConfig(req, res) {\n    try {\n      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';\n      \n      const config = {\n        google: {\n          enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),\n          authUrl: `${baseUrl}/api/auth/google`,\n          name: 'Google',\n        },\n        github: {\n          enabled: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),\n          authUrl: `${baseUrl}/api/auth/github`,\n          name: 'GitHub',\n        },\n      };\n\n      res.json({ providers: config });\n    } catch (error) {\n      logger.error('Get provider config failed', {\n        error: error.message,\n        ip: req.ip,\n      });\n\n      res.status(500).json({\n        error: 'Configuration error',\n        message: 'Failed to get OAuth provider configuration',\n      });\n    }\n  }\n}\n\nmodule.exports = OAuthController;