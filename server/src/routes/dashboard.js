const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getAnalysisRepository } = require('../repositories');
const logger = require('../utils/logger');
const { Parser } = require('json2csv');

const router = express.Router();

// Get repository instance
let analysisRepository;
getAnalysisRepository().then(repo => {
  analysisRepository = repo;
}).catch(error => {
  logger.error('Error initializing analysis repository:', error);
});

// Get dashboard data
router.get('/',
  authenticate,
  async (req, res) => {
    try {
      const { range = '30' } = req.query;
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';
      
      const days = parseInt(range);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get all analyses for the user (or all if admin)
      const analyses = await analysisRepository.findByUserId(
        isAdmin ? null : userId
      );

      // Calculate metrics
      const totalAnalyses = analyses.length;
      const totalOutliers = analyses.reduce((sum, analysis) => 
        sum + (analysis.total_outliers_found || 0), 0
      );
      
      const completedAnalyses = analyses.filter(a => a.status === 'completed' && a.processing_time_ms);
      const avgProcessingTime = completedAnalyses.length > 0 
        ? completedAnalyses.reduce((sum, a) => sum + a.processing_time_ms, 0) / completedAnalyses.length
        : 0;

      // Count unique channels from analysis configs
      const uniqueChannelsSet = new Set();
      analyses.forEach(analysis => {
        if (analysis.config?.exclusionChannels) {
          analysis.config.exclusionChannels.forEach(channel => 
            uniqueChannelsSet.add(channel)
          );
        }
      });
      const uniqueChannels = uniqueChannelsSet.size;

      // Calculate last period metrics
      const lastPeriodAnalyses = analyses.filter(a => 
        new Date(a.started_at) >= startDate
      );
      const last30DaysOutliers = lastPeriodAnalyses.reduce((sum, analysis) => 
        sum + (analysis.total_outliers_found || 0), 0
      );

      // Generate usage data for chart
      const usageData = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayAnalyses = analyses.filter(a => {
          const analysisDate = new Date(a.started_at).toISOString().split('T')[0];
          return analysisDate === dateStr;
        });
        
        const dayOutliers = dayAnalyses.reduce((sum, a) => 
          sum + (a.total_outliers_found || 0), 0
        );
        
        usageData.push({
          date: dateStr,
          analyses: dayAnalyses.length,
          outliers: dayOutliers
        });
      }

      // Mock quota usage (in real implementation, track actual API calls)
      const quotaUsage = {
        used: Math.floor(Math.random() * 8000) + 1000, // Mock data
        limit: 10000,
        period: 'daily'
      };

      // Get recent outliers from completed analyses
      const recentOutliers = [];
      const recentCompletedAnalyses = analyses
        .filter(a => a.status === 'completed' && a.results)
        .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
        .slice(0, 3);

      recentCompletedAnalyses.forEach(analysis => {
        if (analysis.results && Array.isArray(analysis.results)) {
          const topOutliers = analysis.results
            .sort((a, b) => (b.outlierScore || 0) - (a.outlierScore || 0))
            .slice(0, 5);
          
          topOutliers.forEach(outlier => {
            recentOutliers.push({
              id: outlier.id?.videoId || outlier.videoId || Math.random().toString(),
              title: outlier.snippet?.title || 'Unknown Title',
              channelName: outlier.channelInfo?.snippet?.title || 'Unknown Channel',
              views: parseInt(outlier.statistics?.viewCount || 0),
              outlierScore: outlier.outlierScore || 0,
              publishedAt: outlier.snippet?.publishedAt || new Date().toISOString(),
              analysisId: analysis.id,
              thumbnailUrl: outlier.snippet?.thumbnails?.medium?.url,
              videoUrl: `https://youtube.com/watch?v=${outlier.id?.videoId || outlier.videoId}`
            });
          });
        }
      });

      // Sort and limit recent outliers
      recentOutliers.sort((a, b) => b.outlierScore - a.outlierScore);
      const limitedRecentOutliers = recentOutliers.slice(0, 10);

      // Mock favorite channels (in real implementation, fetch from favorites table)
      const favoriteChannels = [
        {
          id: 'channel1',
          name: 'Sample Gaming Channel',
          subscriberCount: 125000,
          lastAnalyzed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          avgOutlierScore: 65.2,
          isFavorited: true
        },
        {
          id: 'channel2',
          name: 'Tech Reviews Pro',
          subscriberCount: 89000,
          lastAnalyzed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          avgOutlierScore: 42.8,
          isFavorited: true
        }
      ];

      res.json({
        success: true,
        metrics: {
          totalAnalyses,
          totalOutliers,
          avgProcessingTime,
          uniqueChannels,
          last30Days: {
            analyses: lastPeriodAnalyses.length,
            outliers: last30DaysOutliers
          }
        },
        recentAnalyses: analyses
          .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
          .slice(0, 20)
          .map(analysis => ({
            id: analysis.id,
            name: analysis.name,
            status: analysis.status,
            started_at: analysis.started_at,
            completed_at: analysis.completed_at,
            total_outliers_found: analysis.total_outliers_found,
            total_channels_analyzed: analysis.total_channels_analyzed,
            processing_time_ms: analysis.processing_time_ms,
            config: {
              exclusionChannels: analysis.config?.exclusionChannels || [],
              timeWindow: analysis.config?.timeWindow || 7,
              minSubs: analysis.config?.minSubs,
              maxSubs: analysis.config?.maxSubs
            }
          })),
        usageData,
        quotaUsage,
        recentOutliers: limitedRecentOutliers,
        favoriteChannels
      });
    } catch (error) {
      logger.error('Error fetching dashboard data:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });

// Export analysis history as CSV
router.get('/export',
  authenticate,
  async (req, res) => {
    try {
      const { range = '30', search = '', status = 'all' } = req.query;
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';
      
      // Get analyses
      let analyses = await analysisRepository.findByUserId(
        isAdmin ? null : userId
      );

      // Apply filters
      if (search) {
        analyses = analyses.filter(analysis => 
          (analysis.name && analysis.name.toLowerCase().includes(search.toLowerCase())) ||
          analysis.id.toLowerCase().includes(search.toLowerCase())
        );
      }

      if (status !== 'all') {
        analyses = analyses.filter(analysis => analysis.status === status);
      }

      // Apply date range
      const days = parseInt(range);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      analyses = analyses.filter(a => new Date(a.started_at) >= startDate);

      // Prepare CSV data
      const csvData = analyses.map(analysis => ({
        'Analysis ID': analysis.id,
        'Name': analysis.name || `Analysis ${analysis.id.slice(0, 8)}`,
        'Status': analysis.status,
        'Started At': analysis.started_at,
        'Completed At': analysis.completed_at || 'N/A',
        'Processing Time (seconds)': analysis.processing_time_ms ? Math.round(analysis.processing_time_ms / 1000) : 'N/A',
        'Outliers Found': analysis.total_outliers_found || 0,
        'Channels Analyzed': analysis.total_channels_analyzed || 0,
        'Min Subscribers': analysis.config?.minSubs || 'N/A',
        'Max Subscribers': analysis.config?.maxSubs || 'N/A',
        'Time Window (days)': analysis.config?.timeWindow || 'N/A',
        'Exclusion Channels': analysis.config?.exclusionChannels ? analysis.config.exclusionChannels.join('; ') : 'None'
      }));

      const fields = [
        'Analysis ID',
        'Name',
        'Status',
        'Started At',
        'Completed At',
        'Processing Time (seconds)',
        'Outliers Found',
        'Channels Analyzed',
        'Min Subscribers',
        'Max Subscribers',
        'Time Window (days)',
        'Exclusion Channels'
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(csvData);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analysis-history-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      logger.error('Error exporting dashboard data:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });

// Get detailed analysis view
router.get('/analysis/:analysisId',
  authenticate,
  async (req, res) => {
    try {
      const { analysisId } = req.params;
      const analysis = await analysisRepository.findById(analysisId);

      if (!analysis) {
        return res.status(404).json({
          success: false,
          message: 'Analysis not found'
        });
      }

      // Check ownership (users can only access their own analyses, admins can access all)
      if (analysis.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.json({
        success: true,
        analysis: {
          id: analysis.id,
          name: analysis.name,
          description: analysis.description,
          status: analysis.status,
          started_at: analysis.started_at,
          completed_at: analysis.completed_at,
          config: analysis.config,
          processing_time_ms: analysis.processing_time_ms,
          total_outliers_found: analysis.total_outliers_found,
          total_channels_analyzed: analysis.total_channels_analyzed,
          error_message: analysis.error_message,
          results: analysis.results,
          summary: analysis.summary
        }
      });
    } catch (error) {
      logger.error('Error fetching analysis details:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });

module.exports = router;