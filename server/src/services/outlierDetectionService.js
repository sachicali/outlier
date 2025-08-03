const youtubeService = require('./youtubeService');
const logger = require('../utils/logger');
const { getAnalysisRepository, getChannelRepository } = require('../repositories');
const contentConfig = require('../config/contentConfig');

class OutlierDetectionService {
  constructor() {
    this.exclusionGames = new Set();
    this.processingStatus = new Map();
    this.analysisRepository = null;
    this.channelRepository = null;
    this.contentConfig = null;
  }

  async initialize() {
    if (!this.analysisRepository) {
      this.analysisRepository = await getAnalysisRepository();
      this.channelRepository = await getChannelRepository();
    }
    if (!this.contentConfig) {
      this.contentConfig = await contentConfig.loadConfig();
    }
  }

  async buildExclusionList(channelNames, timeWindowDays = 7) {
    await this.initialize();
    logger.info(`Building exclusion list for channels: ${channelNames.join(', ')}`);

    const publishedAfter = new Date();
    publishedAfter.setDate(publishedAfter.getDate() - timeWindowDays);

    const exclusionGames = new Set();

    for (const channelName of channelNames) {
      try {
        // Search for the channel
        const channels = await youtubeService.searchChannels(channelName, 5);
        const targetChannel = channels.find(ch =>
          ch.snippet.title.toLowerCase().includes(channelName.toLowerCase()),
        );

        if (!targetChannel) {
          logger.warn(`Channel not found: ${channelName}`);
          continue;
        }

        // Store or update channel in database
        const channelData = {
          youtube_channel_id: targetChannel.id.channelId,
          title: targetChannel.snippet.title,
          description: targetChannel.snippet.description,
          thumbnail_url: targetChannel.snippet.thumbnails?.high?.url,
          subscriber_count: parseInt(targetChannel.statistics?.subscriberCount) || 0,
          video_count: parseInt(targetChannel.statistics?.videoCount) || 0,
          view_count: parseInt(targetChannel.statistics?.viewCount) || 0,
        };

        await this.channelRepository.upsertByYouTubeId(
          targetChannel.id.channelId,
          channelData,
        );

        // Get recent videos from the channel
        const videos = await youtubeService.getChannelVideos(
          targetChannel.id.channelId,
          20,
          publishedAfter.toISOString(),
        );

        // Extract game names from video titles and descriptions
        for (const video of videos) {
          const games = await this.extractGameNames(video.snippet.title, video.snippet.description);
          games.forEach(game => exclusionGames.add(game));
        }

      } catch (error) {
        logger.error(`Error processing channel ${channelName}:`, error);
      }
    }

    this.exclusionGames = exclusionGames;
    logger.info(`Built exclusion list with ${exclusionGames.size} games`);

    return Array.from(exclusionGames);
  }

