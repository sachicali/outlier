/**
 * Role-Based Access Control (RBAC) middleware
 * Implements fine-grained permission system for different user roles
 */

/**
 * Define roles and their hierarchical permissions
 */
const ROLES = {
  admin: {
    level: 100,
    permissions: [
      'user:read',
      'user:write',
      'user:delete',
      'user:manage',
      'analysis:read',
      'analysis:write',
      'analysis:delete',
      'analysis:manage',
      'apikey:read',
      'apikey:write',
      'apikey:delete',
      'apikey:manage',
      'system:read',
      'system:write',
      'system:manage',
    ],
  },
  user: {
    level: 10,
    permissions: [
      'analysis:read',
      'analysis:write',
      'apikey:read',
      'apikey:write',
      'profile:read',
      'profile:write',
    ],
  },
  guest: {
    level: 1,
    permissions: [
      'analysis:read',
    ],
  },
};

/**
 * Resource-based permissions
 */
const RESOURCES = {
  user: ['read', 'write', 'delete', 'manage'],
  analysis: ['read', 'write', 'delete', 'manage'],
  apikey: ['read', 'write', 'delete', 'manage'],
  profile: ['read', 'write'],
  system: ['read', 'write', 'manage'],
};

/**
 * Permission patterns for common operations
 */
const PERMISSION_PATTERNS = {
  // User management
  'GET:/api/users': 'user:read',
  'POST:/api/users': 'user:write',
  'PUT:/api/users/:id': 'user:write',
  'DELETE:/api/users/:id': 'user:delete',
  'POST:/api/users/:id/activate': 'user:manage',
  'POST:/api/users/:id/deactivate': 'user:manage',
  'PUT:/api/users/:id/role': 'user:manage',

  // Analysis operations
  'GET:/api/outlier': 'analysis:read',
  'POST:/api/outlier': 'analysis:write',
  'GET:/api/outlier/:id': 'analysis:read',
  'DELETE:/api/outlier/:id': 'analysis:delete',
  'PUT:/api/outlier/:id': 'analysis:write',

  // Channel operations
  'GET:/api/channels': 'analysis:read',
  'POST:/api/channels': 'analysis:write',

  // API key management
  'GET:/api/apikeys': 'apikey:read',
  'POST:/api/apikeys': 'apikey:write',
  'DELETE:/api/apikeys/:id': 'apikey:delete',
  'PUT:/api/apikeys/:id': 'apikey:write',

  // Profile operations
  'GET:/api/profile': 'profile:read',
  'PUT:/api/profile': 'profile:write',
  'POST:/api/profile/change-password': 'profile:write',

  // System operations
  'GET:/api/system/health': 'system:read',
  'GET:/api/system/stats': 'system:read',
  'POST:/api/system/maintenance': 'system:manage',
};

/**
 * Check if a role has a specific permission
 * @param {string} role - User role
 * @param {string} permission - Required permission
 * @returns {boolean} Permission granted
 */
function hasPermission(role, permission) {
  const roleConfig = ROLES[role];
  if (!roleConfig) {
    return false;
  }

  return roleConfig.permissions.includes(permission);
}

/**
 * Check if a role has sufficient level for operation
 * @param {string} role - User role
 * @param {number} requiredLevel - Required permission level
 * @returns {boolean} Level sufficient
 */
function hasLevel(role, requiredLevel) {
  const roleConfig = ROLES[role];
  if (!roleConfig) {
    return false;
  }

  return roleConfig.level >= requiredLevel;
}

/**
 * Get permissions for a role
 * @param {string} role - User role
 * @returns {Array} List of permissions
 */
function getRolePermissions(role) {
  const roleConfig = ROLES[role];
  return roleConfig ? roleConfig.permissions : [];
}

/**
 * Check if user can access resource
 * @param {string} role - User role
 * @param {string} resource - Resource name
 * @param {string} action - Action to perform
 * @returns {boolean} Access granted
 */
function canAccessResource(role, resource, action) {
  const permission = `${resource}:${action}`;
  return hasPermission(role, permission);
}

/**
 * Middleware factory to require specific role
 * @param {string|Array} allowedRoles - Required role(s)
 * @returns {Function} Middleware function
 */
function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'This endpoint requires authentication',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `This endpoint requires one of the following roles: ${roles.join(', ')}`,
      });
    }

    next();
  };
}

/**
 * Middleware factory to require specific permission
 * @param {string|Array} requiredPermissions - Required permission(s)
 * @returns {Function} Middleware function
 */
function requirePermission(requiredPermissions) {
  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'This endpoint requires authentication',
      });
    }

    const hasRequiredPermission = permissions.some(permission =>
      hasPermission(req.user.role, permission),
    );

    if (!hasRequiredPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `This endpoint requires one of the following permissions: ${permissions.join(', ')}`,
      });
    }

    next();
  };
}

