// Mock data and utilities for YouTube API testing
import { mock } from 'bun:test';

// Sample YouTube video data
export const mockVideoData = {
  id: { videoId: 'dQw4w9WgXcQ' },
  snippet: {
    title: 'Epic Roblox Funny Moments - Kids React!',
    description: 'Watch these hilarious Roblox moments with family-friendly content!',
    publishedAt: '2024-01-15T10:30:00Z',
    tags: ['roblox', 'funny', 'kids', 'family'],
    thumbnails: {
      default: { url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg' },
    },
  },
  statistics: {
    viewCount: '150000',
    likeCount: '8500',
    commentCount: '1200',
  },
  contentDetails: {
    duration: 'PT8M45S',
  },
};

// Sample YouTube channel data
export const mockChannelData = {
  id: { channelId: 'UCTest123' },
  snippet: {
    title: 'FamilyFunGaming',
    description: 'Family-friendly gaming content for kids and parents!',
    publishedAt: '2020-03-15T00:00:00Z',
    thumbnails: {
      default: { url: 'https://yt3.ggpht.com/test.jpg' },
    },
  },
  statistics: {
    subscriberCount: '125000',
    videoCount: '350',
    viewCount: '15000000',
  },
};

// Mock YouTube API responses
export const mockYouTubeResponses = {
  searchVideos: {
    data: {
      items: [mockVideoData],
      pageInfo: { totalResults: 1, resultsPerPage: 1 },
    },
  },

  searchChannels: {
    data: {
      items: [mockChannelData],
      pageInfo: { totalResults: 1, resultsPerPage: 1 },
    },
  },

  getChannelInfo: {
    data: {
      items: [mockChannelData],
    },
  },

  getVideoStats: {
    data: {
      items: [{
        id: 'dQw4w9WgXcQ',
        statistics: mockVideoData.statistics,
        contentDetails: mockVideoData.contentDetails,
      }],
    },
  },
};

// Mock YouTube service for testing
export class MockYouTubeService {
  constructor() {
    this.youtube = {
      search: {
        list: mock(() => Promise.resolve(mockYouTubeResponses.searchVideos)),
      },
      channels: {
        list: mock(() => Promise.resolve(mockYouTubeResponses.getChannelInfo)),
      },
      videos: {
        list: mock(() => Promise.resolve(mockYouTubeResponses.getVideoStats)),
      },
    };

    this.redis = global.mockRedisClient;
  }

  async getChannelVideos(channelId, maxResults = 10, publishedAfter = null) {
    // Simulate cached response
    const cached = await this.redis.get(`channel_videos_${channelId}_${maxResults}_${publishedAfter}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Mock API calls
    const searchResponse = await this.youtube.search.list({
      part: 'snippet',
      channelId,
      maxResults,
      order: 'date',
      type: 'video',
      publishedAfter,
    });

    const videoIds = searchResponse.data.items.map(item => item.id.videoId);
    const statsResponse = await this.youtube.videos.list({
      part: 'statistics,contentDetails',
      id: videoIds.join(','),
    });

    const videosWithStats = searchResponse.data.items.map(video => {
      const stats = statsResponse.data.items.find(stat => stat.id === video.id.videoId);
      return {
        ...video,
        statistics: stats?.statistics || {},
        contentDetails: stats?.contentDetails || {},
      };
    });

    // Cache the result
    await this.redis.setEx(`channel_videos_${channelId}_${maxResults}_${publishedAfter}`, 21600, JSON.stringify(videosWithStats));

    return videosWithStats;
  }

  async getChannelInfo(channelId) {
    const cached = await this.redis.get(`channel_info_${channelId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const response = await this.youtube.channels.list({
      part: 'snippet,statistics',
      id: channelId,
    });

    if (response.data.items.length === 0) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    const channelData = response.data.items[0];
    await this.redis.setEx(`channel_info_${channelId}`, 86400, JSON.stringify(channelData));

    return channelData;
  }

  async searchChannels(query, maxResults = 25, subscriberRange = { min: 10000, max: 500000 }) {
    const response = await this.youtube.search.list({
      part: 'snippet',
      q: query,
      type: 'channel',
      maxResults,
      order: 'relevance',
    });

    const channelIds = response.data.items.map(item => item.id.channelId);
    const statsResponse = await this.youtube.channels.list({
      part: 'statistics',
      id: channelIds.join(','),
    });

    const filteredChannels = response.data.items.filter(channel => {
      const stats = statsResponse.data.items.find(stat => stat.id === channel.id.channelId);
      const subCount = parseInt(stats?.statistics?.subscriberCount || 0);
      return subCount >= subscriberRange.min && subCount <= subscriberRange.max;
    });

    return filteredChannels;
  }

  async searchVideos(query, publishedAfter = null, maxResults = 50) {
    const cached = await this.redis.get(`search_videos_${query}_${publishedAfter}_${maxResults}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const response = await this.youtube.search.list({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults,
      order: 'viewCount',
      publishedAfter,
    });

    await this.redis.setEx(`search_videos_${query}_${publishedAfter}_${maxResults}`, 7200, JSON.stringify(response.data.items));

    return response.data.items;
  }
}

export default MockYouTubeService;