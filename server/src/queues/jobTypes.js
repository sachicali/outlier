// Job type constants and configurations
const JOB_TYPES = {
  // YouTube Analysis Jobs
  YOUTUBE_ANALYSIS: 'youtube-analysis',
  EXCLUSION_LIST_BUILD: 'exclusion-list-build',
  CHANNEL_DISCOVERY: 'channel-discovery',
  OUTLIER_DETECTION: 'outlier-detection',
  BRAND_FIT_ANALYSIS: 'brand-fit-analysis',
  
  // Batch Processing Jobs
  BATCH_CHANNEL_ANALYSIS: 'batch-channel-analysis',
  BATCH_VIDEO_PROCESSING: 'batch-video-processing',
  BULK_DATA_IMPORT: 'bulk-data-import',
  
  // Scheduled Tasks
  CLEANUP_OLD_ANALYSES: 'cleanup-old-analyses',
  REFRESH_CACHE: 'refresh-cache',
  SYNC_YOUTUBE_DATA: 'sync-youtube-data',
  GENERATE_REPORTS: 'generate-reports',
  
  // Email Notifications
  ANALYSIS_COMPLETE_EMAIL: 'analysis-complete-email',
  ERROR_NOTIFICATION_EMAIL: 'error-notification-email',
  WEEKLY_DIGEST_EMAIL: 'weekly-digest-email',
  
  // Data Cleanup
  CLEANUP_FAILED_JOBS: 'cleanup-failed-jobs',
  CLEANUP_EXPIRED_CACHE: 'cleanup-expired-cache',
  CLEANUP_TEMP_FILES: 'cleanup-temp-files',
  ARCHIVE_OLD_DATA: 'archive-old-data',
};

const JOB_PRIORITIES = {
  CRITICAL: 100,
  HIGH: 75,
  NORMAL: 50,
  LOW: 25,
  CLEANUP: 10,
};

const JOB_QUEUES = {
  YOUTUBE_ANALYSIS: 'youtube-analysis',
  BATCH_PROCESSING: 'batch-processing',
  SCHEDULED_TASKS: 'scheduled-tasks',
  EMAIL_NOTIFICATIONS: 'email-notifications',
  DATA_CLEANUP: 'data-cleanup',
};

// Job configuration templates
const JOB_CONFIGS = {
  [JOB_TYPES.YOUTUBE_ANALYSIS]: {
    queue: JOB_QUEUES.YOUTUBE_ANALYSIS,
    priority: JOB_PRIORITIES.HIGH,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
  
  [JOB_TYPES.EXCLUSION_LIST_BUILD]: {
    queue: JOB_QUEUES.YOUTUBE_ANALYSIS,
    priority: JOB_PRIORITIES.HIGH,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
  },
  
  [JOB_TYPES.CHANNEL_DISCOVERY]: {
    queue: JOB_QUEUES.YOUTUBE_ANALYSIS,
    priority: JOB_PRIORITIES.NORMAL,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
  
  [JOB_TYPES.OUTLIER_DETECTION]: {
    queue: JOB_QUEUES.YOUTUBE_ANALYSIS,
    priority: JOB_PRIORITIES.NORMAL,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
  
  [JOB_TYPES.BATCH_CHANNEL_ANALYSIS]: {
    queue: JOB_QUEUES.BATCH_PROCESSING,
    priority: JOB_PRIORITIES.NORMAL,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
  },
  
  [JOB_TYPES.CLEANUP_OLD_ANALYSES]: {
    queue: JOB_QUEUES.SCHEDULED_TASKS,
    priority: JOB_PRIORITIES.LOW,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 60000,
    },
  },
  
  [JOB_TYPES.ANALYSIS_COMPLETE_EMAIL]: {
    queue: JOB_QUEUES.EMAIL_NOTIFICATIONS,
    priority: JOB_PRIORITIES.NORMAL,
    attempts: 3,
    backoff: {
      type: 'fixed',
      delay: 30000,
    },
  },
  
  [JOB_TYPES.CLEANUP_FAILED_JOBS]: {
    queue: JOB_QUEUES.DATA_CLEANUP,
    priority: JOB_PRIORITIES.CLEANUP,
    attempts: 1,
    removeOnComplete: 5,
    removeOnFail: 5,
  },
};

// Job data validation schemas
const JOB_SCHEMAS = {
  [JOB_TYPES.YOUTUBE_ANALYSIS]: {
    required: ['analysisId', 'config', 'userId'],
    optional: ['socketRoom', 'priority'],
  },
  
  [JOB_TYPES.EXCLUSION_LIST_BUILD]: {
    required: ['channelNames', 'timeWindowDays'],
    optional: ['analysisId'],
  },
  
  [JOB_TYPES.CHANNEL_DISCOVERY]: {
    required: ['searchQueries', 'subscriberRange'],
    optional: ['analysisId', 'maxResults'],
  },
  
  [JOB_TYPES.OUTLIER_DETECTION]: {
    required: ['channelInfo', 'timeWindowDays'],
    optional: ['analysisId', 'exclusionGames'],
  },
  
  [JOB_TYPES.ANALYSIS_COMPLETE_EMAIL]: {
    required: ['userId', 'analysisId', 'results'],
    optional: ['customMessage'],
  },
  
  [JOB_TYPES.CLEANUP_OLD_ANALYSES]: {
    required: ['olderThanDays'],
    optional: ['batchSize'],
  },
};

// Helper functions
function getJobConfig(jobType) {
  return JOB_CONFIGS[jobType] || {
    queue: JOB_QUEUES.YOUTUBE_ANALYSIS,
    priority: JOB_PRIORITIES.NORMAL,
    attempts: 2,
  };
}

function validateJobData(jobType, data) {
  const schema = JOB_SCHEMAS[jobType];
  if (!schema) {
    throw new Error(`Unknown job type: ${jobType}`);
  }
  
  const errors = [];
  
  // Check required fields
  for (const field of schema.required) {
    if (!(field in data) || data[field] === null || data[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Job validation failed: ${errors.join(', ')}`);
  }
  
  return true;
}

function createJobOptions(jobType, customOptions = {}) {
  const config = getJobConfig(jobType);
  
  return {
    priority: config.priority,
    attempts: config.attempts,
    backoff: config.backoff,
    removeOnComplete: config.removeOnComplete,
    removeOnFail: config.removeOnFail,
    ...customOptions,
  };
}

module.exports = {
  JOB_TYPES,
  JOB_PRIORITIES,
  JOB_QUEUES,
  JOB_CONFIGS,
  JOB_SCHEMAS,
  getJobConfig,
  validateJobData,
  createJobOptions,
};