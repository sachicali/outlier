const BaseRepository = require('./BaseRepository');
const { v4: uuidv4 } = require('uuid');

/**
 * Repository for Analysis entity
 * Handles analysis CRUD operations with fallback to in-memory storage
 */
class AnalysisRepository extends BaseRepository {
  constructor(analysisModel = null) {
    // In-memory storage for fallback mode
    const fallbackStorage = new Map();
    super(analysisModel, fallbackStorage);
    this.fallbackStorage = fallbackStorage;
  }

  /**
   * Create new analysis with validation
   * @param {Object} analysisData - Analysis data
   * @returns {Promise<Object>} Created analysis
   */
  async createAnalysis(analysisData) {
    const data = {
      ...analysisData,
      id: analysisData.id || uuidv4(),
      status: analysisData.status || 'pending',
      created_at: new Date(),
      updated_at: new Date(),
    };

    return await this.create(data);
  }

  /**
   * Find analyses by user ID with pagination
   * @param {string} userId - User ID (can be null for anonymous)
   * @param {Object} options - Pagination and filtering options
   * @returns {Promise<Object>} Paginated results
   */
  async findByUserId(userId, options = {}) {
    const {
      limit = 20,
      offset = 0,
      status = null,
      isPublic = null,
      orderBy = 'created_at',
      orderDirection = 'DESC',
    } = options;

    const where = {};
    if (userId) {
      where.user_id = userId;
    } else {
      where.user_id = null;
    }

    if (status) {
      where.status = status;
    }

    if (isPublic !== null) {
      where.is_public = isPublic;
    }

    const queryOptions = {
      limit,
      offset,
      order: [[orderBy, orderDirection]],
    };

    return await this.findAndCountAll(where, queryOptions);
  }

  /**
   * Find public analyses
   * @param {Object} options - Filtering options
   * @returns {Promise<Array>} Public analyses
   */
  async findPublicAnalyses(options = {}) {
    const {
      limit = 50,
      offset = 0,
      status = 'completed',
    } = options;

    const where = {
      is_public: true,
      status,
    };

    return await this.findAndCountAll(where, {
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });
  }

  /**
   * Find analyses by status
   * @param {string} status - Analysis status
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Analyses with given status
   */
  async findByStatus(status, options = {}) {
    const where = { status };
    return await this.findAll(where, options);
  }

  /**
   * Update analysis status
   * @param {string} analysisId - Analysis ID
   * @param {string} status - New status
   * @param {Object} additionalData - Additional data to update
   * @returns {Promise<Object|null>} Updated analysis
   */
  async updateStatus(analysisId, status, additionalData = {}) {
    const updateData = {
      status,
      updated_at: new Date(),
      ...additionalData,
    };

    // Set timestamps based on status
    if (status === 'processing' && !additionalData.started_at) {
      updateData.started_at = new Date();
    } else if (status === 'completed' || status === 'failed') {
      if (!additionalData.completed_at) {
        updateData.completed_at = new Date();
      }
    }

    return await this.updateById(analysisId, updateData);
  }

  /**
   * Complete analysis with results
   * @param {string} analysisId - Analysis ID
   * @param {Array} results - Analysis results
   * @param {Object} summary - Analysis summary
   * @returns {Promise<Object|null>} Updated analysis
   */
  async completeAnalysis(analysisId, results, summary) {
    const analysis = await this.findById(analysisId);
    if (!analysis) {
      throw new Error('Analysis not found');
    }

    const processingTime = analysis.started_at ?
      Date.now() - new Date(analysis.started_at).getTime() : null;

    const updateData = {
      status: 'completed',
      results,
      summary,
      completed_at: new Date(),
      processing_time_ms: processingTime,
      total_outliers_found: results?.length || 0,
      total_channels_analyzed: summary?.channelsAnalyzed || 0,
      exclusion_games_count: summary?.exclusionGames || 0,
    };

    return await this.updateById(analysisId, updateData);
  }

  /**
   * Fail analysis with error message
   * @param {string} analysisId - Analysis ID
   * @param {string} errorMessage - Error message
   * @returns {Promise<Object|null>} Updated analysis
   */
  async failAnalysis(analysisId, errorMessage) {
    const analysis = await this.findById(analysisId);
    if (!analysis) {
      throw new Error('Analysis not found');
    }

    const processingTime = analysis.started_at ?
      Date.now() - new Date(analysis.started_at).getTime() : null;

    const updateData = {
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date(),
      processing_time_ms: processingTime,
    };

    return await this.updateById(analysisId, updateData);
  }

