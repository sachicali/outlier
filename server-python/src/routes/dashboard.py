from flask import Blueprint, request, jsonify, g, Response
from middleware.auth import authenticate
from middleware.rbac import require_permission
from utils.logger import logger
from datetime import datetime, timedelta
import json
import csv
import io
from typing import Dict, List, Any

bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')

# Mock data generators for comprehensive dashboard
def generate_mock_dashboard_data(date_range: str = '30', user_id: str = None) -> Dict[str, Any]:
    """
    Generate comprehensive mock data for dashboard
    """
    import random
    from datetime import datetime, timedelta
    
    # Calculate date range
    days = int(date_range) if date_range.isdigit() else 30
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    # Generate daily usage data
    usage_data = []
    for i in range(days):
        date = start_date + timedelta(days=i)
        usage_data.append({
            'date': date.isoformat(),
            'analyses': random.randint(0, 8),
            'outliers': random.randint(5, 50),
            'processing_time': random.randint(30000, 180000)  # ms
        })
    
    # Generate mock activities
    activities = []
    activity_types = [
        ('analysis_started', 'Analysis started', 'info'),
        ('analysis_completed', 'Analysis completed successfully', 'success'),
        ('analysis_failed', 'Analysis failed due to API quota', 'error'),
        ('outlier_found', 'New outlier video discovered', 'success'),
        ('channel_favorited', 'Channel added to favorites', 'info'),
        ('export_generated', 'Report exported to Excel', 'success')
    ]
    
    for i in range(20):
        activity_type, title, severity = random.choice(activity_types)
        timestamp = (datetime.now() - timedelta(hours=random.randint(1, 72))).isoformat()
        
        activity = {
            'id': f'activity_{i}',
            'type': activity_type,
            'title': title,
            'description': f'Analysis #{random.randint(1000, 9999)} - {random.choice(["Gaming content", "Tech reviews", "Entertainment", "Education"])}',
            'timestamp': timestamp,
            'severity': severity
        }
        
        if activity_type in ['analysis_completed', 'outlier_found']:
            activity['metadata'] = {
                'analysisId': f'analysis_{random.randint(1000, 9999)}',
                'outlierCount': random.randint(5, 25),
                'processingTime': random.randint(30000, 180000)
            }
        
        activities.append(activity)
    
    # Generate mock analyses
    analyses = []
    statuses = ['completed', 'processing', 'failed', 'pending']
    
    for i in range(50):
        status = random.choice(statuses)
        started_at = (datetime.now() - timedelta(days=random.randint(0, days))).isoformat()
        
        analysis = {
            'id': f'analysis_{i}',
            'name': f'Analysis {i + 1}',
            'status': status,
            'started_at': started_at,
            'total_channels_analyzed': random.randint(10, 50) if status == 'completed' else None,
            'total_outliers_found': random.randint(5, 30) if status == 'completed' else None,
            'processing_time_ms': random.randint(30000, 180000) if status == 'completed' else None
        }
        
        if status == 'completed':
            analysis['completed_at'] = (datetime.fromisoformat(started_at) + timedelta(minutes=random.randint(5, 30))).isoformat()
        elif status == 'processing':
            analysis['progress'] = random.randint(10, 90)
        elif status == 'failed':
            analysis['failed_at'] = (datetime.fromisoformat(started_at) + timedelta(minutes=random.randint(1, 10))).isoformat()
            analysis['error_message'] = 'API quota exceeded'
        
        analyses.append(analysis)
    
    # Generate saved channels and videos
    saved_channels = []
    saved_videos = []
    
    channel_names = ['TechReviewer', 'GameMaster', 'EduContent', 'FunnyClips', 'NewsUpdate']
    for i, name in enumerate(channel_names):
        saved_channels.append({
            'id': f'channel_{i}',
            'name': name,
            'subscriberCount': random.randint(50000, 500000),
            'avgOutlierScore': round(random.uniform(15, 45), 1),
            'lastAnalyzed': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'savedAt': (datetime.now() - timedelta(days=random.randint(1, 60))).isoformat(),
            'analysisCount': random.randint(3, 15),
            'tags': random.sample(['gaming', 'tech', 'entertainment', 'education', 'trending'], 2)
        })
    
    video_titles = [
        'Amazing Gaming Moments Compilation',
        'Latest Tech Gadget Review',
        'Funny Fails Collection',
        'Educational Science Experiment',
        'Breaking News Analysis'
    ]
    
    for i, title in enumerate(video_titles):
        saved_videos.append({
            'id': f'video_{i}',
            'title': title,
            'channelName': random.choice(channel_names),
            'channelId': f'channel_{random.randint(0, 4)}',
            'outlierScore': round(random.uniform(20, 50), 1),
            'views': random.randint(100000, 2000000),
            'publishedAt': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat(),
            'savedAt': (datetime.now() - timedelta(days=random.randint(1, 15))).isoformat(),
            'tags': random.sample(['viral', 'trending', 'popular', 'recommended'], 2)
        })
    
    # Calculate metrics
    total_analyses = len([a for a in analyses if a['status'] in ['completed', 'failed']])
    completed_analyses = len([a for a in analyses if a['status'] == 'completed'])
    total_outliers = sum([a.get('total_outliers_found', 0) for a in analyses if a['status'] == 'completed'])
    avg_processing_time = sum([a.get('processing_time_ms', 0) for a in analyses if a['status'] == 'completed']) / max(completed_analyses, 1)
    success_rate = (completed_analyses / max(total_analyses, 1)) * 100
    
    # Previous period comparison (mock)
    prev_analyses = max(total_analyses - random.randint(5, 15), 0)
    prev_outliers = max(total_outliers - random.randint(20, 50), 0)
    
    return {
        'overview': {
            'metrics': {
                'totalAnalyses': total_analyses,
                'totalOutliers': total_outliers,
                'avgProcessingTime': avg_processing_time,
                'uniqueChannels': len(saved_channels),
                'successRate': success_rate,
                'last30Days': {
                    'analyses': len([a for a in analyses if (datetime.now() - datetime.fromisoformat(a['started_at'])).days <= 30]),
                    'outliers': sum([a.get('total_outliers_found', 0) for a in analyses if a['status'] == 'completed' and (datetime.now() - datetime.fromisoformat(a['started_at'])).days <= 30]),
                    'channels': len(saved_channels)
                },
                'previousPeriod': {
                    'analyses': prev_analyses,
                    'outliers': prev_outliers,
                    'channels': max(len(saved_channels) - 2, 0)
                }
            },
            'quickStats': {
                'todayAnalyses': len([a for a in analyses if (datetime.now() - datetime.fromisoformat(a['started_at'])).days == 0]),
                'weekAnalyses': len([a for a in analyses if (datetime.now() - datetime.fromisoformat(a['started_at'])).days <= 7]),
                'monthAnalyses': len([a for a in analyses if (datetime.now() - datetime.fromisoformat(a['started_at'])).days <= 30]),
                'avgOutliersPerAnalysis': total_outliers / max(completed_analyses, 1)
            }
        },
        'analytics': {
            'usageChart': {
                'data': usage_data,
                'summary': {
                    'totalDataPoints': len(usage_data),
                    'peakDay': max(usage_data, key=lambda x: x['analyses'])['date'],
                    'averageDaily': sum([d['analyses'] for d in usage_data]) / len(usage_data)
                }
            },
            'channelAnalytics': {
                'topChannels': saved_channels[:5],
                'channelCategories': [
                    {'category': 'Gaming', 'count': random.randint(10, 30), 'percentage': random.randint(20, 40)},
                    {'category': 'Tech', 'count': random.randint(5, 20), 'percentage': random.randint(15, 25)},
                    {'category': 'Entertainment', 'count': random.randint(8, 25), 'percentage': random.randint(18, 30)},
                    {'category': 'Education', 'count': random.randint(3, 15), 'percentage': random.randint(10, 20)}
                ]
            }
        },
        'quota': {
            'current': {
                'used': random.randint(3000, 8000),
                'limit': 10000,
                'remaining': 10000 - random.randint(3000, 8000),
                'percentage': random.randint(30, 80)
            },
            'daily': {
                'used': random.randint(500, 2000),
                'limit': 10000,
                'resetTime': (datetime.now() + timedelta(hours=random.randint(1, 23))).isoformat()
            },
            'monthly': {
                'used': random.randint(15000, 80000),
                'limit': 100000,
                'resetDate': (datetime.now() + timedelta(days=random.randint(1, 30))).isoformat()
            },
            'forecast': {
                'projectedDailyUsage': random.randint(800, 1500),
                'projectedMonthlyUsage': random.randint(25000, 45000),
                'estimatedRemainingDays': random.randint(5, 20)
            }
        },
        'activities': activities,
        'performance': {
            'metrics': {
                'avgProcessingTime': avg_processing_time,
                'medianProcessingTime': avg_processing_time * 0.8,
                'successRate': success_rate,
                'errorRate': 100 - success_rate,
                'avgOutliersPerAnalysis': total_outliers / max(completed_analyses, 1),
                'avgChannelsPerAnalysis': sum([a.get('total_channels_analyzed', 0) for a in analyses if a['status'] == 'completed']) / max(completed_analyses, 1)
            },
            'timeDistribution': [
                {'timeRange': '< 1 min', 'count': random.randint(5, 15), 'percentage': random.randint(10, 20)},
                {'timeRange': '1-3 min', 'count': random.randint(15, 25), 'percentage': random.randint(30, 40)},
                {'timeRange': '3-5 min', 'count': random.randint(8, 18), 'percentage': random.randint(20, 30)},
                {'timeRange': '> 5 min', 'count': random.randint(2, 8), 'percentage': random.randint(5, 15)}
            ],
            'errorAnalysis': [
                {'errorType': 'API Quota Exceeded', 'count': random.randint(2, 8), 'lastOccurrence': (datetime.now() - timedelta(hours=random.randint(1, 48))).isoformat()},
                {'errorType': 'Network Timeout', 'count': random.randint(1, 5), 'lastOccurrence': (datetime.now() - timedelta(hours=random.randint(12, 72))).isoformat()}
            ],
            'performanceTrends': usage_data
        },
        'trends': {
            'outliersOverTime': usage_data,
            'channelTrends': [
                {
                    'channelName': channel['name'],
                    'trend': random.choice(['up', 'down', 'stable']),
                    'changePercentage': round(random.uniform(-20, 30), 1),
                    'data': usage_data[:7]  # Last week
                } for channel in saved_channels[:5]
            ],
            'seasonalPatterns': {
                'hourlyDistribution': [
                    {'hour': hour, 'analysisCount': random.randint(0, 5), 'outlierRate': round(random.uniform(0.1, 0.8), 2)}
                    for hour in range(24)
                ],
                'weeklyDistribution': [
                    {'dayOfWeek': day, 'analysisCount': random.randint(5, 20), 'outlierRate': round(random.uniform(0.2, 0.7), 2)}
                    for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                ]
            }
        },
        'history': {
            'analyses': analyses,
            'pagination': {
                'page': 1,
                'limit': 50,
                'total': len(analyses),
                'totalPages': (len(analyses) + 49) // 50
            },
            'summary': {
                'totalAnalyses': total_analyses,
                'completedAnalyses': completed_analyses,
                'failedAnalyses': len([a for a in analyses if a['status'] == 'failed']),
                'avgProcessingTime': avg_processing_time
            }
        },
        'saved': {
            'channels': saved_channels,
            'videos': saved_videos,
            'collections': [],
            'summary': {
                'totalChannels': len(saved_channels),
                'totalVideos': len(saved_videos),
                'totalCollections': 0
            }
        },
        'account': {
            'apiKeys': [
                {
                    'id': 'key_1',
                    'name': 'Production API',
                    'key': 'yt_outlier_' + ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=32)),
                    'permissions': ['analysis:read', 'analysis:create', 'dashboard:read'],
                    'usageCount': random.randint(100, 1000),
                    'lastUsed': (datetime.now() - timedelta(hours=random.randint(1, 24))).isoformat(),
                    'createdAt': (datetime.now() - timedelta(days=random.randint(30, 90))).isoformat(),
                    'expiresAt': (datetime.now() + timedelta(days=random.randint(30, 365))).isoformat(),
                    'isActive': True
                }
            ],
            'notifications': {
                'email': {
                    'analysisComplete': True,
                    'analysisError': True,
                    'quotaWarning': True,
                    'weeklyReport': False,
                    'monthlyReport': True
                },
                'push': {
                    'analysisComplete': True,
                    'analysisError': True,
                    'quotaWarning': True
                },
                'preferences': {
                    'quietHours': {
                        'enabled': False,
                        'start': '22:00',
                        'end': '08:00'
                    },
                    'frequency': 'immediate'
                }
            }
        }
    }

