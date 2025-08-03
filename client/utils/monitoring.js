import * as Sentry from '@sentry/nextjs';

// Frontend monitoring utilities
export const monitoring = {
  // Set user context
  setUser: (user) => {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  },

  // Clear user context
  clearUser: () => {
    Sentry.setUser(null);
  },

  // Capture exception with context
  captureException: (error, context = {}) => {
    Sentry.withScope((scope) => {
      // Add user context
      if (context.user) {
        scope.setUser(context.user);
      }

      // Add page context
      if (context.page) {
        scope.setTag('page', context.page);
      }

      // Add action context
      if (context.action) {
        scope.setTag('action', context.action);
      }

      // Add extra context
      if (context.extra) {
        Object.keys(context.extra).forEach(key => {
          scope.setExtra(key, context.extra[key]);
        });
      }

      // Add business context
      if (context.business) {
        scope.setContext('business', context.business);
      }

      Sentry.captureException(error);
    });
  },

  // Capture message
  captureMessage: (message, level = 'info', context = {}) => {
    Sentry.withScope((scope) => {
      scope.setLevel(level);
      
      if (context.user) {
        scope.setUser(context.user);
      }
      
      if (context.extra) {
        Object.keys(context.extra).forEach(key => {
          scope.setExtra(key, context.extra[key]);
        });
      }
      
      Sentry.captureMessage(message);
    });
  },

  // Add breadcrumb
  addBreadcrumb: (message, category = 'user-action', level = 'info', data = {}) => {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  },

  // Track page view
  trackPageView: (pageName, properties = {}) => {
    monitoring.addBreadcrumb(`Page view: ${pageName}`, 'navigation', 'info', properties);
  },

  // Track user action
  trackAction: (action, properties = {}) => {
    monitoring.addBreadcrumb(`User action: ${action}`, 'user-action', 'info', properties);
  },

  // Track API call
  trackAPICall: (method, url, status, duration = 0) => {
    monitoring.addBreadcrumb(
      `API call: ${method} ${url}`,
      'http',
      status >= 400 ? 'error' : 'info',
      {
        method,
        url: url.replace(/([?&])(api_?key|token)=[^&]*/gi, '$1$2=[REDACTED]'), // Remove sensitive params
        status,
        duration,
      }
    );
  },

  // Track analysis operation
  trackAnalysis: (operation, channelId, status, details = {}) => {
    monitoring.addBreadcrumb(
      `Analysis: ${operation}`,
      'business',
      status === 'success' ? 'info' : 'error',
      {
        operation,
        channelId,
        status,
        ...details,
      }
    );

    // Capture business metrics
    if (status === 'success') {
      monitoring.captureMessage(`Analysis completed: ${operation}`, 'info', {
        business: {
          domain: 'outlier_analysis',
          operation,
          channelId,
          ...details,
        },
      });
    }
  },

  // Track performance
  trackPerformance: (name, duration, context = {}) => {
    monitoring.addBreadcrumb(
      `Performance: ${name}`,
      'performance',
      'info',
      {
        name,
        duration,
        ...context,
      }
    );

    // Report slow operations
    if (duration > 5000) { // More than 5 seconds
      monitoring.captureMessage(`Slow operation detected: ${name}`, 'warning', {
        extra: {
          operation: name,
          duration,
          ...context,
        },
      });
    }
  },

  // Start performance transaction
  startTransaction: (name, op = 'pageload') => {
    return Sentry.startTransaction({
      name,
      op,
    });
  },

  // Error boundary handler
  errorBoundaryHandler: (error, errorInfo, componentStack) => {
    monitoring.captureException(error, {
      extra: {
        errorInfo,
        componentStack,
      },
      business: {
        domain: 'react_error_boundary',
      },
    });
  },

  // YouTube API specific tracking
  trackYouTubeAPI: (operation, status, quotaUsed = 0, details = {}) => {
    monitoring.addBreadcrumb(
      `YouTube API: ${operation}`,
      'api',
      status === 'success' ? 'info' : 'error',
      {
        operation,
        status,
        quotaUsed,
        ...details,
      }
    );

    if (status === 'error' || quotaUsed > 1000) {
      monitoring.captureMessage(`YouTube API ${status}: ${operation}`, status === 'error' ? 'error' : 'warning', {
        extra: {
          operation,
          quotaUsed,
          ...details,
        },
        business: {
          domain: 'youtube_api',
          operation,
          quotaUsed,
        },
      });
    }
  },

  // WebSocket tracking
  trackWebSocket: (event, data = {}) => {
    monitoring.addBreadcrumb(
      `WebSocket: ${event}`,
      'websocket',
      'info',
      {
        event,
        ...data,
      }
    );
  },

  // Authentication tracking
  trackAuth: (action, status, method = 'jwt') => {
    monitoring.addBreadcrumb(
      `Auth: ${action}`,
      'auth',
      status === 'success' ? 'info' : 'warning',
      {
        action,
        status,
        method,
      }
    );

    if (status === 'error') {
      monitoring.captureMessage(`Authentication failed: ${action}`, 'warning', {
        extra: {
          action,
          method,
        },
        business: {
          domain: 'authentication',
          action,
        },
      });
    }
  },
};

// Enhanced error boundary component
export const withMonitoring = (WrappedComponent) => {
  return class MonitoredComponent extends React.Component {
    componentDidCatch(error, errorInfo) {
      monitoring.errorBoundaryHandler(error, errorInfo, errorInfo.componentStack);
    }

    render() {
      return <WrappedComponent {...this.props} />;
    }
  };
};

// Performance monitoring hook
export const usePerformanceMonitoring = (operationName) => {
  const startTime = useRef(Date.now());
  
  useEffect(() => {
    return () => {
      const duration = Date.now() - startTime.current;
      monitoring.trackPerformance(operationName, duration);
    };
  }, [operationName]);
  
  return {
    trackOperation: (name, customDuration) => {
      const duration = customDuration || (Date.now() - startTime.current);
      monitoring.trackPerformance(name, duration);
    },
  };
};

export default monitoring;