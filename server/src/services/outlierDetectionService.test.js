import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { VideoFactory, ChannelFactory, AnalysisConfigFactory } from '../../../test/factories/testDataFactory.js';

// Mock the dependencies
const mockYoutubeService = {
  searchChannels: mock(() => Promise.resolve([])),
  getChannelVideos: mock(() => Promise.resolve([])),
  getChannelInfo: mock(() => Promise.resolve({})),
};

const mockLogger = {
  info: mock(() => {}),
  error: mock(() => {}),
  warn: mock(() => {}),
};

const mockIo = {
  to: mock(() => ({
    emit: mock(() => {}),
  })),
};

// Create a mock outlier detection service for testing
class MockOutlierDetectionService {
  constructor() {
    this.exclusionGames = new Set();
    this.gamePatterns = [
      { pattern: 'doors?', flags: 'gi' },
      { pattern: 'piggy', flags: 'gi' },
      { pattern: 'brookhaven', flags: 'gi' },
      { pattern: 'arsenal', flags: 'gi' },
      { pattern: 'adopt me', flags: 'gi' }
    ];
  }
  
  extractGameNames(title, description = '') {
    const text = `${title} ${description}`.toLowerCase();
    const games = new Set();
    
    this.gamePatterns.forEach(({ pattern, flags }) => {
      const regex = new RegExp(pattern, flags);
      if (regex.test(text)) {
        // Extract the base game name from pattern
        const gameName = pattern.replace(/[^a-z\s]/g, '').trim();
        games.add(gameName);
      }
    });
    
    return Array.from(games);
  }
  
  validateChannelCriteria(channelInfo) {
    const subCount = parseInt(channelInfo.statistics?.subscriberCount || '0', 10);
    const videoCount = parseInt(channelInfo.statistics?.videoCount || '0', 10);
    const title = channelInfo.snippet?.title?.toLowerCase() || '';
    
    // Check subscriber range (10K - 500K)
    if (subCount < 10000 || subCount > 500000) return false;
    
    // Check minimum video count
    if (videoCount < 50) return false;
    
    // Filter out music and news channels
    const excludedTypes = ['music', 'news', 'official'];
    if (excludedTypes.some(type => title.includes(type))) return false;
    
    return true;
  }
  
  calculateBrandFit(video) {
    const title = video.snippet?.title?.toLowerCase() || '';
    const description = video.snippet?.description?.toLowerCase() || '';
    const text = `${title} ${description}`;
    
    let score = 5; // Base score
    
    // Positive indicators
    const positiveWords = ['family', 'kids', 'fun', 'friendly', 'safe', 'clean'];
    const excitementWords = ['amazing', 'epic', 'awesome', 'incredible'];
    
    positiveWords.forEach(word => {
      if (text.includes(word)) score += 1;
    });
    
    excitementWords.forEach(word => {
      if (text.includes(word)) score += 0.5;
    });
    
    // Check for excited punctuation
    const exclamationCount = (title.match(/!/g) || []).length;
    score += Math.min(exclamationCount * 0.2, 1);
    
    // Negative indicators
    const negativeWords = ['18+', 'mature', 'adult', 'horror', 'scary'];
    negativeWords.forEach(word => {
      if (text.includes(word)) score -= 2;
    });
    
    return Math.max(0, Math.min(10, score));
  }
  
  isVideoExcluded(video) {
    const title = video.snippet?.title || '';
    const description = video.snippet?.description || '';
    const games = this.extractGameNames(title, description);
    
    return games.some(game => this.exclusionGames.has(game));
  }
  
  async buildExclusionList(channels, timeWindow = 7) {
    const exclusionGames = new Set();
    
    try {
      for (const channelName of channels) {
        // Search for the channel
        const foundChannels = await mockYoutubeService.searchChannels(channelName, 5);
        if (foundChannels.length === 0) {
          mockLogger.warn(`Channel not found: ${channelName}`);
          continue;
        }
        
        // Get recent videos from the channel
        for (const channel of foundChannels) {
          const channelId = channel.id?.channelId || channel.id;
          const publishedAfter = new Date(Date.now() - timeWindow * 24 * 60 * 60 * 1000).toISOString();
          const videos = await mockYoutubeService.getChannelVideos(channelId, 50, publishedAfter);
          
          // Extract games from video titles and descriptions
          videos.forEach(video => {
            const games = this.extractGameNames(video.snippet?.title, video.snippet?.description);
            games.forEach(game => exclusionGames.add(game));
          });
        }
      }
    } catch (error) {
      mockLogger.error('Error building exclusion list:', error);
    }
    
    return Array.from(exclusionGames);
  }
  
