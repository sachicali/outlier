const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');
const { JOB_TYPES } = require('../../queues/jobTypes');
const { getAnalysisRepository } = require('../../repositories');
const redisConnection = require('../../queues/redisConnection');
const queueManager = require('../../queues/queueManager');

class CleanupProcessor {
  constructor() {
    this.analysisRepository = null;
  }

  async initialize() {
    if (!this.analysisRepository) {
      this.analysisRepository = await getAnalysisRepository();
    }
  }

  async processCleanupOldAnalyses(job) {
    await this.initialize();
    
    const { olderThanDays, batchSize = 100 } = job.data;
    
    logger.info(`Cleaning up old analyses:`, {
      jobId: job.id,
      olderThanDays,
      batchSize,
    });

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      await job.updateProgress(10);

      // Find old analyses
      const oldAnalyses = await this.analysisRepository.findOlderThan(
        cutoffDate,
        batchSize
      );

      await job.updateProgress(30);

      if (oldAnalyses.length === 0) {
        logger.info('No old analyses to clean up');
        return {
          success: true,
          deletedCount: 0,
          message: 'No old analyses found',
        };
      }

      // Delete old analyses in batches
      let deletedCount = 0;
      const batchSizeDelete = Math.min(batchSize, 50);
      
      for (let i = 0; i < oldAnalyses.length; i += batchSizeDelete) {
        const batch = oldAnalyses.slice(i, i + batchSizeDelete);
        const ids = batch.map(analysis => analysis.id);
        
        await this.analysisRepository.deleteBatch(ids);
        deletedCount += batch.length;
        
        const progress = 30 + ((i + batch.length) / oldAnalyses.length) * 60;
        await job.updateProgress(Math.floor(progress));
        
        logger.debug(`Deleted batch of ${batch.length} old analyses`);
      }

      await job.updateProgress(100);

      logger.info(`Cleanup completed:`, {
        jobId: job.id,
        deletedCount,
        olderThanDate: cutoffDate.toISOString(),
      });

      return {
        success: true,
        deletedCount,
        olderThanDate: cutoffDate.toISOString(),
      };
    } catch (error) {
      logger.error(`Failed to cleanup old analyses:`, {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  async processCleanupFailedJobs(job) {
    const { olderThanHours = 24, maxJobs = 1000 } = job.data;
    
    logger.info(`Cleaning up failed jobs:`, {
      jobId: job.id,
      olderThanHours,
      maxJobs,
    });

    try {
      const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
      let totalCleaned = 0;

      await job.updateProgress(10);

      // Clean failed jobs from all queues
      const queueNames = ['youtube-analysis', 'batch-processing', 'scheduled-tasks', 'email-notifications', 'data-cleanup'];
      
      for (let i = 0; i < queueNames.length; i++) {
        const queueName = queueNames[i];
        
        try {
          const cleaned = await queueManager.cleanQueue(queueName, cutoffTime, 'failed');
          totalCleaned += cleaned.length;
          
          logger.info(`Cleaned ${cleaned.length} failed jobs from ${queueName}`);
        } catch (queueError) {
          logger.warn(`Failed to clean queue ${queueName}:`, queueError.message);
        }
        
        const progress = 10 + ((i + 1) / queueNames.length) * 80;
        await job.updateProgress(Math.floor(progress));
      }

      await job.updateProgress(100);

      logger.info(`Failed job cleanup completed:`, {
        jobId: job.id,
        totalCleaned,
        cutoffTime: new Date(cutoffTime).toISOString(),
      });

      return {
        success: true,
        totalCleaned,
        cutoffTime: new Date(cutoffTime).toISOString(),
      };
    } catch (error) {
      logger.error(`Failed to cleanup failed jobs:`, {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  async processCleanupExpiredCache(job) {
    const { pattern = '*', maxAge = 86400 } = job.data; // Default 24 hours
    
    logger.info(`Cleaning up expired cache:`, {
      jobId: job.id,
      pattern,
      maxAge,
    });

    try {
      const redis = redisConnection.getClient();
      if (!redis || !redisConnection.isReady()) {
        throw new Error('Redis connection not available');
      }

      await job.updateProgress(10);

      // Get all keys matching pattern
      const keys = await redis.keys(pattern);
      
      if (keys.length === 0) {
        logger.info('No cache keys found to clean');
        return {
          success: true,
          deletedKeys: 0,
          message: 'No cache keys found',
        };
      }

      await job.updateProgress(30);

      // Check TTL and delete expired keys
      let deletedKeys = 0;
      const batchSize = 100;
      
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        
        // Check TTL for each key in batch
        for (const key of batch) {
          try {
            const ttl = await redis.ttl(key);
            
            // If TTL is -1 (no expiry) or expired, check creation time via key name
            if (ttl === -1) {
              // For keys without TTL, check if they're old based on naming convention
              const keyParts = key.split('_');
              const timestamp = keyParts[keyParts.length - 1];
              
              if (timestamp && !isNaN(timestamp)) {
                const keyAge = (Date.now() - parseInt(timestamp)) / 1000;
                if (keyAge > maxAge) {
                  await redis.del(key);
                  deletedKeys++;
                }
              }
            }
          } catch (keyError) {
            logger.warn(`Error checking key ${key}:`, keyError.message);
          }
        }
        
        const progress = 30 + ((i + batch.length) / keys.length) * 60;
        await job.updateProgress(Math.floor(progress));
      }

      await job.updateProgress(100);

      logger.info(`Cache cleanup completed:`, {
        jobId: job.id,
        totalKeys: keys.length,
        deletedKeys,
      });

      return {
        success: true,
        totalKeys: keys.length,
        deletedKeys,
      };
    } catch (error) {
      logger.error(`Failed to cleanup expired cache:`, {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  async processCleanupTempFiles(job) {
    const { directory = '/tmp', maxAge = 86400, pattern = '*.tmp' } = job.data;
    
    logger.info(`Cleaning up temp files:`, {
      jobId: job.id,
      directory,
      maxAge,
      pattern,
    });

    try {
      await job.updateProgress(10);

      // Check if directory exists
      try {
        await fs.access(directory);
      } catch {
        logger.info(`Directory ${directory} does not exist`);
        return {
          success: true,
          deletedFiles: 0,
          message: 'Directory does not exist',
        };
      }

      await job.updateProgress(30);

      // Read directory contents
      const files = await fs.readdir(directory);
      const tempFiles = files.filter(file => {
        // Simple pattern matching (could be enhanced with glob)
        if (pattern === '*.tmp') {
          return file.endsWith('.tmp');
        }
        return file.includes(pattern.replace('*', ''));
      });

      if (tempFiles.length === 0) {
        logger.info('No temp files found to clean');
        return {
          success: true,
          deletedFiles: 0,
          message: 'No temp files found',
        };
      }

      await job.updateProgress(50);

      // Delete old files
      let deletedFiles = 0;
      const cutoffTime = Date.now() - (maxAge * 1000);
      
      for (let i = 0; i < tempFiles.length; i++) {
        const file = tempFiles[i];
        const filePath = path.join(directory, file);
        
        try {
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath);
            deletedFiles++;
            logger.debug(`Deleted temp file: ${filePath}`);
          }
        } catch (fileError) {
          logger.warn(`Error processing file ${filePath}:`, fileError.message);
        }
        
        const progress = 50 + ((i + 1) / tempFiles.length) * 40;
        await job.updateProgress(Math.floor(progress));
      }

      await job.updateProgress(100);

      logger.info(`Temp file cleanup completed:`, {
        jobId: job.id,
        totalFiles: tempFiles.length,
        deletedFiles,
      });

      return {
        success: true,
        totalFiles: tempFiles.length,
        deletedFiles,
        directory,
      };
    } catch (error) {
      logger.error(`Failed to cleanup temp files:`, {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  async processArchiveOldData(job) {
    await this.initialize();
    
    const { olderThanDays, archivePath = '/tmp/archive' } = job.data;
    
    logger.info(`Archiving old data:`, {
      jobId: job.id,
      olderThanDays,
      archivePath,
    });

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      await job.updateProgress(10);

      // Find old analyses to archive
      const oldAnalyses = await this.analysisRepository.findOlderThan(cutoffDate, 1000);
      
      if (oldAnalyses.length === 0) {
        logger.info('No old data to archive');
        return {
          success: true,
          archivedCount: 0,
          message: 'No old data found',
        };
      }

      await job.updateProgress(30);

      // Create archive directory
      try {
        await fs.mkdir(archivePath, { recursive: true });
      } catch (mkdirError) {
        if (mkdirError.code !== 'EEXIST') {
          throw mkdirError;
        }
      }

      // Create archive file
      const archiveFileName = `analysis_archive_${Date.now()}.json`;
      const archiveFilePath = path.join(archivePath, archiveFileName);
      
      const archiveData = {
        created: new Date().toISOString(),
        cutoffDate: cutoffDate.toISOString(),
        count: oldAnalyses.length,
        analyses: oldAnalyses,
      };

      await fs.writeFile(archiveFilePath, JSON.stringify(archiveData, null, 2));

      await job.updateProgress(70);

      // Delete archived analyses from database
      const ids = oldAnalyses.map(analysis => analysis.id);
      await this.analysisRepository.deleteBatch(ids);

      await job.updateProgress(100);

      logger.info(`Data archiving completed:`, {
        jobId: job.id,
        archivedCount: oldAnalyses.length,
        archiveFile: archiveFilePath,
      });

      return {
        success: true,
        archivedCount: oldAnalyses.length,
        archiveFile: archiveFilePath,
        cutoffDate: cutoffDate.toISOString(),
      };
    } catch (error) {
      logger.error(`Failed to archive old data:`, {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  async process(job) {
    const { name } = job;
    
    switch (name) {
      case JOB_TYPES.CLEANUP_OLD_ANALYSES:
        return await this.processCleanupOldAnalyses(job);
      
      case JOB_TYPES.CLEANUP_FAILED_JOBS:
        return await this.processCleanupFailedJobs(job);
      
      case JOB_TYPES.CLEANUP_EXPIRED_CACHE:
        return await this.processCleanupExpiredCache(job);
      
      case JOB_TYPES.CLEANUP_TEMP_FILES:
        return await this.processCleanupTempFiles(job);
      
      case JOB_TYPES.ARCHIVE_OLD_DATA:
        return await this.processArchiveOldData(job);
      
      default:
        throw new Error(`Unknown cleanup job type: ${name}`);
    }
  }
}

module.exports = new CleanupProcessor();