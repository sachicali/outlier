# YouTube Outlier Discovery - Monitoring Setup

This directory contains the comprehensive monitoring setup for the YouTube Outlier Discovery Tool, providing full observability through metrics, logs, traces, and alerts.

## Overview

The monitoring stack includes:

- **OpenTelemetry**: Distributed tracing and telemetry
- **Sentry**: Error tracking and performance monitoring
- **Prometheus**: Metrics collection and storage
- **Grafana**: Dashboards and visualization
- **Jaeger**: Distributed tracing UI
- **AlertManager**: Alert routing and management

## Quick Start

### 1. Environment Configuration

Create `.env` file in the server directory with monitoring variables:

```bash
# Sentry Configuration
SENTRY_DSN=your_sentry_dsn_here
NEXT_PUBLIC_SENTRY_DSN=your_frontend_sentry_dsn_here

# OpenTelemetry Configuration
OTEL_ENABLED=true
JAEGER_ENDPOINT=http://localhost:14268/api/traces

# Redis for Quota Tracking
REDIS_URL=redis://localhost:6379

# Alert Configuration
SLACK_WEBHOOK_URL=your_slack_webhook_url
ALERT_EMAIL_FROM=alerts@yourdomain.com
ALERT_EMAIL_TO=admin@yourdomain.com

# Quota Thresholds
YOUTUBE_DAILY_QUOTA_LIMIT=10000
YOUTUBE_QUOTA_WARNING_THRESHOLD=8000
YOUTUBE_QUOTA_CRITICAL_THRESHOLD=9500
```

### 2. Start Monitoring Stack

```bash
# Basic monitoring (Prometheus, Grafana, Jaeger)
cd monitoring
docker-compose -f docker-compose.monitoring.yml up -d

# With alerting
docker-compose -f docker-compose.monitoring.yml --profile with-alerting up -d

# With log aggregation
docker-compose -f docker-compose.monitoring.yml --profile with-logs up -d

# Full stack
docker-compose -f docker-compose.monitoring.yml --profile with-alerting --profile with-logs up -d
```

### 3. Access Monitoring UIs

- **Grafana**: http://localhost:3001 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686
- **AlertManager**: http://localhost:9093

### 4. Install Dependencies

```bash
# Backend dependencies
cd server
bun install

# Frontend dependencies  
cd client
bun install
```

## Monitoring Features

### 1. Application Performance Monitoring (APM)

- **OpenTelemetry Integration**: Automatic instrumentation for HTTP, database, and Redis operations
- **Custom Business Logic Tracing**: YouTube API calls, analysis operations, and user workflows
- **Performance Metrics**: Response times, throughput, and error rates
- **Distributed Tracing**: End-to-end request tracing across services

### 2. Error Tracking

- **Sentry Integration**: Automatic error capture and reporting
- **Context-Rich Errors**: User context, request details, and business context
- **Error Grouping**: Intelligent error aggregation and deduplication
- **Performance Issues**: Slow queries, N+1 problems, and bottlenecks
- **Source Maps**: Frontend error mapping to original source code

### 3. Custom Metrics

#### Business Metrics
- YouTube API quota usage and remaining quota
- Analysis success/failure rates
- Outlier videos discovered
- Channel analysis throughput
- User engagement metrics

#### Technical Metrics
- HTTP request rates and response times
- Database query performance
- Memory and CPU usage
- WebSocket connection counts
- Authentication attempt rates

### 4. Health Monitoring

#### Health Check Endpoints
- `/health` - Overall system health
- `/health/liveness` - Kubernetes liveness probe
- `/health/readiness` - Kubernetes readiness probe  
- `/health/deep` - Detailed component health

#### Component Monitoring
- Database connectivity and performance
- Redis connectivity and operations
- YouTube API availability and quota
- System resources (CPU, memory, disk)
- External service dependencies

### 5. Alerting System

#### Alert Rules
- **Critical**: Service down, database failures, critical errors
- **Warning**: High error rates, quota warnings, performance degradation
- **Info**: Quota resets, system events

#### Alert Channels
- Slack notifications with rich formatting
- Email alerts with detailed context
- Webhook integrations for custom systems
- Sentry issue creation

### 6. Frontend Monitoring

#### Performance Monitoring
- Core Web Vitals (CLS, FID, FCP, LCP, TTFB)
- Custom performance metrics
- Component render times
- API call performance
- Resource loading times
- Long task detection

#### Error Tracking
- JavaScript errors and unhandled rejections
- Component error boundaries
- User action tracking
- Session replay for error investigation

## API Endpoints

### Monitoring Endpoints