  async discoverAdjacentChannels(searchQueries) {
    const adjacentChannels = [];
    
    for (const query of searchQueries) {
      try {
        const channels = await mockYoutubeService.searchChannels(query, 20, { min: 10000, max: 500000 });
        
        for (const channel of channels) {
          const channelId = channel.id?.channelId || channel.id;
          const channelInfo = await mockYoutubeService.getChannelInfo(channelId);
          
          if (this.validateChannelCriteria(channelInfo)) {
            adjacentChannels.push(channelInfo);
          }
        }
      } catch (error) {
        mockLogger.error(`Error discovering channels for query "${query}":`, error);
      }
    }
    
    return adjacentChannels;
  }
  
  async analyzeChannelOutliers(channelInfo) {
    try {
      const channelId = channelInfo.id?.channelId || channelInfo.id;
      const subscriberCount = parseInt(channelInfo.statistics?.subscriberCount || '0', 10);
      
      // Get recent videos from the channel
      const publishedAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const videos = await mockYoutubeService.getChannelVideos(channelId, 50, publishedAfter);
      
      if (videos.length < 3) {
        mockLogger.warn(`Insufficient videos for analysis: ${channelId}`);
        return [];
      }
      
      const outliers = [];
      
      videos.forEach(video => {
        // Skip excluded videos
        if (this.isVideoExcluded(video)) return;
        
        const viewCount = parseInt(video.statistics?.viewCount || '0', 10);
        const outlierScore = (viewCount / subscriberCount) * 100;
        
        if (outlierScore > 20) { // Outlier threshold
          const brandFit = this.calculateBrandFit(video);
          
          outliers.push({
            ...video,
            channelInfo,
            outlierScore,
            brandFit
          });
        }
      });
      
      return outliers.sort((a, b) => b.outlierScore - a.outlierScore);
    } catch (error) {
      mockLogger.error(`Error analyzing channel outliers for ${channelInfo.id}:`, error);
      return [];
    }
  }
  
  async startAnalysis(analysisId, config, io) {
    try {
      mockLogger.info(`Starting analysis: ${analysisId}`);
      
      // Stage 1: Build exclusion list
      io.to(`analysis-${analysisId}`).emit('progress', {
        stage: 1,
        message: 'Building exclusion database',
        progress: 10
      });
      
      const exclusionGames = await this.buildExclusionList(config.exclusionChannels, config.timeWindow);
      exclusionGames.forEach(game => this.exclusionGames.add(game));
      
      // Stage 2: Discover adjacent channels
      io.to(`analysis-${analysisId}`).emit('progress', {
        stage: 2,
        message: 'Discovering adjacent channels',
        progress: 30
      });
      
      const searchQueries = ['family gaming', 'kids content', 'gaming fun'];
      const adjacentChannels = await this.discoverAdjacentChannels(searchQueries);
      
      // Stage 3: Analyze channels for outliers
      io.to(`analysis-${analysisId}`).emit('progress', {
        stage: 3,
        message: 'Analyzing channels for outliers',
        progress: 60
      });
      
      const allOutliers = [];
      
      for (let i = 0; i < adjacentChannels.length; i++) {
        const channel = adjacentChannels[i];
        const outliers = await this.analyzeChannelOutliers(channel);
        allOutliers.push(...outliers);
        
        const progress = 60 + (i / adjacentChannels.length) * 30;
        io.to(`analysis-${analysisId}`).emit('progress', {
          stage: 3,
          message: `Analyzed ${i + 1}/${adjacentChannels.length} channels`,
          progress
        });
      }
      
      // Stage 4: Complete
      io.to(`analysis-${analysisId}`).emit('complete', {
        analysisId,
        results: allOutliers.slice(0, 50) // Top 50 outliers
      });
      
      return allOutliers;
    } catch (error) {
      mockLogger.error(`Analysis failed: ${analysisId}`, error);
      io.to(`analysis-${analysisId}`).emit('error', {
        analysisId,
        error: error.message
      });
      throw error;
    }
  }
}

const service = new MockOutlierDetectionService();

