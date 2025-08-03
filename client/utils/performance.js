import { useRef, useEffect } from 'react';
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';
import { monitoring } from './monitoring';

// Performance thresholds based on Core Web Vitals
const PERFORMANCE_THRESHOLDS = {
  CLS: { good: 0.1, poor: 0.25 },
  FID: { good: 100, poor: 300 },
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
};

// Custom performance metrics
let performanceMetrics = {
  pageLoads: 0,
  interactions: 0,
  errors: 0,
  slowOperations: 0,
};

// Performance observer for custom metrics
let performanceObserver;

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = [];
    this.initialized = false;
  }

  initialize() {
    if (typeof window === 'undefined') return; // Server-side rendering guard
    
    // Initialize Core Web Vitals monitoring
    this.initializeWebVitals();
    
    // Initialize custom performance monitoring
    this.initializeCustomMetrics();
    
    // Initialize resource timing monitoring
    this.initializeResourceTiming();
    
    // Initialize navigation timing
    this.initializeNavigationTiming();
    
    this.initialized = true;
  }

  initializeWebVitals() {
    // Cumulative Layout Shift
    getCLS((metric) => {
      this.reportWebVital('CLS', metric);
    });

    // First Input Delay
    getFID((metric) => {
      this.reportWebVital('FID', metric);
    });

    // First Contentful Paint
    getFCP((metric) => {
      this.reportWebVital('FCP', metric);
    });

    // Largest Contentful Paint
    getLCP((metric) => {
      this.reportWebVital('LCP', metric);
    });

    // Time to First Byte
    getTTFB((metric) => {
      this.reportWebVital('TTFB', metric);
    });
  }

  reportWebVital(name, metric) {
    const value = metric.value;
    const threshold = PERFORMANCE_THRESHOLDS[name];
    
    let rating = 'good';
    if (value > threshold.poor) {
      rating = 'poor';
    } else if (value > threshold.good) {
      rating = 'needs-improvement';
    }

    // Store metric
    this.metrics.set(name, {
      value,
      rating,
      timestamp: Date.now(),
      delta: metric.delta,
      id: metric.id,
    });

    // Report to monitoring
    monitoring.addBreadcrumb(
      `Web Vital: ${name}`,
      'performance',
      rating === 'poor' ? 'warning' : 'info',
      {
        metric: name,
        value,
        rating,
        threshold: threshold.good,
      }
    );

    // Report poor metrics as errors
    if (rating === 'poor') {
      monitoring.captureMessage(
        `Poor ${name} performance detected`,
        'warning',
        {
          extra: {
            metric: name,
            value,
            rating,
            threshold,
            url: window.location.href,
            userAgent: navigator.userAgent,
          },
          business: {
            domain: 'performance',
            metric: name,
            rating,
          },
        }
      );
    }
  }

  initializeCustomMetrics() {
    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackMetric('page_hidden', Date.now());
      } else {
        this.trackMetric('page_visible', Date.now());
      }
    });

    // Track unload events
    window.addEventListener('beforeunload', () => {
      this.reportSessionMetrics();
    });

    // Track errors
    window.addEventListener('error', (event) => {
      performanceMetrics.errors++;
      this.trackMetric('javascript_error', Date.now(), {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      performanceMetrics.errors++;
      this.trackMetric('unhandled_rejection', Date.now(), {
        reason: event.reason?.toString(),
      });
    });
  }

  initializeResourceTiming() {
    if (!('PerformanceObserver' in window)) return;

    // Observe resource loading
    const resourceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.analyzeResourceTiming(entry);
      }
    });

    resourceObserver.observe({ entryTypes: ['resource'] });
    this.observers.push(resourceObserver);

    // Observe long tasks
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.analyzeLongTask(entry);
      }
    });

    try {
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      this.observers.push(longTaskObserver);
    } catch (e) {
      // Long task API not supported - graceful fallback for older browsers
    }
  }

  initializeNavigationTiming() {
    if (!performance.navigation) return;

    // Analyze navigation timing after page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        this.analyzeNavigationTiming();
      }, 1000); // Wait a bit for all metrics to be available
    });
  }

  analyzeResourceTiming(entry) {
    const duration = entry.responseEnd - entry.startTime;
    const isSlowResource = duration > 3000; // 3 seconds

    if (isSlowResource) {
      performanceMetrics.slowOperations++;
      
      monitoring.addBreadcrumb(
        'Slow resource load',
        'performance',
        'warning',
        {
          name: entry.name,
          duration,
          size: entry.transferSize,
          type: entry.initiatorType,
        }
      );

      // Report very slow resources
      if (duration > 10000) { // 10 seconds
        monitoring.captureMessage(
          'Very slow resource load detected',
          'warning',
          {
            extra: {
              resourceName: entry.name,
              duration,
              transferSize: entry.transferSize,
              initiatorType: entry.initiatorType,
              url: window.location.href,
            },
            business: {
              domain: 'performance',
              metric: 'slow_resource',
              resourceType: entry.initiatorType,
            },
          }
        );
      }
    }

    // Track resource metrics
    this.trackMetric('resource_load', duration, {
      name: entry.name,
      type: entry.initiatorType,
      size: entry.transferSize,
    });
  }

  analyzeLongTask(entry) {
    const duration = entry.duration;
    
    monitoring.addBreadcrumb(
      'Long task detected',
      'performance',
      'warning',
      {
        duration,
        startTime: entry.startTime,
      }
    );

    // Report very long tasks
    if (duration > 100) { // 100ms
      performanceMetrics.slowOperations++;
      
      monitoring.captureMessage(
        'Long task blocking main thread',
        'warning',
        {
          extra: {
            duration,
            startTime: entry.startTime,
            url: window.location.href,
          },
          business: {
            domain: 'performance',
            metric: 'long_task',
          },
        }
      );
    }
  }

  analyzeNavigationTiming() {
    if (!performance.timing) return;

    const timing = performance.timing;
    const navigation = performance.navigation;

    const metrics = {
      // DNS lookup time
      dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
      
      // TCP connection time
      tcpConnection: timing.connectEnd - timing.connectStart,
      
      // Server response time
      serverResponse: timing.responseStart - timing.requestStart,
      
      // DOM processing time
      domProcessing: timing.domComplete - timing.domLoading,
      
      // Page load time
      pageLoad: timing.loadEventEnd - timing.navigationStart,
      
      // Time to interactive
      timeToInteractive: timing.domInteractive - timing.navigationStart,
      
      // Navigation type
      navigationType: navigation.type,
      
      // Redirect count
      redirectCount: navigation.redirectCount,
    };

    // Report metrics
    Object.entries(metrics).forEach(([name, value]) => {
      this.trackMetric(`navigation_${name}`, value);
    });

    // Check for performance issues
    if (metrics.pageLoad > 10000) { // 10 seconds
      monitoring.captureMessage(
        'Slow page load detected',
        'warning',
        {
          extra: {
            ...metrics,
            url: window.location.href,
          },
          business: {
            domain: 'performance',
            metric: 'slow_page_load',
          },
        }
      );
    }
  }

  trackMetric(name, value, context = {}) {
    this.metrics.set(`${name}_${Date.now()}`, {
      name,
      value,
      context,
      timestamp: Date.now(),
      url: window.location.href,
    });
  }

  // Track user interactions
  trackInteraction(type, element, duration = 0) {
    performanceMetrics.interactions++;
    
    monitoring.addBreadcrumb(
      `User interaction: ${type}`,
      'user-action',
      'info',
      {
        type,
        element: element?.tagName || 'unknown',
        duration,
      }
    );

    if (duration > 100) { // Slow interaction
      monitoring.trackPerformance(`interaction_${type}`, duration, {
        element: element?.tagName,
      });
    }
  }

  // Track API call performance
  trackAPICall(method, url, duration, status) {
    this.trackMetric('api_call', duration, {
      method,
      url: url.replace(/([?&])(api_?key|token)=[^&]*/gi, '$1$2=[REDACTED]'),
      status,
    });

    monitoring.trackAPICall(method, url, status, duration);

    // Report slow API calls
    if (duration > 5000) { // 5 seconds
      monitoring.captureMessage(
        'Slow API call detected',
        'warning',
        {
          extra: {
            method,
            url: url.replace(/([?&])(api_?key|token)=[^&]*/gi, '$1$2=[REDACTED]'),
            duration,
            status,
          },
          business: {
            domain: 'api_performance',
            endpoint: url.split('?')[0],
            method,
          },
        }
      );
    }
  }

  // Track component render performance
  trackComponentRender(componentName, duration) {
    this.trackMetric('component_render', duration, {
      component: componentName,
    });

    if (duration > 16) { // 60fps = 16.67ms per frame
      monitoring.addBreadcrumb(
        `Slow component render: ${componentName}`,
        'performance',
        'warning',
        {
          component: componentName,
          duration,
        }
      );
    }
  }

  // Get performance summary
  getPerformanceSummary() {
    const webVitals = {};
    const customMetrics = {};

    // Extract web vitals
    ['CLS', 'FID', 'FCP', 'LCP', 'TTFB'].forEach(vital => {
      if (this.metrics.has(vital)) {
        webVitals[vital] = this.metrics.get(vital);
      }
    });

    // Count custom metrics
    for (const [key, metric] of this.metrics.entries()) {
      if (!webVitals[key]) {
        const category = metric.name.split('_')[0];
        if (!customMetrics[category]) {
          customMetrics[category] = { count: 0, total: 0, avg: 0 };
        }
        customMetrics[category].count++;
        customMetrics[category].total += metric.value;
        customMetrics[category].avg = customMetrics[category].total / customMetrics[category].count;
      }
    }

    return {
      webVitals,
      customMetrics,
      counters: performanceMetrics,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    };
  }

  reportSessionMetrics() {
    const summary = this.getPerformanceSummary();
    
    monitoring.captureMessage(
      'Performance session summary',
      'info',
      {
        extra: summary,
        business: {
          domain: 'performance_session',
          pageLoads: performanceMetrics.pageLoads,
          interactions: performanceMetrics.interactions,
          errors: performanceMetrics.errors,
        },
      }
    );
  }

  // Clean up observers
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// React hook for component performance monitoring
export const useComponentPerformance = (componentName) => {
  const startTime = useRef(Date.now());
  
  useEffect(() => {
    return () => {
      const duration = Date.now() - startTime.current;
      performanceMonitor.trackComponentRender(componentName, duration);
    };
  }, [componentName]);
};