  async extractGameNames(title, description = '') {
    await this.initialize();
    const games = new Set();
    const text = `${title} ${description}`.toLowerCase();

    // Get game patterns from configuration
    const gamePatterns = await contentConfig.getGamePatterns();

    gamePatterns.forEach(patternConfig => {
      const pattern = new RegExp(patternConfig.pattern, patternConfig.flags || 'gi');
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => games.add(match.toLowerCase()));
      }
    });

    return Array.from(games);
  }

  async discoverAdjacentChannels(searchQueries, subscriberRange = { min: 10000, max: 500000 }) {
    await this.initialize();
    logger.info('Discovering adjacent channels...');

    const allChannels = new Map();

    for (const query of searchQueries) {
      try {
        const channels = await youtubeService.searchChannels(query, 20, subscriberRange);

        for (const channel of channels) {
          // Skip if already processed
          if (allChannels.has(channel.id.channelId)) continue;

          // Get channel info with statistics
          const channelInfo = await youtubeService.getChannelInfo(channel.id.channelId);

          // Validate channel criteria
          if (await this.validateChannelCriteria(channelInfo)) {
            // Store channel in database
            try {
              await this.channelRepository.createOrUpdateFromYouTube(channelInfo);
            } catch (error) {
              logger.error(`Error storing channel ${channelInfo.snippet.title}:`, error);
            }

            allChannels.set(channel.id.channelId, channelInfo);
          }
        }

      } catch (error) {
        logger.error(`Error searching for query "${query}":`, error);
      }
    }

    logger.info(`Discovered ${allChannels.size} qualified adjacent channels`);
    return Array.from(allChannels.values());
  }

  async validateChannelCriteria(channelInfo) {
    await this.initialize();
    const stats = channelInfo.statistics;
    const subCount = parseInt(stats.subscriberCount || 0);
    const videoCount = parseInt(stats.videoCount || 0);
    const title = channelInfo.snippet.title.toLowerCase();
    const description = (channelInfo.snippet.description || '').toLowerCase();

    // Get validation criteria from configuration
    const criteria = await contentConfig.getChannelCriteria();

    // Check subscriber and video count criteria
    if (subCount < criteria.minSubscribers ||
        subCount > criteria.maxSubscribers ||
        videoCount < criteria.minVideoCount) {
      return false;
    }

    // Check title exclusions
    for (const keyword of criteria.excludeTitleKeywords) {
      if (title.includes(keyword.toLowerCase())) {
        return false;
      }
    }

    // Check description exclusions
    for (const keyword of criteria.excludeDescriptionKeywords) {
      if (description.includes(keyword.toLowerCase())) {
        return false;
      }
    }

    return true;
  }

  async analyzeChannelOutliers(channelInfo, timeWindowDays = 7) {
    const publishedAfter = new Date();
    publishedAfter.setDate(publishedAfter.getDate() - timeWindowDays);

    try {
      // Get recent videos
      const videos = await youtubeService.getChannelVideos(
        channelInfo.id,
        15,
        publishedAfter.toISOString(),
      );

      if (videos.length < 3) {
        logger.warn(`Not enough recent videos for channel: ${channelInfo.snippet.title}`);
        return [];
      }

      // Calculate outlier scores
      const videosWithScores = await Promise.all(videos.map(async video => {
        const views = parseInt(video.statistics.viewCount || 0);
        const subscribers = parseInt(channelInfo.statistics.subscriberCount || 1);

        const outlierScore = (views / subscribers) * 100;
        const brandFit = await this.calculateBrandFit(video);

        return {
          ...video,
          channelInfo,
          outlierScore,
          brandFit,
          isExcluded: this.isVideoExcluded(video),
        };
      }));

      // Get thresholds from configuration
      const config = await contentConfig.loadConfig();
      const outlierThreshold = config.outlierThreshold || 20;
      const brandFitThreshold = config.brandFit.threshold || 6;

      // Filter for actual outliers and not excluded
      const outliers = videosWithScores.filter(video =>
        video.outlierScore > outlierThreshold &&
        video.brandFit > brandFitThreshold &&
        !video.isExcluded,
      );

      return outliers;

    } catch (error) {
      logger.error(`Error analyzing channel ${channelInfo.snippet.title}:`, error);
      return [];
    }
  }

  async calculateBrandFit(video) {
    await this.initialize();
    const title = video.snippet.title.toLowerCase();
    const description = video.snippet.description?.toLowerCase() || '';

    // Get brand fit criteria from configuration
    const brandFit = await contentConfig.getBrandFitCriteria();
    let score = brandFit.baseScore;

    // Apply positive indicators
    for (const indicator of brandFit.positiveIndicators) {
      if (indicator.keywords) {
        const hasKeyword = indicator.keywords.some(keyword => title.includes(keyword));
        if (hasKeyword) {
          score += indicator.score;
        }
      } else if (indicator.pattern) {
        const pattern = new RegExp(indicator.pattern);
        if (pattern.test(title)) {
          score += indicator.score;
        }
      }
    }

    // Apply negative indicators
    for (const indicator of brandFit.negativeIndicators) {
      if (indicator.keywords) {
        const hasKeyword = indicator.keywords.some(keyword => title.includes(keyword));
        const hasExcludeKeyword = indicator.excludeKeywords &&
          indicator.excludeKeywords.some(keyword => title.includes(keyword));

        if (hasKeyword && !hasExcludeKeyword) {
          score += indicator.score; // Note: negative indicators have negative scores
        }
      } else if (indicator.descriptionKeywords) {
        const hasKeyword = indicator.descriptionKeywords.some(keyword => description.includes(keyword));
        if (hasKeyword) {
          score += indicator.score;
        }
      }
    }

    return Math.max(0, Math.min(10, score));
  }

  isVideoExcluded(video) {
    const title = video.snippet.title.toLowerCase();
    const description = video.snippet.description?.toLowerCase() || '';
    const content = `${title} ${description}`;

    for (const excludedGame of this.exclusionGames) {
      if (content.includes(excludedGame)) {
        return true;
      }
    }

    return false;
  }

  async startAnalysis(analysisId, config, io) {
    await this.initialize();
    logger.info(`Starting outlier analysis: ${analysisId}`);

    // Update analysis status to processing
    try {
      await this.analysisRepository.updateStatus(analysisId, 'processing');
    } catch (error) {
      logger.error(`Error updating analysis status: ${error.message}`);
    }

    try {
      // Step 1: Build exclusion list
      io.to(`analysis-${analysisId}`).emit('progress', {
        step: 0,
        message: 'Building Exclusion Database',
        progress: 0,
      });

      const exclusionList = await this.buildExclusionList(
        config.exclusionChannels,
        config.timeWindow,
      );

      io.to(`analysis-${analysisId}`).emit('progress', {
        step: 0,
        message: 'Building Exclusion Database',
        progress: 100,
        data: { exclusionGames: exclusionList },
      });

      // Step 2: Discover adjacent channels
      io.to(`analysis-${analysisId}`).emit('progress', {
        step: 1,
        message: 'Discovering Adjacent Channels',
        progress: 0,
      });

      // Get search queries from configuration
      const searchQueries = await contentConfig.getSearchQueries();

      const adjacentChannels = await this.discoverAdjacentChannels(
        searchQueries,
        { min: config.minSubs, max: config.maxSubs },
      );

      io.to(`analysis-${analysisId}`).emit('progress', {
        step: 1,
        message: 'Discovering Adjacent Channels',
        progress: 100,
      });

      // Step 3-6: Analyze each channel for outliers
      const allOutliers = [];
      let processedChannels = 0;

      for (const channel of adjacentChannels) {
        const outliers = await this.analyzeChannelOutliers(channel, config.timeWindow);
        allOutliers.push(...outliers);

        processedChannels++;
        const progress = (processedChannels / adjacentChannels.length) * 100;

        io.to(`analysis-${analysisId}`).emit('progress', {
          step: Math.floor(2 + (progress / 100) * 4), // Steps 2-5
          message: `Analyzing Channel ${processedChannels}/${adjacentChannels.length}`,
          progress: progress,
        });
      }

      // Get final filtering configuration
      const contentConfigData = await contentConfig.loadConfig();
      const maxResults = contentConfigData.maxResults || 50;

      // Final ranking
      const finalResults = allOutliers
        .filter(outlier => outlier.outlierScore >= config.outlierThreshold)
        .sort((a, b) => b.outlierScore - a.outlierScore)
        .slice(0, maxResults);

      const summary = {
        totalOutliers: finalResults.length,
        channelsAnalyzed: adjacentChannels.length,
        exclusionGames: exclusionList.length,
      };

      // Store analysis results in database
      try {
        await this.analysisRepository.completeAnalysis(analysisId, finalResults, summary);
      } catch (error) {
        logger.error(`Error storing analysis results: ${error.message}`);
      }

      io.to(`analysis-${analysisId}`).emit('complete', {
        analysisId,
        results: finalResults,
        summary,
      });

      logger.info(`Analysis complete: ${analysisId}, found ${finalResults.length} outliers`);
      return finalResults;

    } catch (error) {
      logger.error(`Analysis failed: ${analysisId}`, error);

      // Store analysis failure in database
      try {
        await this.analysisRepository.failAnalysis(analysisId, error.message);
      } catch (dbError) {
        logger.error(`Error storing analysis failure: ${dbError.message}`);
      }

      io.to(`analysis-${analysisId}`).emit('error', {
        analysisId,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = new OutlierDetectionService();