```bash
# Metrics (Prometheus format)
GET /metrics

# Health checks
GET /health
GET /health/liveness  
GET /health/readiness
GET /health/deep

# Quota monitoring
GET /monitoring/quota
GET /monitoring/quota/history?days=7

# Alert management
GET /monitoring/alerts/history?hours=24
GET /monitoring/alerts/status
POST /monitoring/alerts/silence
POST /monitoring/alerts/test

# System status
GET /monitoring/status
```

## Dashboard Configuration

### Grafana Dashboards

Pre-configured dashboards include:

1. **System Overview**: Service health, uptime, and basic metrics
2. **HTTP Performance**: Request rates, response times, and error rates
3. **YouTube API**: Quota usage, API performance, and error tracking
4. **Business Metrics**: Analysis operations, outliers found, user activity
5. **Database Performance**: Query times, connection pools, and health
6. **System Resources**: CPU, memory, disk usage
7. **Error Tracking**: Error rates, types, and trends

### Custom Metrics Integration

```javascript
// Backend - Custom business metrics
const { monitoring } = require('./monitoring');

// Trace YouTube API operations
await monitoring.traceYouTubeAPI('channel.list', async () => {
  // API call implementation
}, quotaCost);

// Trace analysis operations
await monitoring.traceAnalysis('outlier_detection', channelId, async () => {
  // Analysis implementation
});

// Record quota usage
await monitoring.recordQuotaUsage('search.list', 100, {
  channelId,
  userId: req.user.id
});
```

```javascript
// Frontend - Performance monitoring
import { monitoring, performanceMonitor } from './utils/monitoring';

// Track user actions
monitoring.trackAction('analysis_started', { channelId });

// Track API calls
monitoring.trackAPICall('POST', '/api/outlier/analyze', 200, 1500);

// Track analysis operations
monitoring.trackAnalysis('outlier_detection', channelId, 'success', {
  videosAnalyzed: 150,
  outliersFound: 5
});
```

## Alert Configuration

### Slack Integration

```yaml
# alertmanager.yml
route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'slack-notifications'

receivers:
- name: 'slack-notifications'
  slack_configs:
  - api_url: 'YOUR_SLACK_WEBHOOK_URL'
    channel: '#alerts'
    title: 'Outlier Discovery Alert'
    text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
```

### Email Alerts

```javascript
// Environment variables
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ALERT_EMAIL_FROM=alerts@yourdomain.com
ALERT_EMAIL_TO=admin@yourdomain.com,ops@yourdomain.com
```

## Troubleshooting

### Common Issues

1. **Sentry not capturing errors**
   - Check SENTRY_DSN configuration
   - Verify network connectivity
   - Check error filtering rules

2. **Metrics not appearing in Prometheus**
   - Verify /metrics endpoint accessibility
   - Check Prometheus configuration
   - Ensure application is running

3. **Traces not showing in Jaeger**
   - Verify JAEGER_ENDPOINT configuration
   - Check OpenTelemetry initialization
   - Ensure Jaeger is running

4. **Quota tracking not working**
   - Verify Redis connectivity
   - Check REDIS_URL configuration
   - Ensure quota tracker initialization

### Debug Mode

Enable debug logging:

```bash
# Backend
LOG_LEVEL=debug

# Frontend
NEXT_PUBLIC_DEBUG=true
```

## Production Considerations

### Security
- Use environment-specific Sentry projects
- Secure monitoring endpoints with authentication
- Filter sensitive data from traces and logs
- Use secure connections (HTTPS/TLS)

### Performance
- Configure appropriate sampling rates for traces
- Set up metric retention policies
- Use efficient alert routing
- Monitor monitoring system resource usage

### Scalability
- Consider external monitoring services for production
- Set up monitoring data backup and retention
- Implement monitoring data archival
- Scale monitoring infrastructure with application growth

## Support

For monitoring-related issues:

1. Check application logs in `server/logs/`
2. Verify monitoring system health in Grafana
3. Review Sentry error reports
4. Check Prometheus targets and alerts
5. Validate configuration files

## Advanced Configuration

### Custom Instrumentations

Add custom OpenTelemetry instrumentations:

```javascript
// server/src/monitoring/telemetry.js
const customInstrumentation = new MyCustomInstrumentation();
sdk.addInstrumentation(customInstrumentation);
```

### Metric Retention

Configure Prometheus retention:

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  external_labels:
    monitor: 'outlier-discovery'

rule_files:
  - "alert-rules.yml"

# Retention configuration in docker-compose
command:
  - '--storage.tsdb.retention.time=90d'
  - '--storage.tsdb.retention.size=10GB'
```

This monitoring setup provides comprehensive observability for the YouTube Outlier Discovery Tool, enabling proactive monitoring, rapid issue detection, and data-driven optimization.