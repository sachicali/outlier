# Queue System Implementation Guide

This document outlines the comprehensive job queue system implemented for the YouTube Outlier Discovery Tool using BullMQ and Redis.

## Overview

The queue system provides background processing capabilities to improve application performance and reliability. It handles heavy YouTube analysis tasks, batch processing, email notifications, and scheduled maintenance jobs.

## Architecture

### Components

1. **Queue Manager** (`src/queues/queueManager.js`)
   - Centralized queue management and configuration
   - Handles queue creation, job scheduling, and monitoring
   - Manages Redis connections and queue lifecycle

2. **Job Types** (`src/queues/jobTypes.js`)
   - Defines all job types, priorities, and configurations
   - Provides job validation and option creation utilities
   - Contains job schemas for data validation

3. **Workers** (`src/workers/`)
   - Background processes that execute queued jobs
   - Specialized processors for different job categories
   - Handles job retries, error handling, and progress tracking

4. **Queue Service** (`src/services/queueService.js`)
   - High-level API for interacting with the queue system
   - Provides convenient methods for adding jobs and monitoring
   - Integrates with existing application services

## Job Types

### YouTube Analysis Jobs
- **youtube-analysis**: Complete outlier analysis pipeline
- **exclusion-list-build**: Build exclusion database from competitor channels
- **channel-discovery**: Discover adjacent channels
- **outlier-detection**: Analyze individual channels for outliers
- **brand-fit-analysis**: Calculate brand compatibility scores

### Batch Processing Jobs
- **batch-channel-analysis**: Process multiple channels concurrently
- **batch-video-processing**: Bulk video analysis operations
- **bulk-data-import**: Import large datasets

### Scheduled Tasks
- **cleanup-old-analyses**: Remove old analysis data
- **refresh-cache**: Refresh YouTube API cache
- **sync-youtube-data**: Sync recent YouTube data
- **generate-reports**: Create system reports

### Email Notifications
- **analysis-complete-email**: Send completion notifications
- **error-notification-email**: Send error alerts
- **weekly-digest-email**: Send weekly activity summaries

### Data Cleanup
- **cleanup-failed-jobs**: Remove old failed jobs
- **cleanup-expired-cache**: Clean expired cache entries
- **cleanup-temp-files**: Remove temporary files
- **archive-old-data**: Archive historical data

## Queue Configuration

### Queue Types
1. **youtube-analysis**: High-priority YouTube processing (3 workers)
2. **batch-processing**: Medium-priority batch operations (2 workers)
3. **scheduled-tasks**: Low-priority maintenance tasks (1 worker)
4. **email-notifications**: Email sending (5 workers)
5. **data-cleanup**: Cleanup operations (1 worker)

### Job Options
- **Priority**: 1-100 (higher = more important)
- **Retry Logic**: Exponential backoff with configurable attempts
- **Timeouts**: Configurable per job type
- **Removal**: Automatic cleanup of completed/failed jobs

## Usage Examples

### Starting a YouTube Analysis
```javascript
const queueService = require('./src/services/queueService');

// Queue an analysis job
const job = await queueService.startYouTubeAnalysis(
  analysisId,
  config,
  userId,
  {
    priority: 75,
    socketRoom: `analysis-${analysisId}`
  }
);
```

### Monitoring Job Status
```javascript
// Get job status
const status = await queueService.getJobStatus('youtube-analysis', jobId);

// Get queue statistics
const stats = await queueService.getQueueStats();
```

### Sending Notifications
```javascript
// Send analysis complete email
const emailJob = await queueService.sendAnalysisCompleteEmail(
  userId,
  analysisId,
  results,
  customMessage
);
```

## Commands

### Worker Management
```bash
# Start workers in development
bun run worker:dev

# Start workers in production
bun run worker:start

# View queue dashboard
bun run queue:dashboard
```

### API Endpoints
```bash
# Queue statistics
GET /api/queues/stats

# Job status
GET /api/queues/jobs/:queueName/:jobId

# Start YouTube analysis job
POST /api/queues/jobs/youtube-analysis

# Retry failed job
POST /api/queues/jobs/:queueName/:jobId/retry

# Queue management (admin only)
POST /api/queues/queues/:queueName/pause
POST /api/queues/queues/:queueName/resume
POST /api/queues/queues/:queueName/clean
```

## Configuration

