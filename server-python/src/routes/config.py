from flask import Blueprint, request, jsonify, g
from middleware.auth import authenticate
from middleware.rbac import require_permission
from utils.logger import logger

bp = Blueprint('config', __name__, url_prefix='/api/config')

# Placeholder for configuration service
# In a real implementation, this would interact with a database or config files

# Mock configuration data
config_data = {
    'content': {
        'gamePatterns': [
            {'pattern': r'\bminecraft\b', 'flags': 'gi'},
            {'pattern': r'\bfortnite\b', 'flags': 'gi'},
            {'pattern': r'\bvalorant\b', 'flags': 'gi'},
            {'pattern': r'\bleague of legends\b', 'flags': 'gi'},
            {'pattern': r'\bcsgo\b', 'flags': 'gi'},
            {'pattern': r'\bapex legends\b', 'flags': 'gi'}
        ],
        'channelCriteria': {
            'minSubscribers': 1000,
            'maxSubscribers': 500000,
            'minVideoCount': 10,
            'excludeTitleKeywords': ['compilation', 'mix', 'best of'],
            'excludeDescriptionKeywords': ['compilation', 'mix', 'best of']
        },
        'brandFit': {
            'baseScore': 5,
            'positiveIndicators': [
                {'keywords': ['fun', 'entertaining'], 'score': 1},
                {'keywords': ['family-friendly', 'kids'], 'score': 2},
                {'pattern': r'\bhigh energy\b', 'score': 1}
            ],
            'negativeIndicators': [
                {'keywords': ['violent', 'gore'], 'score': -3},
                {'descriptionKeywords': ['mature content'], 'score': -2}
            ]
        },
        'searchQueries': [
            'gaming',
            'minecraft',
            'fortnite',
            'valorant',
            'league of legends'
        ],
        'outlierThreshold': 20,
        'brandFitThreshold': 6,
        'maxResults': 50
    }
}

@bp.route('/content', methods=['GET'])
@authenticate
@require_permission('config:read')
def get_content_config():
    """
    Get content configuration
    """
    try:
        return jsonify(config_data['content']), 200
    except Exception as e:
        logger.error(f"Error fetching content config: {e}")
        return jsonify({'error': 'Failed to fetch content configuration'}), 500

@bp.route('/content', methods=['POST'])
@authenticate
@require_permission('config:write')
def update_content_config():
    """
    Update content configuration
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        config_data['content'] = data
        return jsonify({'message': 'Configuration updated successfully'}), 200
    except Exception as e:
        logger.error(f"Error updating content config: {e}")
        return jsonify({'error': 'Failed to update content configuration'}), 500