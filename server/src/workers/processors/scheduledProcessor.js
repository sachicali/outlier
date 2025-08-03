const cron = require('node-cron');
const logger = require('../../utils/logger');
const { JOB_TYPES } = require('../../queues/jobTypes');
const queueManager = require('../../queues/queueManager');
const redisConnection = require('../../queues/redisConnection');
const { getAnalysisRepository } = require('../../repositories');
const youtubeService = require('../../services/youtubeService');

class ScheduledProcessor {
  constructor() {
    this.analysisRepository = null;
  }

  async initialize() {
    if (!this.analysisRepository) {
      this.analysisRepository = await getAnalysisRepository();
    }
  }

  async processRefreshCache(job) {
    const { cacheType = 'all', forceRefresh = false } = job.data;
    
    logger.info(`Refreshing cache:`, {
      jobId: job.id,
      cacheType,
      forceRefresh,
    });

    try {
      const redis = redisConnection.getClient();
      if (!redis || !redisConnection.isReady()) {
        throw new Error('Redis connection not available');
      }

      await job.updateProgress(10);

      let refreshedKeys = 0;
      
      switch (cacheType) {
        case 'youtube-channels':
          refreshedKeys = await this.refreshYouTubeChannelCache(redis, forceRefresh);
          break;
        
        case 'youtube-videos':
          refreshedKeys = await this.refreshYouTubeVideoCache(redis, forceRefresh);
          break;
        
        case 'search-results':
          refreshedKeys = await this.refreshSearchResultsCache(redis, forceRefresh);
          break;
        
        case 'all':
        default:
          const channelKeys = await this.refreshYouTubeChannelCache(redis, forceRefresh);
          await job.updateProgress(40);
          
          const videoKeys = await this.refreshYouTubeVideoCache(redis, forceRefresh);
          await job.updateProgress(70);
          
          const searchKeys = await this.refreshSearchResultsCache(redis, forceRefresh);
          await job.updateProgress(90);
          
          refreshedKeys = channelKeys + videoKeys + searchKeys;
          break;
      }

      await job.updateProgress(100);

      logger.info(`Cache refresh completed:`, {
        jobId: job.id,
        cacheType,
        refreshedKeys,
      });

      return {
        success: true,
        cacheType,
        refreshedKeys,
      };
    } catch (error) {
      logger.error(`Cache refresh failed:`, {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  async processSyncYouTubeData(job) {
    await this.initialize();
    
    const { syncType = 'recent', maxItems = 100 } = job.data;
    
    logger.info(`Syncing YouTube data:`, {
      jobId: job.id,
      syncType,
      maxItems,
    });

    try {
      await job.updateProgress(10);

      let syncedCount = 0;
      
      switch (syncType) {
        case 'recent':
          syncedCount = await this.syncRecentAnalysisData(maxItems);
          break;
        
        case 'popular-channels':
          syncedCount = await this.syncPopularChannels(maxItems);
          break;
        
        case 'trending-videos':
          syncedCount = await this.syncTrendingVideos(maxItems);
          break;
        
        default:
          throw new Error(`Unknown sync type: ${syncType}`);
      }

      await job.updateProgress(100);

      logger.info(`YouTube data sync completed:`, {
        jobId: job.id,
        syncType,
        syncedCount,
      });

      return {
        success: true,
        syncType,
        syncedCount,
      };
    } catch (error) {
      logger.error(`YouTube data sync failed:`, {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  async processGenerateReports(job) {
    await this.initialize();
    
    const { reportType = 'daily', dateRange, userId } = job.data;
    
    logger.info(`Generating reports:`, {
      jobId: job.id,
      reportType,
      dateRange,
      userId,
    });

    try {
      await job.updateProgress(10);

      let reportData = null;
      
      switch (reportType) {
        case 'daily':
          reportData = await this.generateDailyReport(dateRange, userId);
          break;
        
        case 'weekly':
          reportData = await this.generateWeeklyReport(dateRange, userId);
          break;
        
        case 'monthly':
          reportData = await this.generateMonthlyReport(dateRange, userId);
          break;
        
        case 'user-activity':
          reportData = await this.generateUserActivityReport(dateRange, userId);
          break;
        
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }

      await job.updateProgress(100);

      logger.info(`Report generation completed:`, {
        jobId: job.id,
        reportType,
        recordCount: reportData?.recordCount || 0,
      });

      return {
        success: true,
        reportType,
        reportData,
      };
    } catch (error) {
      logger.error(`Report generation failed:`, {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  async refreshYouTubeChannelCache(redis, forceRefresh) {
    const pattern = 'channel_info_*';
    const keys = await redis.keys(pattern);
    let refreshedCount = 0;
    
    for (const key of keys) {
      try {
        if (forceRefresh) {
          await redis.del(key);
          refreshedCount++;
        } else {
          const ttl = await redis.ttl(key);
          if (ttl < 3600) { // Refresh if less than 1 hour TTL
            await redis.del(key);
            refreshedCount++;
          }
        }
      } catch (error) {
        logger.warn(`Error refreshing cache key ${key}:`, error.message);
      }
    }
    
    return refreshedCount;
  }

  async refreshYouTubeVideoCache(redis, forceRefresh) {
    const pattern = 'channel_videos_*';
    const keys = await redis.keys(pattern);
    let refreshedCount = 0;
    
    for (const key of keys) {
      try {
        if (forceRefresh) {
          await redis.del(key);
          refreshedCount++;
        } else {
          const ttl = await redis.ttl(key);
          if (ttl < 1800) { // Refresh if less than 30 minutes TTL
            await redis.del(key);
            refreshedCount++;
          }
        }
      } catch (error) {
        logger.warn(`Error refreshing cache key ${key}:`, error.message);
      }
    }
    
    return refreshedCount;
  }

  async refreshSearchResultsCache(redis, forceRefresh) {
    const pattern = 'search_videos_*';
    const keys = await redis.keys(pattern);
    let refreshedCount = 0;
    
    for (const key of keys) {
      try {
        if (forceRefresh) {
          await redis.del(key);
          refreshedCount++;
        } else {
          const ttl = await redis.ttl(key);
          if (ttl < 900) { // Refresh if less than 15 minutes TTL
            await redis.del(key);
            refreshedCount++;
          }
        }
      } catch (error) {
        logger.warn(`Error refreshing cache key ${key}:`, error.message);
      }
    }
    
    return refreshedCount;
  }

  async syncRecentAnalysisData(maxItems) {
    // Get recent analyses and sync their related YouTube data
    const recentAnalyses = await this.analysisRepository.findRecent(maxItems);
    let syncedCount = 0;
    
    for (const analysis of recentAnalyses) {
      try {
        if (analysis.results && Array.isArray(analysis.results)) {
          for (const result of analysis.results.slice(0, 5)) { // Sync top 5 results
            if (result.channelInfo?.id) {
              // Refresh channel data
              await youtubeService.getChannelInfo(result.channelInfo.id);
              syncedCount++;
            }
          }
        }
      } catch (error) {
        logger.warn(`Error syncing analysis ${analysis.id}:`, error.message);
      }
    }
    
    return syncedCount;
  }

  async syncPopularChannels(maxItems) {
    // This would typically sync data for popular channels
    // For now, we'll just return 0 as this requires more complex logic
    logger.info('Popular channels sync not implemented yet');
    return 0;
  }

  async syncTrendingVideos(maxItems) {
    // This would typically sync trending video data
    // For now, we'll just return 0 as this requires more complex logic
    logger.info('Trending videos sync not implemented yet');
    return 0;
  }

  async generateDailyReport(dateRange, userId) {
    const startDate = dateRange ? new Date(dateRange.start) : new Date();
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = dateRange ? new Date(dateRange.end) : new Date();
    endDate.setHours(23, 59, 59, 999);
    
    const analyses = await this.analysisRepository.findByDateRange(startDate, endDate, userId);
    
    return {
      type: 'daily',
      date: startDate.toISOString().split('T')[0],
      userId,
      recordCount: analyses.length,
      summary: {
        totalAnalyses: analyses.length,
        completedAnalyses: analyses.filter(a => a.status === 'completed').length,
        failedAnalyses: analyses.filter(a => a.status === 'failed').length,
        totalOutliers: analyses.reduce((sum, a) => sum + (a.total_outliers_found || 0), 0),
      },
      analyses: analyses.slice(0, 100), // Limit to 100 for report size
    };
  }

  async generateWeeklyReport(dateRange, userId) {
    const startDate = dateRange ? new Date(dateRange.start) : new Date();
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = dateRange ? new Date(dateRange.end) : new Date();
    endDate.setHours(23, 59, 59, 999);
    
    const analyses = await this.analysisRepository.findByDateRange(startDate, endDate, userId);
    
    return {
      type: 'weekly',
      weekStart: startDate.toISOString().split('T')[0],
      weekEnd: endDate.toISOString().split('T')[0],
      userId,
      recordCount: analyses.length,
      summary: {
        totalAnalyses: analyses.length,
        completedAnalyses: analyses.filter(a => a.status === 'completed').length,
        failedAnalyses: analyses.filter(a => a.status === 'failed').length,
        totalOutliers: analyses.reduce((sum, a) => sum + (a.total_outliers_found || 0), 0),
        avgProcessingTime: analyses.length > 0 
          ? analyses.reduce((sum, a) => sum + (a.processing_time_ms || 0), 0) / analyses.length
          : 0,
      },
      analyses: analyses.slice(0, 200), // Limit to 200 for weekly report
    };
  }

  async generateMonthlyReport(dateRange, userId) {
    const startDate = dateRange ? new Date(dateRange.start) : new Date();
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = dateRange ? new Date(dateRange.end) : new Date();
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);
    endDate.setHours(23, 59, 59, 999);
    
    const analyses = await this.analysisRepository.findByDateRange(startDate, endDate, userId);
    
    return {
      type: 'monthly',
      month: startDate.toISOString().split('T')[0].substring(0, 7),
      userId,
      recordCount: analyses.length,
      summary: {
        totalAnalyses: analyses.length,
        completedAnalyses: analyses.filter(a => a.status === 'completed').length,
        failedAnalyses: analyses.filter(a => a.status === 'failed').length,
        totalOutliers: analyses.reduce((sum, a) => sum + (a.total_outliers_found || 0), 0),
        avgProcessingTime: analyses.length > 0 
          ? analyses.reduce((sum, a) => sum + (a.processing_time_ms || 0), 0) / analyses.length
          : 0,
        topPerformingDay: this.calculateTopPerformingDay(analyses),
      },
      analyses: analyses.slice(0, 500), // Limit to 500 for monthly report
    };
  }

  async generateUserActivityReport(dateRange, userId) {
    if (!userId) {
      throw new Error('User ID required for user activity report');
    }
    
    const startDate = dateRange ? new Date(dateRange.start) : new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = dateRange ? new Date(dateRange.end) : new Date();
    endDate.setHours(23, 59, 59, 999);
    
    const analyses = await this.analysisRepository.findByDateRange(startDate, endDate, userId);
    
    return {
      type: 'user-activity',
      userId,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      recordCount: analyses.length,
      activity: {
        totalAnalyses: analyses.length,
        completedAnalyses: analyses.filter(a => a.status === 'completed').length,
        failedAnalyses: analyses.filter(a => a.status === 'failed').length,
        processingAnalyses: analyses.filter(a => a.status === 'processing').length,
        avgOutliersPerAnalysis: analyses.length > 0
          ? analyses.reduce((sum, a) => sum + (a.total_outliers_found || 0), 0) / analyses.length
          : 0,
        totalProcessingTime: analyses.reduce((sum, a) => sum + (a.processing_time_ms || 0), 0),
        mostActiveDay: this.calculateMostActiveDay(analyses),
        analysisFrequency: this.calculateAnalysisFrequency(analyses),
      },
      recentAnalyses: analyses.slice(0, 50),
    };
  }

  calculateTopPerformingDay(analyses) {
    const dayStats = {};
    
    analyses.forEach(analysis => {
      if (analysis.status === 'completed' && analysis.completed_at) {
        const day = analysis.completed_at.toISOString().split('T')[0];
        if (!dayStats[day]) {
          dayStats[day] = { count: 0, outliers: 0 };
        }
        dayStats[day].count++;
        dayStats[day].outliers += analysis.total_outliers_found || 0;
      }
    });
    
    let topDay = null;
    let maxOutliers = 0;
    
    Object.entries(dayStats).forEach(([day, stats]) => {
      if (stats.outliers > maxOutliers) {
        maxOutliers = stats.outliers;
        topDay = { day, ...stats };
      }
    });
    
    return topDay;
  }

  calculateMostActiveDay(analyses) {
    const dayStats = {};
    
    analyses.forEach(analysis => {
      if (analysis.started_at) {
        const day = analysis.started_at.toISOString().split('T')[0];
        dayStats[day] = (dayStats[day] || 0) + 1;
      }
    });
    
    let mostActiveDay = null;
    let maxCount = 0;
    
    Object.entries(dayStats).forEach(([day, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostActiveDay = { day, count };
      }
    });
    
    return mostActiveDay;
  }

  calculateAnalysisFrequency(analyses) {
    if (analyses.length < 2) return 'insufficient-data';
    
    const sortedAnalyses = analyses
      .filter(a => a.started_at)
      .sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
    
    if (sortedAnalyses.length < 2) return 'insufficient-data';
    
    const intervals = [];
    for (let i = 1; i < sortedAnalyses.length; i++) {
      const diff = new Date(sortedAnalyses[i].started_at) - new Date(sortedAnalyses[i-1].started_at);
      intervals.push(diff);
    }
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const avgDays = avgInterval / (1000 * 60 * 60 * 24);
    
    if (avgDays < 1) return 'daily';
    if (avgDays < 7) return 'weekly';
    if (avgDays < 30) return 'monthly';
    return 'sporadic';
  }

  async process(job) {
    const { name } = job;
    
    switch (name) {
      case JOB_TYPES.REFRESH_CACHE:
        return await this.processRefreshCache(job);
      
      case JOB_TYPES.SYNC_YOUTUBE_DATA:
        return await this.processSyncYouTubeData(job);
      
      case JOB_TYPES.GENERATE_REPORTS:
        return await this.processGenerateReports(job);
      
      default:
        throw new Error(`Unknown scheduled job type: ${name}`);
    }
  }
}

module.exports = new ScheduledProcessor();