@bp.route('/comprehensive', methods=['GET'])
@authenticate
@require_permission('dashboard:read')
def get_comprehensive_dashboard():
    """
    Get comprehensive dashboard data for the new dashboard interface
    """
    try:
        user_id = g.user['id']
        date_range = request.args.get('range', '30')
        timezone = request.args.get('timezone', 'UTC')
        compare = request.args.get('compare', 'previous_period')
        
        # Generate comprehensive mock data
        dashboard_data = generate_mock_dashboard_data(date_range, user_id)
        
        return jsonify(dashboard_data), 200
    except Exception as e:
        logger.error(f"Error fetching comprehensive dashboard data: {e}")
        return jsonify({'error': 'Failed to fetch dashboard data'}), 500

@bp.route('/export/<format>', methods=['GET'])
@authenticate
@require_permission('dashboard:read')
def export_dashboard(format):
    """
    Export dashboard data in various formats
    """
    try:
        user_id = g.user['id']
        date_range = request.args.get('range', '30')
        tab = request.args.get('tab', 'overview')
        
        # Generate mock data
        dashboard_data = generate_mock_dashboard_data(date_range, user_id)
        
        if format == 'excel':
            # In a real implementation, this would generate an Excel file
            # For now, return CSV data
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write header
            writer.writerow(['Metric', 'Value', 'Change %', 'Period'])
            
            # Write metrics data
            metrics = dashboard_data['overview']['metrics']
            writer.writerow(['Total Analyses', metrics['totalAnalyses'], '', date_range + ' days'])
            writer.writerow(['Total Outliers', metrics['totalOutliers'], '', date_range + ' days'])
            writer.writerow(['Success Rate', f"{metrics['successRate']:.1f}%", '', date_range + ' days'])
            writer.writerow(['Unique Channels', metrics['uniqueChannels'], '', date_range + ' days'])
            
            csv_data = output.getvalue()
            output.close()
            
            return Response(
                csv_data,
                mimetype='text/csv',
                headers={"Content-disposition": f"attachment; filename=dashboard-{tab}-{datetime.now().strftime('%Y%m%d')}.csv"}
            )
        
        elif format == 'pdf':
            # In a real implementation, this would generate a PDF
            return jsonify({'message': 'PDF export not yet implemented'}), 501
        
        else:
            return jsonify({'error': 'Unsupported format'}), 400
            
    except Exception as e:
        logger.error(f"Error exporting dashboard data: {e}")
        return jsonify({'error': 'Failed to export dashboard data'}), 500

