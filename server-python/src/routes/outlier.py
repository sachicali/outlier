from flask import Blueprint, request, jsonify
from ..services.outlier_detection_service import OutlierDetectionService
from ..utils.logger import logger

bp = Blueprint('outlier', __name__, url_prefix='/api/outlier')
outlier_service = None # Will be initialized with socketio from app.py

def init_outlier_service(socketio_instance):
    global outlier_service
    outlier_service = OutlierDetectionService(socketio=socketio_instance)

@bp.route('/start-analysis', methods=['POST'])
def start_analysis():
    data = request.json
    session_id = data.get('sessionId')
    competitor_channel_ids = data.get('competitorChannelIds', [])
    user_channel_id = data.get('userChannelId')
    brand_keywords = data.get('brandKeywords', [])
    family_friendly_keywords = data.get('familyFriendlyKeywords', [])
    high_energy_keywords = data.get('highEnergyKeywords', [])

    if not session_id or not user_channel_id:
        return jsonify({'error': 'Missing required parameters'}), 400

    logger.info(f'Starting analysis for session: {session_id}')
    # Run analysis in a separate thread or process to avoid blocking
    # For simplicity, we'll run it directly for now, but for production, use a task queue
    results = outlier_service.start_analysis(
        session_id,
        competitor_channel_ids,
        user_channel_id,
        brand_keywords,
        family_friendly_keywords,
        high_energy_keywords
    )
    return jsonify({'message': 'Analysis started', 'results': results})

@bp.route('/status/<string:session_id>', methods=['GET'])
def get_analysis_status(session_id):
    status = outlier_service.get_analysis_status(session_id)
    return jsonify(status)
