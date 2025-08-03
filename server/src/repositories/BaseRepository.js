const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Base repository class providing common CRUD operations
 * All specific repositories should extend this class
 */
class BaseRepository {
  constructor(model, fallbackStorage = null) {
    this.model = model;
    this.fallbackStorage = fallbackStorage; // In-memory storage for dev mode
    this.useDatabase = !!model;
  }

  /**
   * Create a new record
   * @param {Object} data - Data to create
   * @param {Object} options - Sequelize options
   * @returns {Promise<Object>} Created record
   */
  async create(data, options = {}) {
    if (this.useDatabase) {
      try {
        const record = await this.model.create(data, options);
        return record.toJSON ? record.toJSON() : record;
      } catch (error) {
        logger.error(`Error creating ${this.model.name}:`, error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      return this.fallbackCreate(data);
    }
  }

  /**
   * Find record by primary key
   * @param {string} id - Record ID
   * @param {Object} options - Sequelize options
   * @returns {Promise<Object|null>} Found record or null
   */
  async findById(id, options = {}) {
    if (this.useDatabase) {
      try {
        const record = await this.model.findByPk(id, options);
        return record ? (record.toJSON ? record.toJSON() : record) : null;
      } catch (error) {
        logger.error(`Error finding ${this.model.name} by ID:`, error);
        throw error;
      }
    } else {
      return this.fallbackFindById(id);
    }
  }

  /**
   * Find one record by conditions
   * @param {Object} where - Where conditions
   * @param {Object} options - Sequelize options
   * @returns {Promise<Object|null>} Found record or null
   */
  async findOne(where, options = {}) {
    if (this.useDatabase) {
      try {
        const record = await this.model.findOne({ where, ...options });
        return record ? (record.toJSON ? record.toJSON() : record) : null;
      } catch (error) {
        logger.error(`Error finding ${this.model.name}:`, error);
        throw error;
      }
    } else {
      return this.fallbackFindOne(where);
    }
  }

  /**
   * Find all records by conditions
   * @param {Object} where - Where conditions
   * @param {Object} options - Sequelize options
   * @returns {Promise<Array>} Found records
   */
  async findAll(where = {}, options = {}) {
    if (this.useDatabase) {
      try {
        const records = await this.model.findAll({ where, ...options });
        return records.map(record => record.toJSON ? record.toJSON() : record);
      } catch (error) {
        logger.error(`Error finding all ${this.model.name}:`, error);
        throw error;
      }
    } else {
      return this.fallbackFindAll(where);
    }
  }

  /**
   * Find records with pagination
   * @param {Object} where - Where conditions
   * @param {Object} options - Options including limit, offset, order
   * @returns {Promise<Object>} Results with pagination info
   */
  async findAndCountAll(where = {}, options = {}) {
    if (this.useDatabase) {
      try {
        const result = await this.model.findAndCountAll({ where, ...options });
        return {
          rows: result.rows.map(record => record.toJSON ? record.toJSON() : record),
          count: result.count,
          totalPages: options.limit ? Math.ceil(result.count / options.limit) : 1,
          currentPage: options.offset && options.limit ? Math.floor(options.offset / options.limit) + 1 : 1,
        };
      } catch (error) {
        logger.error(`Error finding and counting ${this.model.name}:`, error);
        throw error;
      }
    } else {
      return this.fallbackFindAndCountAll(where, options);
    }
  }

  /**
   * Update record by ID
   * @param {string} id - Record ID
   * @param {Object} data - Data to update
   * @param {Object} options - Sequelize options
   * @returns {Promise<Object|null>} Updated record or null
   */
  async updateById(id, data, options = {}) {
    if (this.useDatabase) {
      try {
        const [affectedCount] = await this.model.update(data, {
          where: { id },
          ...options,
        });

        if (affectedCount > 0) {
          return await this.findById(id);
        }
        return null;
      } catch (error) {
        logger.error(`Error updating ${this.model.name}:`, error);
        throw error;
      }
    } else {
      return this.fallbackUpdateById(id, data);
    }
  }

  /**
   * Update records by conditions
   * @param {Object} where - Where conditions
   * @param {Object} data - Data to update
   * @param {Object} options - Sequelize options
   * @returns {Promise<number>} Number of affected records
   */
  async update(where, data, options = {}) {
    if (this.useDatabase) {
      try {
        const [affectedCount] = await this.model.update(data, {
          where,
          ...options,
        });
        return affectedCount;
      } catch (error) {
        logger.error(`Error updating ${this.model.name}:`, error);
        throw error;
      }
    } else {
      return this.fallbackUpdate(where, data);
    }
  }

  /**
   * Delete record by ID
   * @param {string} id - Record ID
   * @param {Object} options - Sequelize options
   * @returns {Promise<boolean>} Whether record was deleted
   */
  async deleteById(id, options = {}) {
    if (this.useDatabase) {
      try {
        const affectedCount = await this.model.destroy({
          where: { id },
          ...options,
        });
        return affectedCount > 0;
      } catch (error) {
        logger.error(`Error deleting ${this.model.name}:`, error);
        throw error;
      }
    } else {
      return this.fallbackDeleteById(id);
    }
  }

  /**
   * Delete records by conditions
   * @param {Object} where - Where conditions
   * @param {Object} options - Sequelize options
   * @returns {Promise<number>} Number of deleted records
   */
  async delete(where, options = {}) {
    if (this.useDatabase) {
      try {
        const affectedCount = await this.model.destroy({
          where,
          ...options,
        });
        return affectedCount;
      } catch (error) {
        logger.error(`Error deleting ${this.model.name}:`, error);
        throw error;
      }
    } else {
      return this.fallbackDelete(where);
    }
  }

  /**
   * Count records by conditions
   * @param {Object} where - Where conditions
   * @param {Object} options - Sequelize options
   * @returns {Promise<number>} Count of records
   */
  async count(where = {}, options = {}) {
    if (this.useDatabase) {
      try {
        return await this.model.count({ where, ...options });
      } catch (error) {
        logger.error(`Error counting ${this.model.name}:`, error);
        throw error;
      }
    } else {
      return this.fallbackCount(where);
    }
  }

  /**
   * Check if record exists
   * @param {Object} where - Where conditions
   * @returns {Promise<boolean>} Whether record exists
   */
  async exists(where) {
    const count = await this.count(where);
    return count > 0;
  }

  /**
   * Create or update record (upsert)
   * @param {Object} data - Data to upsert
   * @param {Object} options - Sequelize options
   * @returns {Promise<Object>} Upserted record
   */
  async upsert(data, options = {}) {
    if (this.useDatabase) {
      try {
        const [record, created] = await this.model.upsert(data, {
          returning: true,
          ...options,
        });
        return {
          record: record.toJSON ? record.toJSON() : record,
          created,
        };
      } catch (error) {
        logger.error(`Error upserting ${this.model.name}:`, error);
        throw error;
      }
    } else {
      return this.fallbackUpsert(data);
    }
  }

  // Fallback methods for in-memory storage (to be implemented by subclasses)
  fallbackCreate(data) {
    throw new Error('Fallback create method not implemented');
  }

  fallbackFindById(id) {
    throw new Error('Fallback findById method not implemented');
  }

  fallbackFindOne(where) {
    throw new Error('Fallback findOne method not implemented');
  }

  fallbackFindAll(where) {
    throw new Error('Fallback findAll method not implemented');
  }

  fallbackFindAndCountAll(where, options) {
    throw new Error('Fallback findAndCountAll method not implemented');
  }

  fallbackUpdateById(id, data) {
    throw new Error('Fallback updateById method not implemented');
  }

  fallbackUpdate(where, data) {
    throw new Error('Fallback update method not implemented');
  }

  fallbackDeleteById(id) {
    throw new Error('Fallback deleteById method not implemented');
  }

  fallbackDelete(where) {
    throw new Error('Fallback delete method not implemented');
  }

  fallbackCount(where) {
    throw new Error('Fallback count method not implemented');
  }

  fallbackUpsert(data) {
    throw new Error('Fallback upsert method not implemented');
  }

  /**
   * Execute raw SQL query
   * @param {string} sql - SQL query
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Query results
   */
  async query(sql, options = {}) {
    if (this.useDatabase) {
      try {
        return await this.model.sequelize.query(sql, options);
      } catch (error) {
        logger.error('Error executing raw query:', error);
        throw error;
      }
    } else {
      throw new Error('Raw queries not supported in fallback mode');
    }
  }

  /**
   * Start a database transaction
   * @returns {Promise<Transaction>} Database transaction
   */
  async transaction() {
    if (this.useDatabase) {
      return await this.model.sequelize.transaction();
    } else {
      // Return a mock transaction for fallback mode
      return {
        commit: async () => {},
        rollback: async () => {},
      };
    }
  }
}

module.exports = BaseRepository;