  /**
   * Get analysis statistics
   * @param {string} userId - User ID (optional)
   * @returns {Promise<Object>} Analysis statistics
   */
  async getStatistics(userId = null) {
    if (this.useDatabase) {
      try {
        const where = userId ? { user_id: userId } : {};

        const [total, completed, failed, processing] = await Promise.all([
          this.count(where),
          this.count({ ...where, status: 'completed' }),
          this.count({ ...where, status: 'failed' }),
          this.count({ ...where, status: 'processing' }),
        ]);

        return {
          total,
          completed,
          failed,
          processing,
          pending: total - completed - failed - processing,
          success_rate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0,
        };
      } catch (error) {
        throw error;
      }
    } else {
      return this.fallbackGetStatistics(userId);
    }
  }

  /**
   * Delete old analyses
   * @param {number} daysOld - Delete analyses older than this many days
   * @param {string} status - Only delete analyses with this status
   * @returns {Promise<number>} Number of deleted analyses
   */
  async deleteOldAnalyses(daysOld = 30, status = 'completed') {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const where = {
      status,
      created_at: {
        [this.model.sequelize.Sequelize.Op.lt]: cutoffDate,
      },
    };

    return await this.delete(where);
  }

  // Fallback methods for in-memory storage
  fallbackCreate(data) {
    const analysis = {
      ...data,
      id: data.id || uuidv4(),
      created_at: new Date(),
      updated_at: new Date(),
    };
    this.fallbackStorage.set(analysis.id, analysis);
    return Promise.resolve(analysis);
  }

  fallbackFindById(id) {
    const analysis = this.fallbackStorage.get(id);
    return Promise.resolve(analysis || null);
  }

  fallbackFindOne(where) {
    for (const analysis of this.fallbackStorage.values()) {
      if (this.matchesWhere(analysis, where)) {
        return Promise.resolve(analysis);
      }
    }
    return Promise.resolve(null);
  }

  fallbackFindAll(where) {
    const results = [];
    for (const analysis of this.fallbackStorage.values()) {
      if (this.matchesWhere(analysis, where)) {
        results.push(analysis);
      }
    }
    return Promise.resolve(results);
  }

  fallbackFindAndCountAll(where, options = {}) {
    const allResults = [];
    for (const analysis of this.fallbackStorage.values()) {
      if (this.matchesWhere(analysis, where)) {
        allResults.push(analysis);
      }
    }

    // Sort results
    if (options.order) {
      const [field, direction] = options.order[0];
      allResults.sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        if (direction === 'DESC') {
          return bVal > aVal ? 1 : -1;
        } else {
          return aVal > bVal ? 1 : -1;
        }
      });
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || allResults.length;
    const rows = allResults.slice(offset, offset + limit);

    return Promise.resolve({
      rows,
      count: allResults.length,
      totalPages: limit ? Math.ceil(allResults.length / limit) : 1,
      currentPage: limit ? Math.floor(offset / limit) + 1 : 1,
    });
  }

  fallbackUpdateById(id, data) {
    const existing = this.fallbackStorage.get(id);
    if (!existing) {
      return Promise.resolve(null);
    }

    const updated = {
      ...existing,
      ...data,
      updated_at: new Date(),
    };
    this.fallbackStorage.set(id, updated);
    return Promise.resolve(updated);
  }

  fallbackDeleteById(id) {
    const deleted = this.fallbackStorage.delete(id);
    return Promise.resolve(deleted);
  }

  fallbackCount(where) {
    let count = 0;
    for (const analysis of this.fallbackStorage.values()) {
      if (this.matchesWhere(analysis, where)) {
        count++;
      }
    }
    return Promise.resolve(count);
  }

  fallbackGetStatistics(userId) {
    let total = 0, completed = 0, failed = 0, processing = 0;

    for (const analysis of this.fallbackStorage.values()) {
      if (!userId || analysis.user_id === userId) {
        total++;
        switch (analysis.status) {
        case 'completed': completed++; break;
        case 'failed': failed++; break;
        case 'processing': processing++; break;
        }
      }
    }

    return Promise.resolve({
      total,
      completed,
      failed,
      processing,
      pending: total - completed - failed - processing,
      success_rate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0,
    });
  }

  /**
   * Helper method to check if an object matches where conditions
   * @param {Object} obj - Object to check
   * @param {Object} where - Where conditions
   * @returns {boolean} Whether object matches
   */
  matchesWhere(obj, where) {
    for (const [key, value] of Object.entries(where)) {
      if (obj[key] !== value) {
        return false;
      }
    }
    return true;
  }
}

module.exports = AnalysisRepository;