/**
 * Middleware factory to require minimum permission level
 * @param {number} minimumLevel - Minimum required level
 * @returns {Function} Middleware function
 */
function requireLevel(minimumLevel) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'This endpoint requires authentication',
      });
    }

    if (!hasLevel(req.user.role, minimumLevel)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `This endpoint requires permission level ${minimumLevel} or higher`,
      });
    }

    next();
  };
}

/**
 * Middleware to require admin role
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'This endpoint requires authentication',
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required',
      message: 'This endpoint requires admin privileges',
    });
  }

  next();
}

/**
 * Middleware to check resource ownership
 * User can access their own resources, admins can access all
 * @param {string} userIdParam - Parameter name containing user ID (default: 'userId')
 * @returns {Function} Middleware function
 */
function requireOwnershipOrAdmin(userIdParam = 'userId') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'This endpoint requires authentication',
      });
    }

    // Admins can access all resources
    if (req.user.role === 'admin') {
      return next();
    }

    // Get resource owner ID from params or body
    const resourceUserId = req.params[userIdParam] || req.body[userIdParam];

    // If no user ID specified, assume current user
    if (!resourceUserId) {
      return next();
    }

    // Check if user owns the resource
    if (req.user.id !== resourceUserId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own resources',
      });
    }

    next();
  };
}

/**
 * Middleware to check if user can modify profile
 * Users can modify their own profile, admins can modify any profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function canModifyProfile(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'This endpoint requires authentication',
    });
  }

  const targetUserId = req.params.id || req.params.userId || req.user.id;

  // Admins can modify any profile
  if (req.user.role === 'admin') {
    return next();
  }

  // Users can only modify their own profile
  if (req.user.id === targetUserId) {
    return next();
  }

  return res.status(403).json({
    error: 'Access denied',
    message: 'You can only modify your own profile',
  });
}

/**
 * Dynamic permission middleware based on route pattern
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function checkRoutePermission(req, res, next) {
  if (!req.user) {
    // Some routes might not require authentication
    return next();
  }

  const method = req.method;
  const path = req.route ? req.route.path : req.path;
  const routePattern = `${method}:${path}`;

  // Check if route has defined permission requirements
  const requiredPermission = PERMISSION_PATTERNS[routePattern];

  if (requiredPermission && !hasPermission(req.user.role, requiredPermission)) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: `This endpoint requires ${requiredPermission} permission`,
    });
  }

  next();
}

/**
 * Middleware to log authorization events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function logAuthorization(req, res, next) {
  const logger = require('../utils/logger');

  if (req.user) {
    logger.info(`Authorization check: ${req.method} ${req.path}`, {
      userId: req.user.id,
      role: req.user.role,
      permissions: getRolePermissions(req.user.role),
      ip: req.ip,
    });
  }

  next();
}

/**
 * Get available actions for user on resource
 * @param {string} role - User role
 * @param {string} resource - Resource name
 * @returns {Array} Available actions
 */
function getAvailableActions(role, resource) {
  const resourceActions = RESOURCES[resource] || [];
  return resourceActions.filter(action => canAccessResource(role, resource, action));
}

/**
 * Check if operation is allowed based on business rules
 * @param {Object} req - Express request object
 * @param {string} operation - Operation being performed
 * @returns {boolean} Operation allowed
 */
function checkBusinessRules(req, operation) {
  // Business rule: Users cannot delete their own account
  if (operation === 'user:delete' && req.params.id === req.user.id) {
    return false;
  }

  // Business rule: Cannot deactivate the last admin
  if (operation === 'user:deactivate' && req.user.role === 'admin') {
    // This would require checking if there are other active admins
    // Implementation depends on your business logic
  }

  return true;
}

/**
 * Middleware factory for business rule enforcement
 * @param {string} operation - Operation being performed
 * @returns {Function} Middleware function
 */
function enforceBusinessRules(operation) {
  return (req, res, next) => {
    if (!checkBusinessRules(req, operation)) {
      return res.status(409).json({
        error: 'Operation not allowed',
        message: 'This operation violates business rules',
      });
    }
    next();
  };
}

module.exports = {
  // Core functions
  hasPermission,
  hasLevel,
  getRolePermissions,
  canAccessResource,
  getAvailableActions,

  // Middleware factories
  requireRole,
  requirePermission,
  requireLevel,
  requireOwnershipOrAdmin,
  enforceBusinessRules,

  // Direct middleware
  requireAdmin,
  canModifyProfile,
  checkRoutePermission,
  logAuthorization,

  // Constants
  ROLES,
  RESOURCES,
  PERMISSION_PATTERNS,
};