@bp.route('/stats', methods=['GET'])
@authenticate
@require_permission('dashboard:read')
def get_dashboard_stats():
    """
    Get basic dashboard statistics (legacy endpoint)
    """
    try:
        user_id = g.user['id']
        
        # Generate basic mock data for backward compatibility
        dashboard_data = generate_mock_dashboard_data('30', user_id)
        overview = dashboard_data['overview']['metrics']
        
        return jsonify({
            'totalAnalyses': overview['totalAnalyses'],
            'completedAnalyses': len([a for a in dashboard_data['history']['analyses'] if a['status'] == 'completed']),
            'failedAnalyses': len([a for a in dashboard_data['history']['analyses'] if a['status'] == 'failed']),
            'totalOutliersFound': overview['totalOutliers'],
            'favoriteChannels': len(dashboard_data['saved']['channels']),
            'recentAnalyses': dashboard_data['history']['analyses'][:10]
        }), 200
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {e}")
        return jsonify({'error': 'Failed to fetch dashboard statistics'}), 500

@bp.route('/recent-analyses', methods=['GET'])
@authenticate
@require_permission('dashboard:read')
def get_recent_analyses():
    """
    Get recent analyses for the user
    """
    try:
        user_id = g.user['id']
        # In a real implementation, this would query the database for recent analyses
        return jsonify({
            'analyses': []
        }), 200
    except Exception as e:
        logger.error(f"Error fetching recent analyses: {e}")
        return jsonify({'error': 'Failed to fetch recent analyses'}), 500

@bp.route('/popular-channels', methods=['GET'])
@authenticate
@require_permission('dashboard:read')
def get_popular_channels():
    """
    Get popular channels
    """
    try:
        # In a real implementation, this would query the database for popular channels
        return jsonify({
            'channels': []
        }), 200
    except Exception as e:
        logger.error(f"Error fetching popular channels: {e}")
        return jsonify({'error': 'Failed to fetch popular channels'}), 500