import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Capture user interactions
  integrations: [
    new Sentry.BrowserTracing({
      // Capture interactions like clicks, navigation
      tracingOrigins: ['localhost', /^https:\/\/yourapi\.domain\.com\/api/],
      
      // Capture performance data for page loads and navigation
      routingInstrumentation: Sentry.nextRouterInstrumentation,
    }),
    new Sentry.Replay({
      // Capture 10% of sessions for replay in production, 100% in development
      sessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      // Capture 100% of sessions with an error for replay
      errorSampleRate: 1.0,
    }),
  ],

  // Capture unhandled promise rejections and exceptions
  captureUnhandledRejections: true,

  // Filter sensitive data
  beforeSend(event, hint) {
    // Remove sensitive data from URLs
    if (event.request && event.request.url) {
      event.request.url = event.request.url.replace(/([?&])(api_?key|token|password)=[^&]*/gi, '$1$2=[REDACTED]');
    }

    // Remove sensitive data from request data
    if (event.request && event.request.data) {
      if (typeof event.request.data === 'string') {
        try {
          const parsed = JSON.parse(event.request.data);
          if (parsed.password) parsed.password = '[REDACTED]';
          if (parsed.apiKey) parsed.apiKey = '[REDACTED]';
          if (parsed.token) parsed.token = '[REDACTED]';
          event.request.data = JSON.stringify(parsed);
        } catch (e) {
          // If parsing fails, keep original data
        }
      } else if (typeof event.request.data === 'object') {
        if (event.request.data.password) event.request.data.password = '[REDACTED]';
        if (event.request.data.apiKey) event.request.data.apiKey = '[REDACTED]';
        if (event.request.data.token) event.request.data.token = '[REDACTED]';
      }
    }

    // Remove sensitive headers
    if (event.request && event.request.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
      delete event.request.headers['x-api-key'];
    }

    return event;
  },

  // Set initial user context
  initialScope: {
    tags: {
      component: 'frontend',
    },
  },

  // Ignore certain errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    'originalCreateNotification',
    'canvas.contentDocument',
    'MyApp_RemoveAllHighlights',
    'http://tt.epicplay.com',
    "Can't find variable: ZiteReader",
    'jigsaw is not defined',
    'ComboSearch is not defined',
    'http://loading.retry.widdit.com/',
    'atomicFindClose',
    // Facebook borked
    'fb_xd_fragment',
    // ISP "optimizing" proxy - `Cache-Control: no-transform` seems to reduce this. (thanks @acdha)
    // See http://stackoverflow.com/questions/4113268
    'bmi_SafeAddOnload',
    'EBCallBackMessageReceived',
    // See http://toolbar.conduit.com/Developer/HtmlAndGadget/Methods/JSInjection.aspx
    'conduitPage',
    // Network errors
    'NetworkError',
    'Network request failed',
    'Failed to fetch',
    // WebSocket errors that are expected
    'WebSocket connection failed',
    'WebSocket is not open',
  ],

  // Ignore certain URLs
  denyUrls: [
    // Facebook flakiness
    /graph\.facebook\.com/i,
    // Facebook blocked
    /connect\.facebook\.net\/en_US\/all\.js/i,
    // Woopra flakiness
    /eatdifferent\.com\.woopra-ns\.com/i,
    /static\.woopra\.com\/js\/woopra\.js/i,
    // Chrome extensions
    /extensions\//i,
    /^chrome:\/\//i,
    // Other plugins
    /127\.0\.0\.1:4001\/isrunning/i, // Cacaoweb
    /webappstoolbarba\.texthelp\.com\//i,
    /metrics\.itunes\.apple\.com\.edgesuite\.net\//i,
  ],
});

export default Sentry;