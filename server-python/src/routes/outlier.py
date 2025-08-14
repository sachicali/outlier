from flask import Blueprint, request, jsonify, g
from services.outlier_detection_service import OutlierDetectionService
from utils.logger import logger
from middleware.auth import authenticate
from middleware.rbac import require_permission, require_scopes
import uuid
import json
from db import redis_client

bp = Blueprint('outlier', __name__, url_prefix='/api/outlier')
outlier_service = OutlierDetectionService()  # Initialize without socketio

def init_outlier_service(socketio_instance=None):
    global outlier_service
    # For now, we're not using socketio, so we don't need to initialize it
    pass

@bp.route('/start', methods=['POST'])
@authenticate
@require_permission('analysis:write')
@require_scopes(['write'])
def start_analysis():
    """
    Start new outlier analysis
    """
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
    
    # Validate required fields
    required_fields = ['exclusionChannels', 'minSubs', 'maxSubs', 'timeWindow', 'outlierThreshold']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400
    
    # Validate data types
    if not isinstance(data['exclusionChannels'], list):
        return jsonify({'success': False, 'error': 'Exclusion channels must be an array'}), 400
    
    if not isinstance(data['minSubs'], int) or data['minSubs'] < 1000:
        return jsonify({'success': False, 'error': 'Minimum subscribers must be at least 1000'}), 400
    
    if not isinstance(data['maxSubs'], int) or data['maxSubs'] < 10000:
        return jsonify({'success': False, 'error': 'Maximum subscribers must be at least 10000'}), 400
    
    if not isinstance(data['timeWindow'], int) or not (1 <= data['timeWindow'] <= 30):
        return jsonify({'success': False, 'error': 'Time window must be between 1-30 days'}), 400
    
    if not isinstance(data['outlierThreshold'], int) or not (10 <= data['outlierThreshold'] <= 100):
        return jsonify({'success': False, 'error': 'Outlier threshold must be between 10-100'}), 400
    
    try:
        analysis_id = str(uuid.uuid4())
        config = data
        user_id = getattr(g, 'user', {}).get('id')
        
        # Store analysis record in Redis (in production, use a real database)
        analysis_data = {
            'id': analysis_id,
            'user_id': user_id,
            'name': config.get('name', f'Analysis {analysis_id}'),
            'description': config.get('description'),
            'config': config,
            'status': 'pending',
            'created_at': __import__('datetime').datetime.utcnow().isoformat()
        }
        
        redis_client.setex(f'analysis:{analysis_id}', 86400, json.dumps(analysis_data))
        
        # Start analysis in background
        import threading
        def run_analysis():
            try:
                outlier_service.start_analysis(analysis_id, config)
            except Exception as e:
                logger.error(f"Analysis {analysis_id} failed: {e}")
                # Update status to failed
                analysis_data['status'] = 'failed'
                analysis_data['error_message'] = str(e)
                redis_client.setex(f'analysis:{analysis_id}', 86400, json.dumps(analysis_data))
        
        thread = threading.Thread(target=run_analysis)
        thread.start()
        
        return jsonify({
            'success': True,
            'analysisId': analysis_id,
            'message': 'Analysis started successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Error starting analysis: {e}")
        return jsonify({'success': False, 'error': 'Failed to start analysis'}), 500

@bp.route('/status/<string:analysis_id>', methods=['GET'])
@authenticate
@require_permission('analysis:read')
@require_scopes(['read'])
def get_analysis_status(analysis_id):
    """
    Get analysis status
    """
    try:
        # Get analysis from Redis
        analysis_data = redis_client.get(f'analysis:{analysis_id}')
        if not analysis_data:
            return jsonify({'success': False, 'error': 'Analysis not found'}), 404
        
        analysis = json.loads(analysis_data)
        
        # Check ownership (users can only access their own analyses, admins can access all)
        user = getattr(g, 'user', {})
        if analysis.get('user_id') != user.get('id') and user.get('role') != 'admin':
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # Get real-time status from outlier service
        status = outlier_service.get_analysis_status(analysis_id)
        
        return jsonify({
            'success': True,
            'analysis': {
                'id': analysis['id'],
                'status': analysis.get('status', 'unknown'),
                'started_at': analysis.get('created_at'),
                'config': analysis.get('config'),
                'progress': status
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching analysis status: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@bp.route('/results/<string:analysis_id>', methods=['GET'])
@authenticate
@require_permission('analysis:read')
@require_scopes(['read'])
def get_analysis_results(analysis_id):
    """
    Get analysis results
    """
    try:
        # Get analysis from Redis
        analysis_data = redis_client.get(f'analysis:{analysis_id}')
        if not analysis_data:
            return jsonify({'success': False, 'error': 'Analysis not found'}), 404
        
        analysis = json.loads(analysis_data)
        
        # Check ownership (users can only access their own analyses, admins can access all)
        user = getattr(g, 'user', {})
        if analysis.get('user_id') != user.get('id') and user.get('role') != 'admin':
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # Check if analysis is completed
        if analysis.get('status') != 'completed':
            return jsonify({
                'success': False, 
                'error': f'Analysis is {analysis.get("status", "in progress")}',
                'status': analysis.get('status', 'in progress')
            }), 400
        
        # Get results from Redis
        results_data = redis_client.get(f'analysis_results:{analysis_id}')
        results = json.loads(results_data) if results_data else []
        
        return jsonify({
            'success': True,
            'results': results,
            'summary': analysis.get('summary', {
                'totalOutliers': len(results) if results else 0,
                'channelsAnalyzed': 0,
                'config': analysis.get('config')
            })
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching analysis results: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@bp.route('/list', methods=['GET'])
@authenticate
@require_permission('analysis:read')
@require_scopes(['read'])
def list_analyses():
    """
    List all analyses for the user
    """
    try:
        user = getattr(g, 'user', {})
        user_id = user.get('id')
        is_admin = user.get('role') == 'admin'
        
        # In a real implementation, this would query a database
        # For now, we'll return an empty list
        analyses = []
        
        user_analyses = []
        for analysis in analyses:
            # Filter analyses by user ownership (admins can see all)
            if is_admin or analysis.get('user_id') == user_id:
                user_analyses.append({
                    'id': analysis['id'],
                    'userId': analysis.get('user_id'),
                    'status': analysis.get('status'),
                    'startTime': analysis.get('created_at'),
                    'resultCount': len(analysis.get('results', [])),
                    'config': {
                        'exclusionChannels': analysis.get('config', {}).get('exclusionChannels', []),
                        'timeWindow': analysis.get('config', {}).get('timeWindow', 7)
                    }
                })
        
        # Sort by start time (newest first)
        user_analyses.sort(key=lambda x: x['startTime'], reverse=True)
        
        return jsonify({
            'success': True,
            'analyses': user_analyses
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching analyses list: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@bp.route('/export/<string:analysis_id>/<string:format_type>', methods=['GET'])
@authenticate
@require_permission('analysis:read')
@require_scopes(['read'])
def export_analysis_legacy(analysis_id, format_type):
    """
    Legacy export endpoint - redirects to new export service
    """
    from services.export_service import ExportService
    from flask import Response
    from datetime import datetime
    
    export_service = ExportService()
    supported_formats = ['excel', 'csv', 'pdf', 'json', 'html']
    
    if format_type not in supported_formats:
        return jsonify({
            'success': False, 
            'error': f'Unsupported format. Supported formats: {", ".join(supported_formats)}'
        }), 400
    
    try:
        user_id = getattr(g, 'user', {}).get('id')
        
        # Check if user has access to this analysis
        analysis_data = redis_client.get(f'analysis:{analysis_id}')
        if not analysis_data:
            return jsonify({'success': False, 'error': 'Analysis not found'}), 404
        
        analysis = json.loads(analysis_data)
        user = getattr(g, 'user', {})
        if analysis.get('user_id') != user.get('id') and user.get('role') != 'admin':
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # Check if analysis is completed
        if analysis.get('status') != 'completed':
            return jsonify({
                'success': False, 
                'error': f'Analysis is {analysis.get("status", "in progress")}. Cannot export incomplete analysis.'
            }), 400
        
        # Generate export
        try:
            if format_type == 'excel':
                result = export_service.export_to_excel(analysis_id, user_id)
                mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                filename = f'analysis_{analysis_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
                
            elif format_type == 'csv':
                result = export_service.export_to_csv(analysis_id, user_id)
                mimetype = 'text/csv'
                filename = f'analysis_{analysis_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
                
            elif format_type == 'pdf':
                result = export_service.export_to_pdf(analysis_id, user_id)
                mimetype = 'application/pdf'
                filename = f'analysis_{analysis_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
                
            elif format_type == 'json':
                result = export_service.export_to_json(analysis_id, user_id)
                mimetype = 'application/json'
                filename = f'analysis_{analysis_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
                
            elif format_type == 'html':
                result = export_service.export_to_html(analysis_id, user_id)
                mimetype = 'text/html'
                filename = f'analysis_{analysis_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.html'
            
            # Return file response
            if isinstance(result, str):
                # String content (JSON, HTML)
                return Response(
                    result,
                    mimetype=mimetype,
                    headers={
                        'Content-Disposition': f'attachment; filename="{filename}"',
                        'Content-Type': mimetype
                    }
                )
            else:
                # Binary content (Excel, PDF) or StringIO (CSV)
                return Response(
                    result.getvalue(),
                    mimetype=mimetype,
                    headers={
                        'Content-Disposition': f'attachment; filename="{filename}"',
                        'Content-Type': mimetype
                    }
                )
                
        except ValueError as e:
            return jsonify({'success': False, 'error': str(e)}), 400
        except Exception as e:
            logger.error(f"Export generation failed for {analysis_id}, format {format_type}: {e}")
            return jsonify({'success': False, 'error': 'Export generation failed'}), 500
        
    except Exception as e:
        logger.error(f"Error exporting analysis {analysis_id}: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500
