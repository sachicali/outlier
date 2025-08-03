const outlierDetectionService = require('../../services/outlierDetectionService');
const { getAnalysisRepository } = require('../../repositories');
const logger = require('../../utils/logger');
const { JOB_TYPES } = require('../../queues/jobTypes');

class YouTubeAnalysisProcessor {
  constructor() {
    this.analysisRepository = null;
  }

  async initialize() {
    if (!this.analysisRepository) {
      this.analysisRepository = await getAnalysisRepository();
    }
  }

  async processYouTubeAnalysis(job) {
    await this.initialize();
    
    const { analysisId, config, userId, socketRoom } = job.data;
    
    logger.info(`Processing YouTube analysis job:`, {
      jobId: job.id,
      analysisId,
      userId,
    });

    try {
      // Update job progress
      await job.updateProgress(0);

      // Update analysis status to processing
      await this.analysisRepository.updateStatus(analysisId, 'processing');

      // Mock WebSocket for progress updates if socket room is provided
      const mockIo = this.createMockIo(job, socketRoom, analysisId);

      // Start the analysis using the existing service
      const results = await outlierDetectionService.startAnalysis(
        analysisId,
        config,
        mockIo
      );

      // Update final progress
      await job.updateProgress(100);

      logger.info(`YouTube analysis completed:`, {
        jobId: job.id,
        analysisId,
        resultCount: results.length,
      });

      return {
        success: true,
        analysisId,
        resultCount: results.length,
        processingTime: Date.now() - job.processedOn,
      };
    } catch (error) {
      logger.error(`YouTube analysis failed:`, {
        jobId: job.id,
        analysisId,
        error: error.message,
      });

      // Update analysis status to failed
      try {
        await this.analysisRepository.failAnalysis(analysisId, error.message);
      } catch (dbError) {
        logger.error('Error updating analysis failure status:', dbError);
      }

      throw error;
    }
  }

  async processExclusionListBuild(job) {
    const { channelNames, timeWindowDays, analysisId } = job.data;
    
    logger.info(`Building exclusion list:`, {
      jobId: job.id,
      channelCount: channelNames.length,
      timeWindowDays,
    });

    try {
      await job.updateProgress(10);

      const exclusionList = await outlierDetectionService.buildExclusionList(
        channelNames,
        timeWindowDays
      );

      await job.updateProgress(100);

      logger.info(`Exclusion list built:`, {
        jobId: job.id,
        exclusionCount: exclusionList.length,
      });

      return {
        success: true,
        exclusionList,
        exclusionCount: exclusionList.length,
      };
    } catch (error) {
      logger.error(`Exclusion list build failed:`, {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  async processChannelDiscovery(job) {
    const { searchQueries, subscriberRange, maxResults, analysisId } = job.data;
    
    logger.info(`Discovering channels:`, {
      jobId: job.id,
      queryCount: searchQueries.length,
      subscriberRange,
    });

    try {
      await job.updateProgress(10);

      const channels = await outlierDetectionService.discoverAdjacentChannels(
        searchQueries,
        subscriberRange
      );

      await job.updateProgress(100);

      logger.info(`Channel discovery completed:`, {
        jobId: job.id,
        channelCount: channels.length,
      });

      return {
        success: true,
        channels,
        channelCount: channels.length,
      };
    } catch (error) {
      logger.error(`Channel discovery failed:`, {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  async processOutlierDetection(job) {
    const { channelInfo, timeWindowDays, exclusionGames, analysisId } = job.data;
    
    logger.info(`Detecting outliers for channel:`, {
      jobId: job.id,
      channelId: channelInfo.id,
      channelName: channelInfo.snippet?.title,
    });

    try {
      await job.updateProgress(10);

      // Set exclusion games if provided
      if (exclusionGames && Array.isArray(exclusionGames)) {
        outlierDetectionService.exclusionGames = new Set(exclusionGames);
      }

      const outliers = await outlierDetectionService.analyzeChannelOutliers(
        channelInfo,
        timeWindowDays
      );

      await job.updateProgress(100);

      logger.info(`Outlier detection completed:`, {
        jobId: job.id,
        outlierCount: outliers.length,
      });

      return {
        success: true,
        outliers,
        outlierCount: outliers.length,
        channelInfo,
      };
    } catch (error) {
      logger.error(`Outlier detection failed:`, {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  // Create a mock IO object for progress updates in queue context
  createMockIo(job, socketRoom, analysisId) {
    return {
      to: (room) => ({
        emit: async (event, data) => {
          // Update job progress based on analysis progress
          if (event === 'progress' && data.progress !== undefined) {
            const overallProgress = Math.floor((data.step / 6) * 100 + (data.progress / 6));
            await job.updateProgress(Math.min(overallProgress, 95));
          }
          
          // Log progress for debugging
          logger.debug(`Analysis progress:`, {
            jobId: job.id,
            analysisId,
            event,
            data: {
              step: data.step,
              message: data.message,
              progress: data.progress,
            },
          });
        },
      }),
    };
  }

  // Process different job types
  async process(job) {
    const { name } = job;
    
    switch (name) {
      case JOB_TYPES.YOUTUBE_ANALYSIS:
        return await this.processYouTubeAnalysis(job);
      
      case JOB_TYPES.EXCLUSION_LIST_BUILD:
        return await this.processExclusionListBuild(job);
      
      case JOB_TYPES.CHANNEL_DISCOVERY:
        return await this.processChannelDiscovery(job);
      
      case JOB_TYPES.OUTLIER_DETECTION:
        return await this.processOutlierDetection(job);
      
      default:
        throw new Error(`Unknown job type: ${name}`);
    }
  }
}

module.exports = new YouTubeAnalysisProcessor();