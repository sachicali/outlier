import os
import json
from googleapiclient.discovery import build
from dotenv import load_dotenv
from utils.logger import logger
from db import redis_client

load_dotenv()

# YouTube API configuration
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
YOUTUBE_API_SERVICE_NAME = "youtube"
YOUTUBE_API_VERSION = "v3"

# Initialize YouTube API client
if YOUTUBE_API_KEY:
    youtube = build(YOUTUBE_API_SERVICE_NAME, YOUTUBE_API_VERSION, developerKey=YOUTUBE_API_KEY)
else:
    youtube = None
    logger.warning("YOUTUBE_API_KEY not set. YouTube API functionality will be limited.")

class YouTubeService:
    def __init__(self):
        self.youtube = youtube
        self.redis_client = redis_client

    def _get_from_cache(self, key):
        """Get data from Redis cache"""
        if self.redis_client:
            data = self.redis_client.get(key)
            if data:
                logger.info(f"Cache hit for key: {key}")
                return json.loads(data)
        return None

    def _set_to_cache(self, key, data, ex=3600): 
        """Set data to Redis cache"""
        if self.redis_client:
            self.redis_client.setex(key, ex, json.dumps(data))
            logger.info(f"Cache set for key: {key}")

    def get_channel_info(self, channel_id):
        """Get channel information including statistics"""
        if not self.youtube:
            logger.error("YouTube API not initialized")
            return None
            
        cache_key = f"channel_info:{channel_id}"
        cached_data = self._get_from_cache(cache_key)
        if cached_data:
            return cached_data

        try:
            request = self.youtube.channels().list(
                part="snippet,contentDetails,statistics",
                id=channel_id
            )
            response = request.execute()
            if response and response.get("items"):
                channel_data = response["items"][0]
                self._set_to_cache(cache_key, channel_data)
                return channel_data
            return None
        except Exception as e:
            logger.error(f"Error fetching channel info for {channel_id}: {e}")
            return None

    def get_channel_videos(self, channel_id, max_results=50, published_after=None):
        """Get videos from a channel"""
        if not self.youtube:
            logger.error("YouTube API not initialized")
            return []
            
        cache_key = f"channel_videos:{channel_id}:{max_results}"
        if published_after:
            cache_key += f":{published_after}"
            
        cached_data = self._get_from_cache(cache_key)
        if cached_data:
            return cached_data

        try:
            # Get upload playlist ID
            channel_info = self.get_channel_info(channel_id)
            if not channel_info:
                return []
            uploads_playlist_id = channel_info["contentDetails"]["relatedPlaylists"]["uploads"]

            videos = []
            next_page_token = None

            while len(videos) < max_results:
                playlist_request = self.youtube.playlistItems().list(
                    part="snippet",
                    playlistId=uploads_playlist_id,
                    maxResults=min(max_results - len(videos), 50),
                    pageToken=next_page_token,
                    publishedAfter=published_after
                )
                playlist_response = playlist_request.execute()

                video_ids = [item["snippet"]["resourceId"]["videoId"] for item in playlist_response.get("items", []) if item["snippet"]["resourceId"]["videoId"]]
                if not video_ids:
                    break

                # Fetch video details for statistics
                video_details_request = self.youtube.videos().list(
                    part="snippet,statistics,contentDetails",
                    id=",".join(video_ids)
                )
                video_details_response = video_details_request.execute()

                for item in video_details_response.get("items", []):
                    videos.append(item)

                next_page_token = playlist_response.get("nextPageToken")
                if not next_page_token:
                    break
            
            result = videos[:max_results]
            self._set_to_cache(cache_key, result)
            return result
        except Exception as e:
            logger.error(f"Error fetching channel videos for {channel_id}: {e}")
            return []

    def search_channels(self, query, max_results=10, subscriber_range=None):
        """Search for channels"""
        if not self.youtube:
            logger.error("YouTube API not initialized")
            return []
            
        cache_key = f"search_channels:{query}:{max_results}"
        if subscriber_range:
            cache_key += f":{subscriber_range.get('min', 0)}:{subscriber_range.get('max', 0)}"
            
        cached_data = self._get_from_cache(cache_key)
        if cached_data:
            return cached_data

        try:
            request = self.youtube.search().list(
                part="snippet",
                q=query,
                type="channel",
                maxResults=max_results
            )
            response = request.execute()
            channels = response.get("items", [])
            
            # If subscriber range is specified, filter channels
            if subscriber_range and channels:
                filtered_channels = []
                for channel in channels:
                    channel_id = channel["id"]["channelId"]
                    channel_info = self.get_channel_info(channel_id)
                    if channel_info:
                        sub_count = int(channel_info["statistics"].get("subscriberCount", 0))
                        if (subscriber_range.get("min", 0) <= sub_count <= subscriber_range.get("max", float('inf'))):
                            # Add the statistics to the channel object
                            channel["statistics"] = channel_info["statistics"]
                            filtered_channels.append(channel)
                channels = filtered_channels
            
            self._set_to_cache(cache_key, channels)
            return channels
        except Exception as e:
            logger.error(f"Error searching channels for {query}: {e}")
            return []
