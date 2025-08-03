import os
import redis
import json
from googleapiclient.discovery import build
from dotenv import load_dotenv
from ..utils.logger import logger

load_dotenv()

# YouTube API configuration
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
YOUTUBE_API_SERVICE_NAME = "youtube"
YOUTUBE_API_VERSION = "v3"

# Redis configuration
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")

# Initialize YouTube API client
youtube = build(YOUTUBE_API_SERVICE_NAME, YOUTUBE_API_VERSION, developerKey=YOUTUBE_API_KEY)

# Initialize Redis client
try:
    redis_client = redis.StrictRedis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, password=REDIS_PASSWORD, decode_responses=True)
    redis_client.ping()
    logger.info("Connected to Redis successfully!")
except redis.exceptions.ConnectionError as e:
    logger.error(f"Could not connect to Redis: {e}")
    redis_client = None

class YouTubeService:
    def __init__(self):
        self.youtube = youtube
        self.redis_client = redis_client

    def _get_from_cache(self, key):
        if self.redis_client:
            data = self.redis_client.get(key)
            if data:
                logger.info(f"Cache hit for key: {key}")
                return json.loads(data)
        return None

    def _set_to_cache(self, key, data, ex=3600): # Cache for 1 hour by default
        if self.redis_client:
            self.redis_client.setex(key, ex, json.dumps(data))
            logger.info(f"Cache set for key: {key}")

    def get_channel_info(self, channel_id):
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

    def get_channel_videos(self, channel_id, max_results=50):
        cache_key = f"channel_videos:{channel_id}:{max_results}"
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
                    pageToken=next_page_token
                )
                playlist_response = playlist_request.execute()

                video_ids = [item["snippet"]["resourceId"]["videoId"] for item in playlist_response.get("items", [])]
                if not video_ids:
                    break

                # Fetch video details for statistics
                video_details_request = self.youtube.videos().list(
                    part="snippet,statistics",
                    id=",".join(video_ids)
                )
                video_details_response = video_details_request.execute()

                for item in video_details_response.get("items", []):
                    videos.append(item)

                next_page_token = playlist_response.get("nextPageToken")
                if not next_page_token:
                    break
            
            self._set_to_cache(cache_key, videos)
            return videos[:max_results]
        except Exception as e:
            logger.error(f"Error fetching channel videos for {channel_id}: {e}")
            return []

    def search_channels(self, query, max_results=10):
        cache_key = f"search_channels:{query}:{max_results}"
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
            self._set_to_cache(cache_key, channels)
            return channels
        except Exception as e:
            logger.error(f"Error searching channels for {query}: {e}")
            return []
