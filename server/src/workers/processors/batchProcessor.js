const logger = require('../../utils/logger');
const { JOB_TYPES } = require('../../queues/jobTypes');
const queueManager = require('../../queues/queueManager');
const youtubeAnalysisProcessor = require('./youtubeAnalysisProcessor');
const { getAnalysisRepository, getChannelRepository } = require('../../repositories');

class BatchProcessor {
  constructor() {
    this.analysisRepository = null;
    this.channelRepository = null;
  }

  async initialize() {
    if (!this.analysisRepository) {
      this.analysisRepository = await getAnalysisRepository();
      this.channelRepository = await getChannelRepository();
    }
  }

  async processBatchChannelAnalysis(job) {
    await this.initialize();
    
    const { channels, config, analysisId, userId } = job.data;
    
    logger.info(`Processing batch channel analysis:`, {
      jobId: job.id,
      channelCount: channels.length,
      analysisId,
    });

    try {
      await job.updateProgress(5);

      const results = [];
      let processedChannels = 0;
      
      // Process channels in parallel batches
      const batchSize = 5; // Process 5 channels concurrently
      
      for (let i = 0; i < channels.length; i += batchSize) {
        const batch = channels.slice(i, i + batchSize);
        
        // Create jobs for this batch
        const batchJobs = batch.map(channel => ({
          name: JOB_TYPES.OUTLIER_DETECTION,
          data: {
            channelInfo: channel,
            timeWindowDays: config.timeWindow || 7,
            analysisId,
          },
          opts: {
            priority: 75, // High priority for batch processing
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        }));
        
        // Add batch jobs to queue
        const addedJobs = await queueManager.addBulkJobs(
          'youtube-analysis',
          batchJobs
        );
        
        logger.debug(`Added batch of ${batchJobs.length} outlier detection jobs`);
        
        // Wait for batch to complete
        const batchResults = await Promise.allSettled(
          addedJobs.map(job => job.waitUntilFinished(queueManager.events.get('youtube-analysis')))
        );
        
        // Process batch results
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            if (result.value.outliers && result.value.outliers.length > 0) {
              results.push(...result.value.outliers);
            }
          } else {
            logger.warn('Batch job failed:', result.reason);
          }
        }
        
        processedChannels += batch.length;
        const progress = 5 + (processedChannels / channels.length) * 85;
        await job.updateProgress(Math.floor(progress));
        
        logger.info(`Processed batch ${i / batchSize + 1}/${Math.ceil(channels.length / batchSize)}`);
      }

      // Sort and filter final results
      const finalResults = results
        .filter(outlier => outlier.outlierScore >= (config.outlierThreshold || 20))
        .sort((a, b) => b.outlierScore - a.outlierScore)
        .slice(0, config.maxResults || 50);

      await job.updateProgress(100);

      logger.info(`Batch channel analysis completed:`, {
        jobId: job.id,
        totalOutliers: finalResults.length,
        channelsProcessed: processedChannels,
      });

      return {
        success: true,
        results: finalResults,
        totalOutliers: finalResults.length,
        channelsProcessed: processedChannels,
        analysisId,
      };
    } catch (error) {
      logger.error(`Batch channel analysis failed:`, {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  async processBatchVideoProcessing(job) {
    const { videos, processingType, config } = job.data;
    
    logger.info(`Processing batch video processing:`, {
      jobId: job.id,
      videoCount: videos.length,
      processingType,
    });

    try {
      await job.updateProgress(5);

      const results = [];
      let processedVideos = 0;
      
      // Process videos in batches
      const batchSize = 10;
      
      for (let i = 0; i < videos.length; i += batchSize) {
        const batch = videos.slice(i, i + batchSize);
        
        // Process batch based on type
        let batchResults = [];
        
        switch (processingType) {
          case 'brand-fit-analysis':
            batchResults = await this.processBrandFitBatch(batch, config);
            break;
          
          case 'outlier-scoring':
            batchResults = await this.processOutlierScoringBatch(batch, config);
            break;
          
          case 'content-analysis':
            batchResults = await this.processContentAnalysisBatch(batch, config);
            break;
          
          default:
            throw new Error(`Unknown processing type: ${processingType}`);
        }
        
        results.push(...batchResults);
        processedVideos += batch.length;
        
        const progress = 5 + (processedVideos / videos.length) * 90;
        await job.updateProgress(Math.floor(progress));
        
        logger.debug(`Processed video batch ${i / batchSize + 1}/${Math.ceil(videos.length / batchSize)}`);
      }

      await job.updateProgress(100);

      logger.info(`Batch video processing completed:`, {
        jobId: job.id,
        videoCount: videos.length,
        resultCount: results.length,
        processingType,
      });

      return {
        success: true,
        results,
        videoCount: videos.length,
        resultCount: results.length,
        processingType,
      };
    } catch (error) {
      logger.error(`Batch video processing failed:`, {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  async processBulkDataImport(job) {
    await this.initialize();
    
    const { data, dataType, config } = job.data;
    
    logger.info(`Processing bulk data import:`, {
      jobId: job.id,
      dataType,
      recordCount: data.length,
    });

    try {
      await job.updateProgress(5);

      let importedCount = 0;
      let errorCount = 0;
      const batchSize = config?.batchSize || 100;
      
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        try {
          switch (dataType) {
            case 'channels':
              await this.importChannelBatch(batch);
              break;
            
            case 'analyses':
              await this.importAnalysisBatch(batch);
              break;
            
            default:
              throw new Error(`Unknown data type: ${dataType}`);
          }
          
          importedCount += batch.length;
        } catch (batchError) {
          logger.error(`Batch import error:`, {
            batch: i / batchSize + 1,
            error: batchError.message,
          });
          errorCount += batch.length;
        }
        
        const progress = 5 + ((i + batch.length) / data.length) * 90;
        await job.updateProgress(Math.floor(progress));
      }

      await job.updateProgress(100);

      logger.info(`Bulk data import completed:`, {
        jobId: job.id,
        dataType,
        totalRecords: data.length,
        importedCount,
        errorCount,
      });

      return {
        success: true,
        dataType,
        totalRecords: data.length,
        importedCount,
        errorCount,
      };
    } catch (error) {
      logger.error(`Bulk data import failed:`, {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  async processBrandFitBatch(videos, config) {
    const results = [];
    
    for (const video of videos) {
      try {
        // Use the existing brand fit calculation from outlier service
        const brandFit = await youtubeAnalysisProcessor.outlierDetectionService?.calculateBrandFit?.(video) || 0;
        
        results.push({
          ...video,
          brandFit,
          processed: true,
        });
      } catch (error) {
        logger.warn(`Brand fit analysis failed for video ${video.id}:`, error.message);
        results.push({
          ...video,
          brandFit: 0,
          processed: false,
          error: error.message,
        });
      }
    }
    
    return results;
  }

  async processOutlierScoringBatch(videos, config) {
    const results = [];
    
    for (const video of videos) {
      try {
        const views = parseInt(video.statistics?.viewCount || 0);
        const subscribers = parseInt(video.channelInfo?.statistics?.subscriberCount || 1);
        const outlierScore = (views / subscribers) * 100;
        
        results.push({
          ...video,
          outlierScore,
          processed: true,
        });
      } catch (error) {
        logger.warn(`Outlier scoring failed for video ${video.id}:`, error.message);
        results.push({
          ...video,
          outlierScore: 0,
          processed: false,
          error: error.message,
        });
      }
    }
    
    return results;
  }

  async processContentAnalysisBatch(videos, config) {
    const results = [];
    
    for (const video of videos) {
      try {
        // Simple content analysis - could be enhanced with ML/AI
        const title = video.snippet?.title || '';
        const description = video.snippet?.description || '';
        
        const analysis = {
          hasGameKeywords: /game|gaming|play|minecraft|fortnite|roblox/i.test(title + ' ' + description),
          hasReactionKeywords: /react|reaction|responds|watching/i.test(title),
          hasClickbaitIndicators: /!!|???|amazing|shocking|unbelievable/i.test(title),
          titleLength: title.length,
          descriptionLength: description.length,
          hasHashtags: description.includes('#'),
        };
        
        results.push({
          ...video,
          contentAnalysis: analysis,
          processed: true,
        });
      } catch (error) {
        logger.warn(`Content analysis failed for video ${video.id}:`, error.message);
        results.push({
          ...video,
          contentAnalysis: null,
          processed: false,
          error: error.message,
        });
      }
    }
    
    return results;
  }

  async importChannelBatch(channels) {
    await this.initialize();
    
    for (const channelData of channels) {
      try {
        await this.channelRepository.createOrUpdateFromYouTube(channelData);
      } catch (error) {
        logger.warn(`Failed to import channel ${channelData.id}:`, error.message);
        throw error;
      }
    }
  }

  async importAnalysisBatch(analyses) {
    await this.initialize();
    
    for (const analysisData of analyses) {
      try {
        await this.analysisRepository.createAnalysis(analysisData);
      } catch (error) {
        logger.warn(`Failed to import analysis ${analysisData.id}:`, error.message);
        throw error;
      }
    }
  }

  async process(job) {
    const { name } = job;
    
    switch (name) {
      case JOB_TYPES.BATCH_CHANNEL_ANALYSIS:
        return await this.processBatchChannelAnalysis(job);
      
      case JOB_TYPES.BATCH_VIDEO_PROCESSING:
        return await this.processBatchVideoProcessing(job);
      
      case JOB_TYPES.BULK_DATA_IMPORT:
        return await this.processBulkDataImport(job);
      
      default:
        throw new Error(`Unknown batch job type: ${name}`);
    }
  }
}

module.exports = new BatchProcessor();