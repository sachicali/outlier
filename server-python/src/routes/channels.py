from flask import Blueprint, request, jsonify
from ..services.youtube_service import YouTubeService
from ..utils.logger import logger

bp = Blueprint('channels', __name__, url_prefix='/api/channels')
youtube_service = YouTubeService()

@bp.route('/search', methods=['GET'])
def search_channels():
    query = request.args.get('query')
    if not query:
        return jsonify({'error': 'Query parameter is required'}), 400
    
    logger.info(f'Searching channels for query: {query}')
    channels = youtube_service.search_channels(query)
    return jsonify(channels)

@bp.route('/<string:channel_id>', methods=['GET'])
def get_channel_info(channel_id):
    logger.info(f'Getting info for channel: {channel_id}')
    channel_info = youtube_service.get_channel_info(channel_id)
    if not channel_info:
        return jsonify({'error': 'Channel not found'}), 404
    return jsonify(channel_info)

@bp.route('/<string:channel_id>/videos', methods=['GET'])
def get_channel_videos(channel_id):
    logger.info(f'Getting videos for channel: {channel_id}')
    videos = youtube_service.get_channel_videos(channel_id)
    return jsonify(videos)