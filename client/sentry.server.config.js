import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Filter sensitive data
  beforeSend(event, hint) {
    // Remove sensitive data from request
    if (event.request) {
      if (event.request.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
        delete event.request.headers['x-api-key'];
      }
      
      if (event.request.data) {
        if (typeof event.request.data === 'string') {
          try {
            const parsed = JSON.parse(event.request.data);
            if (parsed.password) parsed.password = '[REDACTED]';
            if (parsed.apiKey) parsed.apiKey = '[REDACTED]';
            event.request.data = JSON.stringify(parsed);
          } catch (e) {
            // Keep original if parsing fails
          }
        }
      }
    }

    return event;
  },

  // Set initial scope
  initialScope: {
    tags: {
      component: 'frontend-ssr',
    },
  },
});

export default Sentry;