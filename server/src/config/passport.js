const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const authService = require('../services/authService');
const logger = require('../utils/logger');

/**
 * Passport OAuth configuration for Google and GitHub authentication
 * Integrates with existing JWT-based authentication system
 */

// JWT Strategy for API authentication
passport.use('jwt', new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_ACCESS_SECRET,
  issuer: process.env.JWT_ISSUER || 'outlier-discovery',
  audience: process.env.JWT_AUDIENCE || 'outlier-api',
}, async (payload, done) => {
  try {
    const user = authService.getUserById(payload.sub);
    if (user && user.isActive) {
      return done(null, user.toSafeObject());
    }
    return done(null, false);
  } catch (error) {
    logger.error('JWT strategy error', { error: error.message, userId: payload.sub });
    return done(error, false);
  }
}));

// Google OAuth 2.0 Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use('google', new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/google/callback`,
    scope: ['profile', 'email'],
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const providerData = {
        id: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        username: profile.username || profile.emails[0].value.split('@')[0],
        profilePictureUrl: profile.photos[0]?.value,
        provider: 'google',
        accessToken,
        refreshToken,
      };

      const result = await authService.handleOAuthLogin('google', providerData);
      
      logger.info('Google OAuth login successful', {
        userId: result.user.id,
        email: result.user.email,
        isNewUser: result.isNewUser,
        wasLinked: result.wasLinked,
      });

      return done(null, result);
    } catch (error) {
      logger.error('Google OAuth error', {
        error: error.message,
        profileId: profile.id,
        email: profile.emails[0]?.value,
      });
      return done(error, null);
    }
  }));
} else {
  logger.warn('Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
}

// GitHub OAuth Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use('github', new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/github/callback`,
    scope: ['user:email'],
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // GitHub might not provide public email, get primary email from emails array
      const primaryEmail = profile.emails?.find(email => email.primary)?.value || 
                          profile.emails?.[0]?.value ||
                          `${profile.username}@users.noreply.github.com`;

      const providerData = {
        id: profile.id,
        email: primaryEmail,
        name: profile.displayName || profile.username,
        username: profile.username,
        profilePictureUrl: profile.photos[0]?.value,
        provider: 'github',
        accessToken,
        refreshToken,
      };

      const result = await authService.handleOAuthLogin('github', providerData);
      
      logger.info('GitHub OAuth login successful', {
        userId: result.user.id,
        email: result.user.email,
        username: result.user.username,
        isNewUser: result.isNewUser,
        wasLinked: result.wasLinked,
      });

      return done(null, result);
    } catch (error) {
      logger.error('GitHub OAuth error', {
        error: error.message,
        profileId: profile.id,
        username: profile.username,
      });
      return done(error, null);
    }
  }));
} else {
  logger.warn('GitHub OAuth not configured - missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET');
}

// Passport serialization (not used in JWT setup, but required)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = authService.getUserById(id);
    done(null, user ? user.toSafeObject() : null);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;