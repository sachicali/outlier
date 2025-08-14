import os
import re
import json
import uuid
from datetime import datetime, timedelta
from utils.logger import logger
from .youtube_service import YouTubeService
from db import redis_client

class OutlierDetectionService:
    def __init__(self, socketio=None):
        self.youtube_service = YouTubeService()
        self.socketio = None  # Not using socketio for now
        self.analysis_progress = {}
        self.exclusion_games = set()

    def _emit_progress(self, analysis_id, step, progress, message, data=None):
        """Store progress updates in Redis (no WebSocket for now)"""
        progress_data = {
            'analysisId': analysis_id,
            'step': step,
            'progress': progress,
            'message': message
        }
        
        if data:
            progress_data['data'] = data
            
        # Store progress in Redis
        redis_client.setex(f'analysis_progress:{analysis_id}', 3600, json.dumps(progress_data))
        
        logger.info(f"Analysis {analysis_id} - Step: {step}, Progress: {progress}%, Message: {message}")

    def get_analysis_status(self, analysis_id):
        """Get analysis status from Redis"""
        data = redis_client.get(f'analysis_progress:{analysis_id}')
        if data:
            return json.loads(data)
        return {'step': None, 'progress': 0, 'message': 'No progress found'}

    def _calculate_performance_score(self, views, subscribers):
        """Calculate performance score: (Views ÷ Subscribers) × 100"""
        if subscribers == 0:
            return 0
        return (views / subscribers) * 100

    def _extract_game_names(self, title, description=""):
        """Extract game names from video title and description"""
        # This is a simplified version. In production, this would use more sophisticated NLP
        games = ["minecraft", "fortnite", "valorant", "league of legends", "csgo", "apex legends", 
                 "roblox", "gta", "call of duty", "overwatch", "among us", "fall guys"]
        found_games = []
        text = (title + " " + description).lower()
        
        for game in games:
            if re.search(r'\b' + re.escape(game) + r'\b', text, re.IGNORECASE):
                found_games.append(game.lower())
        return found_games

    def _calculate_brand_fit(self, video, brand_config=None):
        """Calculate brand fit score for a video"""
        if not brand_config:
            brand_config = {
                'baseScore': 5,
                'positiveIndicators': [
                    {'keywords': ['fun', 'entertaining', 'awesome'], 'score': 1},
                    {'keywords': ['family-friendly', 'kids', 'clean'], 'score': 2},
                    {'keywords': ['high energy', 'exciting', 'epic'], 'score': 1}
                ],
                'negativeIndicators': [
                    {'keywords': ['violent', 'gore', 'swear'], 'score': -3},
                    {'descriptionKeywords': ['mature content', 'nsfw'], 'score': -2}
                ]
            }
        
        title = video['snippet']['title'].lower()
        description = video['snippet'].get('description', '').lower()
        
        score = brand_config['baseScore']
        
        # Apply positive indicators
        for indicator in brand_config['positiveIndicators']:
            if 'keywords' in indicator:
                for keyword in indicator['keywords']:
                    if keyword in title or keyword in description:
                        score += indicator['score']
        
        # Apply negative indicators
        for indicator in brand_config['negativeIndicators']:
            if 'keywords' in indicator:
                for keyword in indicator['keywords']:
                    if keyword in title:
                        score += indicator['score']
            if 'descriptionKeywords' in indicator:
                for keyword in indicator['descriptionKeywords']:
                    if keyword in description:
                        score += indicator['score']
        
        return max(0, min(10, score))  # Clamp between 0 and 10

    def _is_video_excluded(self, video):
        """Check if video should be excluded based on game/content"""
        title = video['snippet']['title'].lower()
        description = video['snippet'].get('description', '').lower()
        content = title + " " + description
        
        for excluded_game in self.exclusion_games:
            if excluded_game in content:
                return True
        return False

    def build_exclusion_list(self, channel_names, time_window_days=7):
        """Build exclusion list from competitor channels"""
        logger.info(f"Building exclusion list for channels: {channel_names}")
        
        published_after = datetime.utcnow() - timedelta(days=time_window_days)
        exclusion_games = set()
        
        for channel_name in channel_names:
            try:
                # Search for the channel
                channels = self.youtube_service.search_channels(channel_name, 5)
                target_channel = None
                for ch in channels:
                    if channel_name.lower() in ch['snippet']['title'].lower():
                        target_channel = ch
                        break
                
                if not target_channel:
                    logger.warn(f"Channel not found: {channel_name}")
                    continue
                
                # Get recent videos from the channel
                videos = self.youtube_service.get_channel_videos(
                    target_channel['id']['channelId'],
                    20,
                    published_after.isoformat() + 'Z'
                )
                
                # Extract game names from video titles and descriptions
                for video in videos:
                    games = self._extract_game_names(
                        video['snippet']['title'], 
                        video['snippet'].get('description', '')
                    )
                    exclusion_games.update(games)
                    
            except Exception as e:
                logger.error(f"Error processing channel {channel_name}: {e}")
        
        self.exclusion_games = exclusion_games
        logger.info(f"Built exclusion list with {len(exclusion_games)} games")
        return list(exclusion_games)

    def discover_adjacent_channels(self, search_queries, subscriber_range=None):
        """Discover adjacent channels based on search queries"""
        if subscriber_range is None:
            subscriber_range = {'min': 10000, 'max': 500000}
            
        logger.info("Discovering adjacent channels...")
        all_channels = {}
        
        for query in search_queries:
            try:
                channels = self.youtube_service.search_channels(query, 20)
                
                for channel in channels:
                    channel_id = channel['id']['channelId']
                    # Skip if already processed
                    if channel_id in all_channels:
                        continue
                    
                    # Get channel info with statistics
                    channel_info = self.youtube_service.get_channel_info(channel_id)
                    if not channel_info:
                        continue
                    
                    # Validate channel criteria (simplified)
                    stats = channel_info['statistics']
                    sub_count = int(stats.get('subscriberCount', 0))
                    video_count = int(stats.get('videoCount', 0))
                    
                    if (subscriber_range['min'] <= sub_count <= subscriber_range['max'] and 
                        video_count >= 10):
                        all_channels[channel_id] = channel_info
                        
            except Exception as e:
                logger.error(f"Error searching for query '{query}': {e}")
        
        logger.info(f"Discovered {len(all_channels)} qualified adjacent channels")
        return list(all_channels.values())

    def analyze_channel_outliers(self, channel_info, time_window_days=7, outlier_threshold=20, brand_fit_threshold=6):
        """Analyze a channel for outlier videos"""
        published_after = datetime.utcnow() - timedelta(days=time_window_days)
        
        try:
            # Get recent videos
            videos = self.youtube_service.get_channel_videos(
                channel_info['id'],
                15,
                published_after.isoformat() + 'Z'
            )
            
            if len(videos) < 3:
                logger.warn(f"Not enough recent videos for channel: {channel_info['snippet']['title']}")
                return []
            
            # Calculate outlier scores
            videos_with_scores = []
            for video in videos:
                views = int(video['statistics'].get('viewCount', 0))
                subscribers = int(channel_info['statistics'].get('subscriberCount', 1))
                
                outlier_score = self._calculate_performance_score(views, subscribers)
                brand_fit = self._calculate_brand_fit(video)
                
                videos_with_scores.append({
                    **video,
                    'channelInfo': channel_info,
                    'outlierScore': outlier_score,
                    'brandFit': brand_fit,
                    'isExcluded': self._is_video_excluded(video)
                })
            
            # Filter for actual outliers and not excluded
            outliers = [
                video for video in videos_with_scores
                if (video['outlierScore'] > outlier_threshold and 
                    video['brandFit'] > brand_fit_threshold and 
                    not video['isExcluded'])
            ]
            
            return outliers
            
        except Exception as e:
            logger.error(f"Error analyzing channel {channel_info['snippet']['title']}: {e}")
            return []

    def start_analysis(self, analysis_id, config, io=None):
        """Start a complete outlier analysis - matches Node.js implementation"""
        logger.info(f"Starting outlier analysis: {analysis_id}")
        
        try:
            # Step 1: Build exclusion list
            self._emit_progress(analysis_id, 0, 0, 'Building Exclusion Database')
            
            exclusion_list = self.build_exclusion_list(
                config.get('exclusionChannels', []),
                config.get('timeWindow', 7)
            )
            
            self._emit_progress(analysis_id, 0, 100, 'Building Exclusion Database', 
                              {'exclusionGames': exclusion_list})
            
            # Step 2: Discover adjacent channels
            self._emit_progress(analysis_id, 1, 0, 'Discovering Adjacent Channels')
            
            # Use default search queries for now
            search_queries = [
                'gaming', 'minecraft', 'fortnite', 'valorant', 
                'league of legends', 'csgo', 'apex legends'
            ]
            
            adjacent_channels = self.discover_adjacent_channels(
                search_queries,
                {'min': config.get('minSubs', 10000), 'max': config.get('maxSubs', 500000)}
            )
            
            self._emit_progress(analysis_id, 1, 100, 'Discovering Adjacent Channels')
            
            # Step 3-6: Analyze each channel for outliers
            all_outliers = []
            processed_channels = 0
            
            for channel in adjacent_channels:
                outliers = self.analyze_channel_outliers(
                    channel, 
                    config.get('timeWindow', 7),
                    config.get('outlierThreshold', 20),
                    config.get('brandFitThreshold', 6)
                )
                all_outliers.extend(outliers)
                
                processed_channels += 1
                progress = (processed_channels / len(adjacent_channels)) * 100
                
                self._emit_progress(analysis_id, 
                                  2 + int((progress / 100) * 4),  # Steps 2-5
                                  progress,
                                  f'Analyzing Channel {processed_channels}/{len(adjacent_channels)}')
            
            # Final ranking and filtering
            max_results = config.get('maxResults', 50)
            final_results = [
                outlier for outlier in all_outliers 
                if outlier['outlierScore'] >= config.get('outlierThreshold', 20)
            ]
            final_results.sort(key=lambda x: x['outlierScore'], reverse=True)
            final_results = final_results[:max_results]
            
            summary = {
                'totalOutliers': len(final_results),
                'channelsAnalyzed': len(adjacent_channels),
                'exclusionGames': len(exclusion_list)
            }
            
            # Store results in Redis
            redis_client.setex(f'analysis_results:{analysis_id}', 86400, json.dumps(final_results))
            
            # Update analysis status to completed
            analysis_data = redis_client.get(f'analysis:{analysis_id}')
            if analysis_data:
                analysis = json.loads(analysis_data)
                analysis['status'] = 'completed'
                analysis['summary'] = summary
                redis_client.setex(f'analysis:{analysis_id}', 86400, json.dumps(analysis))
            
            self._emit_progress(analysis_id, 6, 100, 'Analysis Complete', {
                'results': final_results,
                'summary': summary
            })
            
            logger.info(f"Analysis complete: {analysis_id}, found {len(final_results)} outliers")
            return final_results
            
        except Exception as e:
            logger.error(f"Analysis failed: {analysis_id}", exc_info=True)
            self._emit_progress(analysis_id, -1, 100, 'Analysis Failed', {'error': str(e)})
            
            # Update analysis status to failed
            analysis_data = redis_client.get(f'analysis:{analysis_id}')
            if analysis_data:
                analysis = json.loads(analysis_data)
                analysis['status'] = 'failed'
                analysis['error_message'] = str(e)
                redis_client.setex(f'analysis:{analysis_id}', 86400, json.dumps(analysis))
            
            raise e
