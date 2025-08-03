import os
import re
from collections import Counter
from ..utils.logger import logger
from .youtube_service import YouTubeService

class OutlierDetectionService:
    def __init__(self, socketio=None):
        self.youtube_service = YouTubeService()
        self.socketio = socketio
        self.analysis_progress = {}

    def _emit_progress(self, session_id, step, progress, message):
        if self.socketio:
            self.analysis_progress[session_id] = {'step': step, 'progress': progress, 'message': message}
            self.socketio.emit('analysis_progress', {
                'sessionId': session_id,
                'step': step,
                'progress': progress,
                'message': message
            })
            logger.info(f"Session {session_id} - Step: {step}, Progress: {progress}%, Message: {message}")

    def _calculate_performance_score(self, views, subscribers):
        if subscribers == 0:
            return 0
        return (views / subscribers) * 100

    def _extract_game_names(self, text):
        # This is a placeholder. A more robust solution would involve a game database or NLP.
        games = ["minecraft", "fortnite", "valorant", "league of legends", "csgo", "apex legends"]
        found_games = []
        for game in games:
            if re.search(r'\b' + re.escape(game) + r'\b', text, re.IGNORECASE):
                found_games.append(game)
        return found_games

    def _analyze_video_for_brand_fit(self, title, description, brand_keywords, family_friendly_keywords, high_energy_keywords):
        score = 0
        title_lower = title.lower()
        description_lower = description.lower()

        # Check for family-friendly content
        for keyword in family_friendly_keywords:
            if keyword in title_lower or keyword in description_lower:
                score += 1

        # Check for high-energy content
        for keyword in high_energy_keywords:
            if keyword in title_lower or keyword in description_lower:
                score += 1

        # Check for brand keywords
        for keyword in brand_keywords:
            if keyword in title_lower or keyword in description_lower:
                score += 2 # Higher weight for direct brand fit

        # Penalize for negative keywords (example)
        negative_keywords = ["violence", "gore", "swear"]
        for keyword in negative_keywords:
            if keyword in title_lower or keyword in description_lower:
                score -= 3

        return max(0, score) # Ensure score is not negative

    def get_analysis_status(self, session_id):
        return self.analysis_progress.get(session_id, {'step': 'not_started', 'progress': 0, 'message': 'No analysis running'})

    def start_analysis(self, session_id, competitor_channel_ids, user_channel_id, brand_keywords, family_friendly_keywords, high_energy_keywords):
        self._emit_progress(session_id, 'start', 0, 'Starting analysis...')

        # Step 1: Build exclusion list
        self._emit_progress(session_id, 'exclusion_list', 10, 'Building exclusion list...')
        exclusion_games = set()
        for i, channel_id in enumerate(competitor_channel_ids):
            self._emit_progress(session_id, 'exclusion_list', 10 + int(i/len(competitor_channel_ids)*20), f'Analyzing competitor channel {i+1}/{len(competitor_channel_ids)}...')
            videos = self.youtube_service.get_channel_videos(channel_id, max_results=100) # Get recent videos
            for video in videos:
                title = video["snippet"]["title"]
                description = video["snippet"]["description"]
                exclusion_games.update(self._extract_game_names(title + " " + description))
        logger.info(f"Exclusion games: {exclusion_games}")

        # Step 2: Discover adjacent channels (placeholder for now)
        self._emit_progress(session_id, 'adjacent_channels', 40, 'Discovering adjacent channels...')
        adjacent_channels = [] # This would involve more complex logic, e.g., using YouTube API for related channels or external data
        # For now, let's just use a dummy channel or two for demonstration
        adjacent_channels.append({'id': user_channel_id, 'title': 'User Channel'}) # Include user's channel for self-analysis

        # Step 3: Analyze adjacent channels for outliers
        self._emit_progress(session_id, 'outlier_detection', 60, 'Detecting outliers...')
        outlier_videos = []
        for i, channel_data in enumerate(adjacent_channels):
            channel_id = channel_data['id']
            channel_title = channel_data['title']
            self._emit_progress(session_id, 'outlier_detection', 60 + int(i/len(adjacent_channels)*30), f'Analyzing channel {channel_title}...')
            
            channel_info = self.youtube_service.get_channel_info(channel_id)
            if not channel_info:
                continue
            
            subscriber_count = int(channel_info["statistics"]["subscriberCount"])
            videos = self.youtube_service.get_channel_videos(channel_id, max_results=200)

            for video in videos:
                video_title = video["snippet"]["title"]
                video_description = video["snippet"]["description"]
                video_views = int(video["statistics"].get("viewCount", 0))

                # Skip if video is about an excluded game
                if any(game in self._extract_game_names(video_title + " " + video_description) for game in exclusion_games):
                    continue

                performance_score = self._calculate_performance_score(video_views, subscriber_count)
                brand_fit_score = self._analyze_video_for_brand_fit(video_title, video_description, brand_keywords, family_friendly_keywords, high_energy_keywords)

                # Define outlier threshold (e.g., performance score > 20)
                if performance_score > 20:
                    outlier_videos.append({
                        'channelId': channel_id,
                        'channelTitle': channel_title,
                        'videoId': video["id"],
                        'videoTitle': video_title,
                        'videoViews': video_views,
                        'performanceScore': performance_score,
                        'brandFitScore': brand_fit_score
                    })
        
        self._emit_progress(session_id, 'complete', 100, 'Analysis complete!')
        return outlier_videos
