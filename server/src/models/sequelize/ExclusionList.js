const { DataTypes, Model } = require('sequelize');

class ExclusionList extends Model {
  /**
   * Initialize the ExclusionList model
   * @param {Sequelize} sequelize - Sequelize instance
   */
  static init(sequelize) {
    super.init({
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true, // Allow system-wide exclusions
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          len: [1, 255],
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM('game', 'keyword', 'channel', 'category'),
        defaultValue: 'game',
        allowNull: false,
      },
      items: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
        validate: {
          notEmpty: true,
        },
      },
      is_global: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Global exclusions affect all analyses',
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      usage_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      last_used_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      source_channels: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
        allowNull: false,
        comment: 'Channels used to build this exclusion list',
      },
      auto_update: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether to automatically update from source channels',
      },
      update_frequency_days: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 365,
        },
        comment: 'How often to update in days',
      },
      last_updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
        allowNull: false,
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        allowNull: false,
      },
    }, {
      sequelize,
      modelName: 'ExclusionList',
      tableName: 'exclusion_lists',
      indexes: [
        {
          fields: ['user_id'],
        },
        {
          fields: ['type'],
        },
        {
          fields: ['is_global'],
        },
        {
          fields: ['is_active'],
        },
        {
          fields: ['auto_update'],
        },
        {
          fields: ['last_used_at'],
        },
        {
          fields: ['usage_count'],
        },
        {
          using: 'gin',
          fields: ['items'],
        },
        {
          using: 'gin',
          fields: ['source_channels'],
        },
        {
          using: 'gin',
          fields: ['tags'],
        },
        {
          using: 'gin',
          fields: ['metadata'],
        },
        // Composite indexes
        {
          fields: ['is_active', 'type'],
        },
        {
          fields: ['is_global', 'is_active'],
        },
        {
          fields: ['user_id', 'is_active'],
        },
      ],
    });

    return ExclusionList;
  }

  /**
   * Create exclusion list from channel analysis
   * @param {Array<string>} channelNames - Channel names to analyze
   * @param {Object} options - Creation options
   * @returns {Promise<ExclusionList>} Created exclusion list
   */
  static async createFromChannels(channelNames, options = {}) {
    const {
      userId = null,
      name = `Exclusion list from ${channelNames.join(', ')}`,
      description = null,
      timeWindowDays = 7,
      isGlobal = false,
      autoUpdate = false,
      updateFrequencyDays = 7,
    } = options;

    // This would integrate with the YouTube service to build the exclusion list
    // For now, we'll create a placeholder implementation
    const extractedGames = await this.extractGamesFromChannels(channelNames, timeWindowDays);

    const exclusionList = await this.create({
      user_id: userId,
      name,
      description,
      type: 'game',
      items: extractedGames,
      is_global: isGlobal,
      source_channels: channelNames,
      auto_update: autoUpdate,
      update_frequency_days: updateFrequencyDays,
      last_updated_at: new Date(),
      metadata: {
        creation_method: 'channel_analysis',
        time_window_days: timeWindowDays,
        created_from_channels: channelNames,
      },
    });

    return exclusionList;
  }

  /**
   * Extract games from channels (placeholder implementation)
   * @param {Array<string>} channelNames - Channel names
   * @param {number} timeWindowDays - Time window for analysis
   * @returns {Promise<Array<string>>} Extracted games
   */
  static async extractGamesFromChannels(channelNames, timeWindowDays) {
    // This would integrate with the YouTube service
    // For now, return some common game patterns
    return [
      'doors',
      'piggy',
      'brookhaven',
      'murder mystery',
      'arsenal',
      'adopt me',
      'tower of hell',
      'flee the facility',
      'natural disaster',
      'rainbow friends',
      'backrooms',
    ];
  }

  /**
   * Update exclusion list from source channels
   */
  async updateFromSources() {
    if (!this.auto_update || !this.source_channels.length) {
      return false;
    }

    const shouldUpdate = !this.last_updated_at ||
      (Date.now() - this.last_updated_at.getTime()) >=
      (this.update_frequency_days * 24 * 60 * 60 * 1000);

    if (!shouldUpdate) {
      return false;
    }

    try {
      const extractedGames = await ExclusionList.extractGamesFromChannels(
        this.source_channels,
        this.metadata.time_window_days || 7,
      );

      // Merge with existing items, keeping unique values
      const mergedItems = [...new Set([...this.items, ...extractedGames])];

      this.items = mergedItems;
      this.last_updated_at = new Date();
      this.metadata = {
        ...this.metadata,
        last_auto_update: new Date(),
        items_added: extractedGames.filter(item => !this.items.includes(item)),
      };

      await this.save();
      return true;
    } catch (error) {
      this.metadata = {
        ...this.metadata,
        last_update_error: error.message,
        last_update_attempt: new Date(),
      };
      await this.save();
      return false;
    }
  }

  /**
   * Add items to exclusion list
   * @param {Array<string>} newItems - Items to add
   */
  async addItems(newItems) {
    const uniqueItems = [...new Set([...this.items, ...newItems])];
    this.items = uniqueItems;
    await this.save();
  }

  /**
   * Remove items from exclusion list
   * @param {Array<string>} itemsToRemove - Items to remove
   */
  async removeItems(itemsToRemove) {
    this.items = this.items.filter(item => !itemsToRemove.includes(item));
    await this.save();
  }

  /**
   * Check if content matches any exclusion items
   * @param {string} content - Content to check
   * @returns {Object} Match result with matched items
   */
  checkContent(content) {
    if (!this.is_active) {
      return { isExcluded: false, matchedItems: [] };
    }

    const lowerContent = content.toLowerCase();
    const matchedItems = this.items.filter(item =>
      lowerContent.includes(item.toLowerCase()),
    );

    return {
      isExcluded: matchedItems.length > 0,
      matchedItems,
      listName: this.name,
      listType: this.type,
    };
  }

  /**
   * Increment usage counter
   */
  async recordUsage() {
    this.usage_count += 1;
    this.last_used_at = new Date();
    await this.save();
  }

  /**
   * Get usage statistics
   * @returns {Object} Usage statistics
   */
  getUsageStats() {
    return {
      usage_count: this.usage_count,
      last_used_at: this.last_used_at,
      items_count: this.items.length,
      days_since_last_use: this.last_used_at ?
        Math.floor((Date.now() - this.last_used_at.getTime()) / (1000 * 60 * 60 * 24)) :
        null,
      auto_update_enabled: this.auto_update,
      days_since_last_update: this.last_updated_at ?
        Math.floor((Date.now() - this.last_updated_at.getTime()) / (1000 * 60 * 60 * 24)) :
        null,
    };
  }

  /**
   * Get active exclusion lists for a user
   * @param {string} userId - User ID
   * @param {string} type - Exclusion type filter
   * @returns {Promise<Array<ExclusionList>>} Active exclusion lists
   */
  static async getActiveForUser(userId, type = null) {
    const where = {
      is_active: true,
      [DataTypes.Op.or]: [
        { user_id: userId },
        { is_global: true },
      ],
    };

    if (type) {
      where.type = type;
    }

    return await this.findAll({
      where,
      order: [['usage_count', 'DESC'], ['created_at', 'DESC']],
    });
  }

  /**
   * Get all items from active exclusion lists
   * @param {string} userId - User ID
   * @param {string} type - Exclusion type filter
   * @returns {Promise<Array<string>>} All exclusion items
   */
  static async getAllActiveItems(userId, type = 'game') {
    const exclusionLists = await this.getActiveForUser(userId, type);
    const allItems = new Set();

    exclusionLists.forEach(list => {
      list.items.forEach(item => allItems.add(item));
    });

    return Array.from(allItems);
  }

  /**
   * Get safe object for API responses
   * @returns {Object} Safe exclusion list object
   */
  toSafeObject() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      type: this.type,
      items: this.items,
      is_global: this.is_global,
      is_active: this.is_active,
      source_channels: this.source_channels,
      auto_update: this.auto_update,
      update_frequency_days: this.update_frequency_days,
      tags: this.tags,
      usage_stats: this.getUsageStats(),
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

module.exports = ExclusionList;