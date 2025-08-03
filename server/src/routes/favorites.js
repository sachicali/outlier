const express = require('express');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// In-memory storage for favorites (in production, use database)
const userFavorites = new Map();

// Get user's favorite channels
router.get('/channels',
  authenticate,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const favorites = userFavorites.get(userId) || [];
      
      res.json({
        success: true,
        favorites
      });
    } catch (error) {
      logger.error('Error fetching favorites:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });

// Add channel to favorites
router.post('/channels/:channelId',
  authenticate,
  async (req, res) => {
    try {
      const { channelId } = req.params;
      const userId = req.user.id;
      const { channelData } = req.body;
      
      let favorites = userFavorites.get(userId) || [];
      
      // Check if already favorited
      if (favorites.some(fav => fav.id === channelId)) {
        return res.status(400).json({
          success: false,
          message: 'Channel already in favorites'
        });
      }
      
      // Add to favorites
      const favoriteChannel = {
        id: channelId,
        name: channelData?.name || 'Unknown Channel',
        subscriberCount: channelData?.subscriberCount || 0,
        thumbnailUrl: channelData?.thumbnailUrl,
        channelUrl: channelData?.channelUrl || `https://youtube.com/channel/${channelId}`,
        addedAt: new Date().toISOString(),
        lastAnalyzed: channelData?.lastAnalyzed,
        avgOutlierScore: channelData?.avgOutlierScore || 0,
        isFavorited: true
      };
      
      favorites.push(favoriteChannel);
      userFavorites.set(userId, favorites);
      
      res.json({
        success: true,
        message: 'Channel added to favorites',
        favorite: favoriteChannel
      });
    } catch (error) {
      logger.error('Error adding favorite:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });

// Remove channel from favorites
router.delete('/channels/:channelId',
  authenticate,
  async (req, res) => {
    try {
      const { channelId } = req.params;
      const userId = req.user.id;
      
      let favorites = userFavorites.get(userId) || [];
      const initialLength = favorites.length;
      
      favorites = favorites.filter(fav => fav.id !== channelId);
      
      if (favorites.length === initialLength) {
        return res.status(404).json({
          success: false,
          message: 'Channel not found in favorites'
        });
      }
      
      userFavorites.set(userId, favorites);
      
      res.json({
        success: true,
        message: 'Channel removed from favorites'
      });
    } catch (error) {
      logger.error('Error removing favorite:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });

// Check if channel is favorited
router.get('/channels/:channelId/status',
  authenticate,
  async (req, res) => {
    try {
      const { channelId } = req.params;
      const userId = req.user.id;
      
      const favorites = userFavorites.get(userId) || [];
      const isFavorited = favorites.some(fav => fav.id === channelId);
      
      res.json({
        success: true,
        isFavorited
      });
    } catch (error) {
      logger.error('Error checking favorite status:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });

module.exports = router;