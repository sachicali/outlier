from flask import Blueprint, request, jsonify, g
from middleware.auth import authenticate
from middleware.rbac import require_permission
from utils.logger import logger

bp = Blueprint('apikeys', __name__, url_prefix='/api/apikeys')

# Placeholder for API key service
# In a real implementation, this would interact with a database

# Mock data store for API keys
api_keys = {}

@bp.route('/', methods=['GET'])
@authenticate
@require_permission('apikeys:read')
def list_api_keys():
    """
    List all API keys for the current user
    """
    try:
        user_id = g.user['id']
        user_keys = [key for key in api_keys.values() if key['user_id'] == user_id]
        return jsonify({'apiKeys': user_keys}), 200
    except Exception as e:
        logger.error(f"Error listing API keys: {e}")
        return jsonify({'error': 'Failed to list API keys'}), 500

@bp.route('/', methods=['POST'])
@authenticate
@require_permission('apikeys:write')
def create_api_key():
    """
    Create a new API key
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        user_id = g.user['id']
        # In a real implementation, this would generate a secure API key
        # and store it in the database
        import uuid
        key_id = str(uuid.uuid4())
        api_key = f"sk_{uuid.uuid4().hex}"
        
        new_key = {
            'id': key_id,
            'user_id': user_id,
            'name': data.get('name', 'Unnamed API Key'),
            'permissions': data.get('permissions', []),
            'createdAt': '2023-01-01T00:00:00Z',
            'lastUsedAt': None
        }
        
        api_keys[key_id] = new_key
        
        return jsonify({
            'apiKey': new_key,
            'key': api_key  # In a real implementation, this would only be shown once
        }), 201
    except Exception as e:
        logger.error(f"Error creating API key: {e}")
        return jsonify({'error': 'Failed to create API key'}), 500

@bp.route('/<string:key_id>', methods=['DELETE'])
@authenticate
@require_permission('apikeys:write')
def delete_api_key(key_id):
    """
    Delete an API key
    """
    try:
        user_id = g.user['id']
        if key_id in api_keys and api_keys[key_id]['user_id'] == user_id:
            del api_keys[key_id]
            return jsonify({'message': 'API key deleted successfully'}), 200
        else:
            return jsonify({'error': 'API key not found'}), 404
    except Exception as e:
        logger.error(f"Error deleting API key: {e}")
        return jsonify({'error': 'Failed to delete API key'}), 500