// Higher-order component for performance monitoring
export const withPerformanceMonitoring = (WrappedComponent, componentName) => {
  return function PerformanceMonitoredComponent(props) {
    const startTime = useRef(Date.now());
    
    useEffect(() => {
      return () => {
        const duration = Date.now() - startTime.current;
        performanceMonitor.trackComponentRender(componentName, duration);
      };
    }, []);
    
    return <WrappedComponent {...props} />;
  };
};

// API call performance wrapper
export const withAPIPerformanceTracking = (apiCall) => {
  return async (...args) => {
    const startTime = Date.now();
    let method = 'unknown';
    let url = 'unknown';
    let status = 0;
    
    try {
      // Extract method and URL from axios config
      if (args[0] && typeof args[0] === 'object') {
        method = args[0].method || 'GET';
        url = args[0].url || 'unknown';
      } else if (typeof args[0] === 'string') {
        url = args[0];
        method = 'GET';
      }
      
      const result = await apiCall(...args);
      
      status = result.status || 200;
      const duration = Date.now() - startTime;
      
      performanceMonitor.trackAPICall(method, url, duration, status);
      
      return result;
    } catch (error) {
      status = error.response?.status || 0;
      const duration = Date.now() - startTime;
      
      performanceMonitor.trackAPICall(method, url, duration, status);
      
      throw error;
    }
  };
};

// Initialize performance monitoring when module loads
if (typeof window !== 'undefined') {
  // Initialize after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      performanceMonitor.initialize();
    });
  } else {
    performanceMonitor.initialize();
  }
}

export {
  performanceMonitor,
  PERFORMANCE_THRESHOLDS,
};

export default performanceMonitor;