### Environment Variables
```bash
# Enable queue system
USE_QUEUE_SYSTEM=true

# Redis connection
REDIS_URL=redis://localhost:6379

# Worker concurrency
WORKER_CONCURRENCY_YOUTUBE=3
WORKER_CONCURRENCY_BATCH=2
WORKER_CONCURRENCY_EMAIL=5

# Scheduled jobs
ENABLE_CLEANUP_JOBS=true
ENABLE_CACHE_REFRESH=true
CLEANUP_ANALYSES_OLDER_THAN_DAYS=90

# Email configuration
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## Integration

### Backward Compatibility
The system maintains backward compatibility by:
- Falling back to direct processing if queue system fails
- Using environment variable `USE_QUEUE_SYSTEM` to enable/disable
- Preserving existing API endpoints and WebSocket functionality

### Real-time Updates
Queue jobs maintain real-time WebSocket updates by:
- Creating mock IO objects that emit progress events
- Updating job progress percentage during processing
- Maintaining socket room associations for analysis jobs

## Monitoring

### Queue Dashboard
Interactive command-line dashboard showing:
- Real-time queue statistics
- Active and failed job counts
- System resource usage
- Manual queue management controls

### Health Endpoints
```bash
# Queue system health
GET /api/queues/health

# Detailed queue statistics
GET /api/queues/stats
```

## Error Handling

### Retry Logic
- Exponential backoff for transient failures
- Configurable retry attempts per job type
- Dead letter queue for permanently failed jobs

### Failure Recovery
- Automatic job cleanup after specified time
- Failed job monitoring and alerting
- Graceful degradation to direct processing

## Scheduled Jobs

### Automatic Maintenance
The system includes automated maintenance jobs:
- Daily cleanup of old analyses (2 AM)
- Cache refresh every 6 hours
- Failed job cleanup daily (3 AM)
- Weekly digest emails (Mondays 9 AM)
- Monthly data archiving (1st day, 1 AM)

### Manual Scheduling
```javascript
// Schedule custom cleanup
const job = await queueService.scheduleCleanupOldAnalyses(90, 100);

// Schedule cache refresh
const cacheJob = await queueService.scheduleRefreshCache('all', true);
```

## Performance Benefits

1. **Non-blocking Operations**: Heavy YouTube API calls don't block the main server
2. **Scalability**: Workers can be scaled independently
3. **Reliability**: Job persistence and retry mechanisms
4. **Resource Management**: Better CPU and memory utilization
5. **User Experience**: Immediate response with background processing

## Security

### Access Control
- All queue endpoints require authentication
- Role-based permissions for queue management
- Admin-only access for sensitive operations

### Data Protection
- Job data encryption in Redis
- Secure job result storage
- Audit logging for queue operations

## Deployment

### Production Setup
1. Ensure Redis is running and configured
2. Set environment variables for queue system
3. Start worker processes alongside main server
4. Configure scheduled jobs manager
5. Monitor queue health and performance

### Docker Deployment
```bash
# Start main server
docker run -d --name outlier-server outlier-app:latest

# Start workers
docker run -d --name outlier-workers outlier-app:latest bun run worker:start

# Start scheduled jobs
docker run -d --name outlier-scheduler outlier-app:latest bun src/scripts/setupScheduledJobs.js
```

## Troubleshooting

### Common Issues
1. **Redis Connection Errors**: Check Redis URL and credentials
2. **Worker Not Starting**: Verify environment variables and dependencies
3. **Jobs Stuck**: Use queue dashboard to monitor and manually retry
4. **Memory Usage**: Monitor Redis memory and configure job cleanup

### Debugging
```bash
# View queue dashboard
bun run queue:dashboard

# Check worker logs
tail -f server/logs/combined.log | grep "Worker"

# Monitor Redis
redis-cli monitor
```

## Future Enhancements

1. **Advanced Scheduling**: Cron-based job scheduling interface
2. **Job Dependencies**: Chain jobs with dependencies
3. **Priority Queues**: User-based priority levels
4. **Metrics Collection**: Enhanced monitoring and analytics
5. **Job Templates**: Pre-configured job templates for common tasks
6. **Horizontal Scaling**: Multi-server worker deployment
7. **Real-time Dashboard**: Web-based queue monitoring interface

This implementation provides a robust foundation for background processing while maintaining simplicity and reliability.