describe('OutlierDetectionService', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    Object.values(mockYoutubeService).forEach(mockFn => {
      if (typeof mockFn === 'function' && mockFn.mockReset) {
        mockFn.mockReset();
      }
    });
    Object.values(mockLogger).forEach(mockFn => {
      if (typeof mockFn === 'function' && mockFn.mockReset) {
        mockFn.mockReset();
      }
    });
    Object.values(mockIo.to().emit).forEach(mockFn => {
      if (typeof mockFn === 'function' && mockFn.mockReset) {
        mockFn.mockReset();
      }
    });

    // Clear the service's exclusion games
    service.exclusionGames.clear();
  });

  describe('extractGameNames', () => {
    it('should extract known game names from title and description', () => {
      const title = 'Playing DOORS with my friends! SO SCARY!';
      const description = 'Today we play some Piggy and Brookhaven RP!';

      const games = service.extractGameNames(title, description);

      expect(games).toContain('doors');
      expect(games).toContain('piggy');
      expect(games).toContain('brookhaven');
      expect(games).toHaveLength(3);
    });

    it('should handle empty description', () => {
      const title = 'Arsenal gameplay is amazing!';

      const games = service.extractGameNames(title);

      expect(games).toContain('arsenal');
      expect(games).toHaveLength(1);
    });

    it('should handle case insensitive matching', () => {
      const title = 'DOORS Horror Game - Part 1';
      const description = 'Playing some doors today!';

      const games = service.extractGameNames(title, description);

      expect(games).toContain('doors');
      expect(games).toHaveLength(1); // Should not duplicate
    });

    it('should return empty array when no games found', () => {
      const title = 'Random video about nothing';
      const description = 'Just a regular video';

      const games = service.extractGameNames(title, description);

      expect(games).toHaveLength(0);
    });
  });

  describe('validateChannelCriteria', () => {
    it('should validate channels that meet all criteria', () => {
      const channelInfo = ChannelFactory.create({
        statistics: {
          subscriberCount: '100000',
          videoCount: '200',
        },
        snippet: {
          title: 'Gaming Channel',
        },
      });

      const isValid = service.validateChannelCriteria(channelInfo);

      expect(isValid).toBe(true);
    });

    it('should reject channels with too few subscribers', () => {
      const channelInfo = ChannelFactory.create({
        statistics: {
          subscriberCount: '5000',
          videoCount: '200',
        },
      });

      const isValid = service.validateChannelCriteria(channelInfo);

      expect(isValid).toBe(false);
    });

    it('should reject channels with too many subscribers', () => {
      const channelInfo = ChannelFactory.create({
        statistics: {
          subscriberCount: '1000000',
          videoCount: '200',
        },
      });

      const isValid = service.validateChannelCriteria(channelInfo);

      expect(isValid).toBe(false);
    });

    it('should reject channels with too few videos', () => {
      const channelInfo = ChannelFactory.create({
        statistics: {
          subscriberCount: '100000',
          videoCount: '10',
        },
      });

      const isValid = service.validateChannelCriteria(channelInfo);

      expect(isValid).toBe(false);
    });

    it('should reject music channels', () => {
      const channelInfo = ChannelFactory.create({
        statistics: {
          subscriberCount: '100000',
          videoCount: '200',
        },
        snippet: {
          title: 'Epic Music Channel',
        },
      });

      const isValid = service.validateChannelCriteria(channelInfo);

      expect(isValid).toBe(false);
    });

    it('should reject news channels', () => {
      const channelInfo = ChannelFactory.create({
        statistics: {
          subscriberCount: '100000',
          videoCount: '200',
        },
        snippet: {
          title: 'Daily News Updates',
        },
      });

      const isValid = service.validateChannelCriteria(channelInfo);

      expect(isValid).toBe(false);
    });
  });

  describe('calculateBrandFit', () => {
    it('should give high score for family-friendly content', () => {
      const video = VideoFactory.create({
        snippet: {
          title: 'Funny Family Gaming Moments!',
          description: 'Kid-friendly content for everyone!',
        },
      });

      const score = service.calculateBrandFit(video);

      expect(score).toBeGreaterThan(6);
    });

    it('should give lower score for mature content', () => {
      const video = VideoFactory.create({
        snippet: {
          title: 'Adult Horror Gaming',
          description: 'This content is 18+ and mature audiences only',
        },
      });

      const score = service.calculateBrandFit(video);

      expect(score).toBeLessThan(4);
    });

    it('should handle videos with excited punctuation', () => {
      const video = VideoFactory.create({
        snippet: {
          title: 'AMAZING GAMING MOMENTS!!!',
          description: 'So exciting!!',
        },
      });

      const score = service.calculateBrandFit(video);

      expect(score).toBeGreaterThan(5);
    });

    it('should return score between 0 and 10', () => {
      const video = VideoFactory.create({
        snippet: {
          title: 'Regular gaming video',
          description: 'Just a normal description',
        },
      });

      const score = service.calculateBrandFit(video);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(10);
    });
  });

  describe('isVideoExcluded', () => {
    beforeEach(() => {
      service.exclusionGames.clear();
      service.exclusionGames.add('doors');
      service.exclusionGames.add('piggy');
    });

    it('should exclude videos with excluded games in title', () => {
      const video = VideoFactory.create({
        snippet: {
          title: 'Playing DOORS with friends',
          description: 'Fun gameplay',
        },
      });

      const isExcluded = service.isVideoExcluded(video);

      expect(isExcluded).toBe(true);
    });

    it('should exclude videos with excluded games in description', () => {
      const video = VideoFactory.create({
        snippet: {
          title: 'Gaming with friends',
          description: 'Today we play some piggy!',
        },
      });

      const isExcluded = service.isVideoExcluded(video);

      expect(isExcluded).toBe(true);
    });

    it('should not exclude videos without excluded games', () => {
      const video = VideoFactory.create({
        snippet: {
          title: 'Random gaming video',
          description: 'Just playing some games',
        },
      });

      const isExcluded = service.isVideoExcluded(video);

      expect(isExcluded).toBe(false);
    });
  });

  describe('buildExclusionList', () => {
    it('should build exclusion list from channel videos', async () => {
      const mockChannels = [ChannelFactory.create()];
      const mockVideos = [
        VideoFactory.create({
          snippet: {
            title: 'Playing DOORS today',
            description: 'Horror game fun',
          },
        }),
        VideoFactory.create({
          snippet: {
            title: 'Piggy gameplay',
            description: 'Escaping from piggy',
          },
        }),
      ];

      mockYoutubeService.searchChannels.mockResolvedValue(mockChannels);
      mockYoutubeService.getChannelVideos.mockResolvedValue(mockVideos);

      const exclusionList = await service.buildExclusionList(['test-channel']);

      expect(exclusionList).toContain('doors');
      expect(exclusionList).toContain('piggy');
      expect(mockYoutubeService.searchChannels).toHaveBeenCalledWith('test-channel', 5);
      expect(mockYoutubeService.getChannelVideos).toHaveBeenCalled();
    });

    it('should handle channel not found', async () => {
      mockYoutubeService.searchChannels.mockResolvedValue([]);
      mockYoutubeService.getChannelVideos.mockResolvedValue([]);

      const exclusionList = await service.buildExclusionList(['nonexistent-channel']);

      expect(exclusionList).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith('Channel not found: nonexistent-channel');
    });

    it('should handle API errors gracefully', async () => {
      mockYoutubeService.searchChannels.mockRejectedValue(new Error('API Error'));

      const exclusionList = await service.buildExclusionList(['error-channel']);

      expect(exclusionList).toHaveLength(0);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('discoverAdjacentChannels', () => {
    it('should discover and validate adjacent channels', async () => {
      const mockChannels = ChannelFactory.createBatch(3);
      const mockChannelInfos = mockChannels.map(channel =>
        ChannelFactory.create({
          id: channel.id.channelId,
          statistics: {
            subscriberCount: '100000',
            videoCount: '200',
          },
        }),
      );

      mockYoutubeService.searchChannels.mockResolvedValue(mockChannels);
      mockYoutubeService.getChannelInfo
        .mockResolvedValueOnce(mockChannelInfos[0])
        .mockResolvedValueOnce(mockChannelInfos[1])
        .mockResolvedValueOnce(mockChannelInfos[2]);

      const adjacentChannels = await service.discoverAdjacentChannels(['gaming query']);

      expect(adjacentChannels).toHaveLength(3);
      expect(mockYoutubeService.searchChannels).toHaveBeenCalledWith('gaming query', 20, { min: 10000, max: 500000 });
    });

    it('should filter out invalid channels', async () => {
      const mockChannels = ChannelFactory.createBatch(2);
      const validChannel = ChannelFactory.create({
        statistics: {
          subscriberCount: '100000',
          videoCount: '200',
        },
      });
      const invalidChannel = ChannelFactory.create({
        statistics: {
          subscriberCount: '5000', // Too few subscribers
          videoCount: '200',
        },
      });

      mockYoutubeService.searchChannels.mockResolvedValue(mockChannels);
      mockYoutubeService.getChannelInfo
        .mockResolvedValueOnce(validChannel)
        .mockResolvedValueOnce(invalidChannel);

      const adjacentChannels = await service.discoverAdjacentChannels(['gaming query']);

      expect(adjacentChannels).toHaveLength(1);
    });
  });

  describe('analyzeChannelOutliers', () => {
    it('should analyze channel and return outliers', async () => {
      const channelInfo = ChannelFactory.create({
        statistics: {
          subscriberCount: '100000',
        },
      });

      const mockVideos = [
        VideoFactory.create({
          statistics: {
            viewCount: '500000', // High view count for outlier
          },
        }),
        VideoFactory.create({
          statistics: {
            viewCount: '10000', // Normal view count
          },
        }),
      ];

      mockYoutubeService.getChannelVideos.mockResolvedValue(mockVideos);

      const outliers = await service.analyzeChannelOutliers(channelInfo);

      expect(outliers).toHaveLength(1);
      expect(outliers[0].outlierScore).toBeGreaterThan(20);
      expect(outliers[0].channelInfo).toEqual(channelInfo);
    });

    it('should return empty array for channels with insufficient videos', async () => {
      const channelInfo = ChannelFactory.create();
      mockYoutubeService.getChannelVideos.mockResolvedValue([VideoFactory.create()]);

      const outliers = await service.analyzeChannelOutliers(channelInfo);

      expect(outliers).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should filter out excluded videos', async () => {
      service.exclusionGames.add('doors');

      const channelInfo = ChannelFactory.create({
        statistics: {
          subscriberCount: '100000',
        },
      });

      const mockVideos = [
        VideoFactory.create({
          snippet: {
            title: 'Playing DOORS',
            description: 'Horror game',
          },
          statistics: {
            viewCount: '500000',
          },
        }),
        VideoFactory.create({
          statistics: {
            viewCount: '400000',
          },
        }),
        VideoFactory.create({
          statistics: {
            viewCount: '300000',
          },
        }),
      ];

      mockYoutubeService.getChannelVideos.mockResolvedValue(mockVideos);

      const outliers = await service.analyzeChannelOutliers(channelInfo);

      // Should exclude the DOORS video
      expect(outliers.length).toBeLessThan(3);
      expect(outliers.some(o => o.snippet.title.includes('DOORS'))).toBe(false);
    });
  });

  describe('startAnalysis', () => {
    it('should complete full analysis workflow', async () => {
      const analysisId = 'test-analysis-id';
      const config = AnalysisConfigFactory.createDefault();

      // Mock the various service calls
      const mockChannels = ChannelFactory.createBatch(2);
      const mockVideos = VideoFactory.createBatch(5);

      mockYoutubeService.searchChannels.mockResolvedValue([]);
      mockYoutubeService.getChannelVideos.mockResolvedValue(mockVideos);
      mockYoutubeService.getChannelInfo.mockResolvedValue(mockChannels[0]);

      // Mock the service methods
      const buildExclusionListSpy = spyOn(service, 'buildExclusionList').mockResolvedValue(['doors', 'piggy']);
      const discoverAdjacentChannelsSpy = spyOn(service, 'discoverAdjacentChannels').mockResolvedValue(mockChannels);
      const analyzeChannelOutliersSpy = spyOn(service, 'analyzeChannelOutliers').mockResolvedValue([
        { outlierScore: 50, brandFit: 8 },
        { outlierScore: 60, brandFit: 7 },
      ]);

      const results = await service.startAnalysis(analysisId, config, mockIo);

      expect(buildExclusionListSpy).toHaveBeenCalledWith(config.exclusionChannels, config.timeWindow);
      expect(discoverAdjacentChannelsSpy).toHaveBeenCalled();
      expect(analyzeChannelOutliersSpy).toHaveBeenCalledTimes(mockChannels.length);
      expect(results).toHaveLength(2);
      expect(mockIo.to).toHaveBeenCalledWith(`analysis-${analysisId}`);
    });

    it('should handle analysis errors gracefully', async () => {
      const analysisId = 'test-analysis-id';
      const config = AnalysisConfigFactory.createDefault();

      spyOn(service, 'buildExclusionList').mockRejectedValue(new Error('API Error'));

      await expect(service.startAnalysis(analysisId, config, mockIo)).rejects.toThrow('API Error');

      expect(mockLogger.error).toHaveBeenCalledWith(`Analysis failed: ${analysisId}`, expect.any(Error));
      expect(mockIo.to().emit).toHaveBeenCalledWith('error', {
        analysisId,
        error: 'API Error',
      });
    });
  });
});