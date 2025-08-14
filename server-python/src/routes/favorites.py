from flask import Blueprint, request, jsonify, g
from middleware.auth import authenticate
from middleware.rbac import require_permission
from utils.logger import logger

bp = Blueprint('favorites', __name__, url_prefix='/api/favorites')

# Placeholder for favorites service
# In a real implementation, this would interact with a database

# Mock data store for favorites
favorites = {}

@bp.route('/', methods=['GET'])
@authenticate
@require_permission('favorites:read')
def get_favorites():
    """
    Get user's favorite channels
    """
    try:
        user_id = g.user['id']
        user_favorites = favorites.get(user_id, [])
        return jsonify({'favorites': user_favorites}), 200
    except Exception as e:
        logger.error(f"Error fetching favorites: {e}")
        return jsonify({'error': 'Failed to fetch favorites'}), 500

@bp.route('/', methods=['POST'])
@authenticate
@require_permission('favorites:write')
def add_favorite():
    """
    Add a channel to favorites
    """
    data = request.get_json()
    if not data or 'channelId' not in data:
        return jsonify({'error': 'channelId is required'}), 400
    
    try:
        user_id = g.user['id']
        channel_id = data['channelId']
        
        if user_id not in favorites:
            favorites[user_id] = []
        
        # Check if already favorited
        if channel_id not in favorites[user_id]:
            favorites[user_id].append(channel_id)
        
        return jsonify({'message': 'Channel added to favorites'}), 200
    except Exception as e:
        logger.error(f"Error adding favorite: {e}")
        return jsonify({'error': 'Failed to add favorite'}), 500

@bp.route('/<string:channel_id>', methods=['DELETE'])
@authenticate
@require_permission('favorites:write')
def remove_favorite(channel_id):
    """
    Remove a channel from favorites
    """
    try:
        user_id = g.user['id']
        
        if user_id in favorites and channel_id in favorites[user_id]:
            favorites[user_id].remove(channel_id)
            return jsonify({'message': 'Channel removed from favorites'}), 200
        else:
            return jsonify({'error': 'Channel not in favorites'}), 404
    except Exception as e:
        logger.error(f"Error removing favorite: {e}")
        return jsonify({'error': 'Failed to remove favorite'}), 500

@bp.route('/<string:channel_id>', methods=['GET'])
@authenticate
@require_permission('favorites:read')
def check_favorite(channel_id):
    """
    Check if a channel is in favorites
    """
    try:
        user_id = g.user['id']
        is_favorite = (user_id in favorites and channel_id in favorites[user_id])
        return jsonify({'isFavorite': is_favorite}), 200
    except Exception as e:
        logger.error(f"Error checking favorite: {e}")
        return jsonify({'error': 'Failed to check favorite'}), 500