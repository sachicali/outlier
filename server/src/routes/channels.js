const express = require('express');
const youtubeService = require('../services/youtubeService');
const { authenticate, requireScopes } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const logger = require('../utils/logger');

const router = express.Router();

// Search for channels
router.get('/search',
  authenticate,
  requirePermission('analysis:read'),
  requireScopes(['read']), // For API key access
  async (req, res, next) => {
    try {
      const { q: query, maxResults = 25, minSubs = 10000, maxSubs = 500000 } = req.query;

      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Query parameter is required',
        });
      }

      const channels = await youtubeService.searchChannels(query, parseInt(maxResults), {
        min: parseInt(minSubs),
        max: parseInt(maxSubs),
      });

      res.json({
        success: true,
        channels,
        count: channels.length,
      });

    } catch (error) {
      next(error);
    }
  });

// Get channel information
router.get('/:channelId',
  authenticate,
  requirePermission('analysis:read'),
  requireScopes(['read']), // For API key access
  async (req, res, next) => {
    try {
      const { channelId } = req.params;
      const channelInfo = await youtubeService.getChannelInfo(channelId);

      res.json({
        success: true,
        channel: channelInfo,
      });

    } catch (error) {
      next(error);
    }
  });

// Get channel videos
router.get('/:channelId/videos',
  authenticate,
  requirePermission('analysis:read'),
  requireScopes(['read']), // For API key access
  async (req, res, next) => {
    try {
      const { channelId } = req.params;
      const { maxResults = 10, timeWindow = 7 } = req.query;

      const publishedAfter = new Date();
      publishedAfter.setDate(publishedAfter.getDate() - parseInt(timeWindow));

      const videos = await youtubeService.getChannelVideos(
        channelId,
        parseInt(maxResults),
        publishedAfter.toISOString(),
      );

      res.json({
        success: true,
        videos,
        count: videos.length,
      });

    } catch (error) {
      next(error);
    }
  });

module.exports = router;
