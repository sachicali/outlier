// Test data factories for generating consistent test data
import { faker } from '@faker-js/faker';

/**
 * Factory for creating mock video data
 */
export class VideoFactory {
  static create(overrides = {}) {
    const baseData = {
      id: { videoId: faker.string.alphanumeric(11) },
      snippet: {
        title: `${faker.lorem.words(3)} - ${faker.helpers.arrayElement(['Funny Moments', 'Epic Gameplay', 'Reaction', 'Tutorial'])}`,
        description: faker.lorem.paragraph(),
        publishedAt: faker.date.recent({ days: 30 }).toISOString(),
        tags: faker.helpers.arrayElements(['gaming', 'roblox', 'funny', 'kids', 'family', 'reaction'], { min: 1, max: 4 }),
        thumbnails: {
          default: { url: `https://img.youtube.com/vi/${faker.string.alphanumeric(11)}/default.jpg` },
        },
      },
      statistics: {
        viewCount: faker.number.int({ min: 1000, max: 1000000 }).toString(),
        likeCount: faker.number.int({ min: 10, max: 50000 }).toString(),
        commentCount: faker.number.int({ min: 5, max: 5000 }).toString(),
      },
      contentDetails: {
        duration: `PT${faker.number.int({ min: 1, max: 30 })}M${faker.number.int({ min: 0, max: 59 })}S`,
      },
    };

    return this.mergeDeep(baseData, overrides);
  }

  static createBatch(count = 5, overrides = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createOutlier(overrides = {}) {
    return this.create({
      statistics: {
        viewCount: faker.number.int({ min: 500000, max: 2000000 }).toString(),
        likeCount: faker.number.int({ min: 25000, max: 100000 }).toString(),
      },
      snippet: {
        title: `${faker.helpers.arrayElement(['EPIC', 'INSANE', 'AMAZING'])} ${faker.lorem.words(2)} - ${faker.helpers.arrayElement(['YOU WON\'T BELIEVE THIS!', 'GONE WRONG!', 'MUST WATCH!'])}`,
        tags: ['viral', 'trending', 'epic', 'amazing'],
      },
      ...overrides,
    });
  }

  static mergeDeep(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeDeep(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
}

/**
 * Factory for creating mock channel data
 */
export class ChannelFactory {
  static create(overrides = {}) {
    const baseData = {
      id: { channelId: `UC${faker.string.alphanumeric(22)}` },
      snippet: {
        title: faker.helpers.arrayElement([
          'FamilyFun Gaming',
          'Epic Kids Channel',
          'Gaming Adventures',
          'Fun Family Time',
          'Awesome Gaming Hub',
        ]),
        description: faker.lorem.paragraph(),
        publishedAt: faker.date.past({ years: 3 }).toISOString(),
        thumbnails: {
          default: { url: `https://yt3.ggpht.com/${faker.string.alphanumeric(20)}.jpg` },
        },
      },
      statistics: {
        subscriberCount: faker.number.int({ min: 10000, max: 500000 }).toString(),
        videoCount: faker.number.int({ min: 50, max: 1000 }).toString(),
        viewCount: faker.number.int({ min: 1000000, max: 50000000 }).toString(),
      },
    };

    return VideoFactory.mergeDeep(baseData, overrides);
  }

  static createBatch(count = 5, overrides = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createSmallChannel(overrides = {}) {
    return this.create({
      statistics: {
        subscriberCount: faker.number.int({ min: 1000, max: 25000 }).toString(),
        videoCount: faker.number.int({ min: 10, max: 100 }).toString(),
        viewCount: faker.number.int({ min: 100000, max: 2000000 }).toString(),
      },
      ...overrides,
    });
  }

  static createLargeChannel(overrides = {}) {
    return this.create({
      statistics: {
        subscriberCount: faker.number.int({ min: 500000, max: 5000000 }).toString(),
        videoCount: faker.number.int({ min: 500, max: 5000 }).toString(),
        viewCount: faker.number.int({ min: 50000000, max: 500000000 }).toString(),
      },
      ...overrides,
    });
  }
}

/**
 * Factory for creating analysis configurations
 */
export class AnalysisConfigFactory {
  static create(overrides = {}) {
    const baseData = {
      exclusionChannels: faker.helpers.arrayElements([
        'pewdiepie',
        'mrbeast',
        'gaming channel',
        'kids content',
      ], { min: 1, max: 3 }),
      minSubs: faker.number.int({ min: 10000, max: 50000 }),
      maxSubs: faker.number.int({ min: 100000, max: 1000000 }),
      timeWindow: faker.number.int({ min: 1, max: 30 }),
      outlierThreshold: faker.number.int({ min: 10, max: 100 }),
    };

    return { ...baseData, ...overrides };
  }

  static createDefault() {
    return this.create({
      exclusionChannels: ['test-channel-1', 'test-channel-2'],
      minSubs: 10000,
      maxSubs: 500000,
      timeWindow: 7,
      outlierThreshold: 30,
    });
  }
}

/**
 * Factory for creating outlier analysis results
 */
export class OutlierResultFactory {
  static create(overrides = {}) {
    const video = VideoFactory.create();
    const channel = ChannelFactory.create();

    const baseData = {
      ...video,
      channelInfo: channel,
      outlierScore: faker.number.float({ min: 20, max: 100, precision: 0.1 }),
      brandFit: faker.number.float({ min: 5, max: 10, precision: 0.1 }),
      isExcluded: false,
    };

    return VideoFactory.mergeDeep(baseData, overrides);
  }

  static createBatch(count = 10, overrides = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createHighPerformer(overrides = {}) {
    return this.create({
      outlierScore: faker.number.float({ min: 80, max: 150, precision: 0.1 }),
      brandFit: faker.number.float({ min: 8, max: 10, precision: 0.1 }),
      statistics: {
        viewCount: faker.number.int({ min: 1000000, max: 5000000 }).toString(),
      },
      ...overrides,
    });
  }
}

/**
 * Factory for creating socket.io mock events
 */
export class SocketEventFactory {
  static createProgressEvent(step = 0, progress = 50) {
    return {
      step,
      message: faker.helpers.arrayElement([
        'Building Exclusion Database',
        'Discovering Adjacent Channels',
        'Analyzing Channel Data',
        'Calculating Outlier Scores',
        'Generating Results',
      ]),
      progress,
      data: faker.helpers.maybe(() => ({
        exclusionGames: faker.helpers.arrayElements(['doors', 'piggy', 'brookhaven'], { min: 1, max: 3 }),
      }), { probability: 0.3 }),
    };
  }

  static createCompleteEvent(results = null) {
    return {
      analysisId: faker.string.uuid(),
      results: results || OutlierResultFactory.createBatch(faker.number.int({ min: 5, max: 20 })),
      summary: {
        totalOutliers: faker.number.int({ min: 5, max: 50 }),
        channelsAnalyzed: faker.number.int({ min: 10, max: 100 }),
        exclusionGames: faker.number.int({ min: 1, max: 10 }),
      },
    };
  }

  static createErrorEvent(error = 'Analysis failed') {
    return {
      analysisId: faker.string.uuid(),
      error,
    };
  }
}

export default {
  VideoFactory,
  ChannelFactory,
  AnalysisConfigFactory,
  OutlierResultFactory,
  SocketEventFactory,
};