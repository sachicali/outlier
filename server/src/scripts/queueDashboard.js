#!/usr/bin/env node

const queueService = require('../services/queueService');
const logger = require('../utils/logger');
const { JOB_QUEUES } = require('../queues/jobTypes');

class QueueDashboard {
  constructor() {
    this.refreshInterval = 5000; // 5 seconds
    this.isRunning = false;
  }

  async start() {
    try {
      console.log('🚀 Starting Queue Dashboard...');
      
      // Initialize queue service
      await queueService.initialize();
      console.log('✅ Queue service initialized');
      
      this.isRunning = true;
      
      // Start dashboard loop
      await this.displayDashboard();
      
      // Setup refresh interval
      this.intervalId = setInterval(() => {
        if (this.isRunning) {
          this.displayDashboard().catch(error => {
            console.error('Dashboard error:', error.message);
          });
        }
      }, this.refreshInterval);
      
      // Setup graceful shutdown
      this.setupShutdown();
      
    } catch (error) {
      console.error('Failed to start queue dashboard:', error);
      process.exit(1);
    }
  }

  async displayDashboard() {
    try {
      // Clear screen (ANSI escape codes)
      process.stdout.write('\x1Bc');
      
      console.log('📊 YouTube Outlier Discovery - Queue Dashboard');
      console.log('=' .repeat(60));
      console.log();
      
      // Get queue statistics
      const stats = await queueService.getQueueStats();
      
      // Display current time
      console.log(`🕐 Last Updated: ${new Date().toLocaleString()}`);
      console.log();
      
      // Display queue stats
      for (const [queueName, queueStats] of Object.entries(stats)) {
        if (queueStats.error) {
          console.log(`❌ ${queueName}: ERROR - ${queueStats.error}`);
          continue;
        }
        
        const counts = queueStats.counts || {};
        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
        
        console.log(`📝 Queue: ${queueName.toUpperCase()}`);
        console.log(`   Total Jobs: ${total}`);
        console.log(`   ⏳ Waiting: ${counts.waiting || 0}`);
        console.log(`   🔄 Active: ${counts.active || 0}`);
        console.log(`   ✅ Completed: ${counts.completed || 0}`);
        console.log(`   ❌ Failed: ${counts.failed || 0}`);
        console.log(`   ⏸️  Delayed: ${counts.delayed || 0}`);
        console.log(`   🚫 Paused: ${counts.paused || 0}`);
        
        // Show recent active jobs
        if (queueStats.jobs?.active?.length > 0) {
          console.log(`   Recent Active Jobs:`);
          queueStats.jobs.active.slice(0, 3).forEach((job, index) => {
            const duration = Date.now() - job.processedOn;
            console.log(`     ${index + 1}. ${job.name} (${this.formatDuration(duration)})`);
          });
        }
        
        // Show recent failed jobs
        if (queueStats.jobs?.failed?.length > 0) {
          console.log(`   Recent Failed Jobs:`);
          queueStats.jobs.failed.slice(0, 2).forEach((job, index) => {
            console.log(`     ${index + 1}. ${job.name} - ${job.failedReason?.substring(0, 50)}...`);
          });
        }
        
        console.log();
      }
      
      // Display system info
      console.log('🖥️  System Information:');
      console.log(`   Node.js Version: ${process.version}`);
      console.log(`   Memory Usage: ${this.formatBytes(process.memoryUsage().rss)}`);
      console.log(`   Uptime: ${this.formatDuration(process.uptime() * 1000)}`);
      console.log();
      
      // Display controls
      console.log('🎮 Controls:');
      console.log('   Ctrl+C: Exit dashboard');
      console.log('   r: Refresh now');
      console.log('   c: Clear failed jobs');
      console.log('   p: Pause all queues');
      console.log('   u: Resume all queues');
      console.log();
      
    } catch (error) {
      console.error('Error displaying dashboard:', error.message);
    }
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  setupShutdown() {
    const shutdown = async (signal) => {
      console.log(`\n\n🛑 Received ${signal}. Shutting down dashboard...`);
      
      this.isRunning = false;
      
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }
      
      try {
        await queueService.shutdown();
        console.log('✅ Queue dashboard shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Setup keyboard input handling
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', async (key) => {
      const char = key.toString();
      
      switch (char.toLowerCase()) {
        case '\u0003': // Ctrl+C
          await shutdown('Ctrl+C');
          break;
        
        case 'r':
          console.log('🔄 Refreshing dashboard...');
          await this.displayDashboard();
          break;
        
        case 'c':
          console.log('🧹 Cleaning failed jobs...');
          await this.cleanFailedJobs();
          await this.displayDashboard();
          break;
        
        case 'p':
          console.log('⏸️  Pausing all queues...');
          await this.pauseAllQueues();
          await this.displayDashboard();
          break;
        
        case 'u':
          console.log('▶️  Resuming all queues...');
          await this.resumeAllQueues();
          await this.displayDashboard();
          break;
      }
    });
  }

  async cleanFailedJobs() {
    try {
      for (const queueName of Object.values(JOB_QUEUES)) {
        try {
          await queueService.cleanQueue(queueName, 0, 'failed');
        } catch (error) {
          console.log(`   ⚠️  Failed to clean ${queueName}: ${error.message}`);
        }
      }
      console.log('   ✅ Failed jobs cleaned');
    } catch (error) {
      console.log(`   ❌ Error cleaning failed jobs: ${error.message}`);
    }
  }

  async pauseAllQueues() {
    try {
      for (const queueName of Object.values(JOB_QUEUES)) {
        try {
          await queueService.pauseQueue(queueName);
        } catch (error) {
          console.log(`   ⚠️  Failed to pause ${queueName}: ${error.message}`);
        }
      }
      console.log('   ✅ All queues paused');
    } catch (error) {
      console.log(`   ❌ Error pausing queues: ${error.message}`);
    }
  }

  async resumeAllQueues() {
    try {
      for (const queueName of Object.values(JOB_QUEUES)) {
        try {
          await queueService.resumeQueue(queueName);
        } catch (error) {
          console.log(`   ⚠️  Failed to resume ${queueName}: ${error.message}`);
        }
      }
      console.log('   ✅ All queues resumed');
    } catch (error) {
      console.log(`   ❌ Error resuming queues: ${error.message}`);
    }
  }
}

// Start dashboard if this script is run directly
if (require.main === module) {
  const dashboard = new QueueDashboard();
  dashboard.start().catch(error => {
    console.error('Failed to start queue dashboard:', error);
    process.exit(1);
  });
}

module.exports = QueueDashboard;