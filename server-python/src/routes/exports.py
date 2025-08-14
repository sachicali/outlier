from flask import Blueprint, request, jsonify, g, send_file, Response
from services.export_service import ExportService
from utils.logger import logger
from middleware.auth import authenticate
from middleware.rbac import require_permission, require_scopes
import os
import json
from datetime import datetime

bp = Blueprint('exports', __name__, url_prefix='/api/export')
export_service = ExportService()

# Supported export formats
SUPPORTED_FORMATS = ['excel', 'csv', 'pdf', 'json', 'html']

@bp.route('/outlier/<string:analysis_id>/<string:format_type>', methods=['GET'])
@authenticate
@require_permission('analysis:read')
@require_scopes(['read'])
def export_analysis_results(analysis_id, format_type):
    """
    Export analysis results in specified format
    """
    if format_type not in SUPPORTED_FORMATS:
        return jsonify({
            'success': False, 
            'error': f'Unsupported format. Supported formats: {", ".join(SUPPORTED_FORMATS)}'
        }), 400
    
    try:
        user_id = getattr(g, 'user', {}).get('id')
        
        # Check if user has access to this analysis
        from db import redis_client
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

@bp.route('/batch', methods=['POST'])
@authenticate
@require_permission('analysis:read')
@require_scopes(['read'])
def batch_export():
    """
    Create batch export jobs for multiple analyses
    """
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
    
    analysis_ids = data.get('analysisIds', [])
    format_type = data.get('format', 'excel')
    
    if not analysis_ids:
        return jsonify({'success': False, 'error': 'No analysis IDs provided'}), 400
    
    if format_type not in SUPPORTED_FORMATS:
        return jsonify({
            'success': False, 
            'error': f'Unsupported format. Supported formats: {", ".join(SUPPORTED_FORMATS)}'
        }), 400
    
    try:
        user_id = getattr(g, 'user', {}).get('id')
        user = getattr(g, 'user', {})
        
        # Validate access to all analyses
        from db import redis_client
        valid_analyses = []
        
        for analysis_id in analysis_ids:
            analysis_data = redis_client.get(f'analysis:{analysis_id}')
            if analysis_data:
                analysis = json.loads(analysis_data)
                # Check ownership or admin access
                if analysis.get('user_id') == user.get('id') or user.get('role') == 'admin':
                    # Check if completed
                    if analysis.get('status') == 'completed':
                        valid_analyses.append(analysis_id)
        
        if not valid_analyses:
            return jsonify({
                'success': False, 
                'error': 'No valid completed analyses found for export'
            }), 400
        
        # Create export jobs
        job_ids = []
        for analysis_id in valid_analyses:
            job_id = export_service.create_export_job(analysis_id, format_type, user_id)
            job_ids.append(job_id)
        
        return jsonify({
            'success': True,
            'message': f'Created {len(job_ids)} export jobs',
            'jobIds': job_ids,
            'exportedAnalyses': valid_analyses
        }), 200
        
    except Exception as e:
        logger.error(f"Error creating batch export: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@bp.route('/job/<string:job_id>/status', methods=['GET'])
@authenticate
@require_permission('analysis:read')
@require_scopes(['read'])
def get_export_job_status(job_id):
    """
    Get export job status
    """
    try:
        job_status = export_service.get_export_job_status(job_id)
        
        if not job_status:
            return jsonify({'success': False, 'error': 'Export job not found'}), 404
        
        # Check ownership
        user = getattr(g, 'user', {})
        if job_status.get('user_id') != user.get('id') and user.get('role') != 'admin':
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        # Remove sensitive file path from response
        response_data = {
            'id': job_status['id'],
            'analysisId': job_status['analysis_id'],
            'format': job_status['format'],
            'status': job_status['status'],
            'progress': job_status['progress'],
            'createdAt': job_status['created_at']
        }
        
        if job_status['status'] == 'failed':
            response_data['error'] = job_status.get('error')
        elif job_status['status'] == 'completed':
            response_data['filename'] = job_status.get('filename')
        
        return jsonify({
            'success': True,
            'job': response_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching export job status {job_id}: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@bp.route('/job/<string:job_id>/download', methods=['GET'])
@authenticate
@require_permission('analysis:read')
@require_scopes(['read'])
def download_export_job(job_id):
    """
    Download completed export job file
    """
    try:
        job_status = export_service.get_export_job_status(job_id)
        
        if not job_status:
            return jsonify({'success': False, 'error': 'Export job not found'}), 404
        
        # Check ownership
        user = getattr(g, 'user', {})
        if job_status.get('user_id') != user.get('id') and user.get('role') != 'admin':
            return jsonify({'success': False, 'error': 'Access denied'}), 403
        
        if job_status['status'] != 'completed':
            return jsonify({
                'success': False, 
                'error': f'Export job is {job_status["status"]}. Cannot download.'
            }), 400
        
        file_path = job_status.get('file_path')
        if not file_path or not os.path.exists(file_path):
            return jsonify({'success': False, 'error': 'Export file not found'}), 404
        
        # Determine mimetype based on format
        format_type = job_status['format']
        mimetype_map = {
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'csv': 'text/csv',
            'pdf': 'application/pdf',
            'json': 'application/json',
            'html': 'text/html'
        }
        mimetype = mimetype_map.get(format_type, 'application/octet-stream')
        
        return send_file(
            file_path,
            mimetype=mimetype,
            as_attachment=True,
            download_name=job_status.get('filename', f'export_{job_id}.{format_type}')
        )
        
    except Exception as e:
        logger.error(f"Error downloading export job {job_id}: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@bp.route('/analytics/<string:format_type>', methods=['GET'])
@authenticate
@require_permission('analytics:read')
@require_scopes(['read'])
def export_user_analytics(format_type):
    """
    Export user analytics and analysis history
    """
    if format_type not in SUPPORTED_FORMATS:
        return jsonify({
            'success': False, 
            'error': f'Unsupported format. Supported formats: {", ".join(SUPPORTED_FORMATS)}'
        }), 400
    
    try:
        user = getattr(g, 'user', {})
        user_id = user.get('id')
        
        # For now, return a placeholder response since we don't have
        # a comprehensive analytics system implemented
        analytics_data = {
            'user_id': user_id,
            'exported_at': datetime.utcnow().isoformat(),
            'analytics': {
                'total_analyses': 0,
                'completed_analyses': 0,
                'failed_analyses': 0,
                'avg_outliers_found': 0,
                'most_used_configurations': {},
                'analysis_history': []
            }
        }
        
        if format_type == 'json':
            return Response(
                json.dumps(analytics_data, indent=2),
                mimetype='application/json',
                headers={
                    'Content-Disposition': f'attachment; filename="analytics_{user_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json"'
                }
            )
        else:
            return jsonify({
                'success': False, 
                'error': 'Analytics export currently only supports JSON format'
            }), 400
        
    except Exception as e:
        logger.error(f"Error exporting analytics for user {user_id}: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@bp.route('/history', methods=['GET'])
@authenticate
@require_permission('analysis:read')
@require_scopes(['read'])
def export_analysis_history():
    """
    Export user's analysis history
    """
    try:
        user = getattr(g, 'user', {})
        user_id = user.get('id')
        format_type = request.args.get('format', 'json')
        
        if format_type not in SUPPORTED_FORMATS:
            return jsonify({
                'success': False, 
                'error': f'Unsupported format. Supported formats: {", ".join(SUPPORTED_FORMATS)}'
            }), 400
        
        # For now, return empty history since we don't have persistent storage
        # In a real implementation, this would query the database
        history_data = {
            'user_id': user_id,
            'exported_at': datetime.utcnow().isoformat(),
            'analysis_history': []
        }
        
        if format_type == 'json':
            return Response(
                json.dumps(history_data, indent=2),
                mimetype='application/json',
                headers={
                    'Content-Disposition': f'attachment; filename="history_{user_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json"'
                }
            )
        else:
            return jsonify({
                'success': False, 
                'error': 'History export currently only supports JSON format'
            }), 400
        
    except Exception as e:
        logger.error(f"Error exporting history for user {user_id}: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@bp.route('/formats', methods=['GET'])
def get_supported_formats():
    """
    Get list of supported export formats
    """
    return jsonify({
        'success': True,
        'formats': SUPPORTED_FORMATS,
        'descriptions': {
            'excel': 'Microsoft Excel format with multiple sheets and charts',
            'csv': 'Comma-separated values format',
            'pdf': 'Portable Document Format with formatted report',
            'json': 'JavaScript Object Notation format',
            'html': 'HTML format with interactive table and styling'
        }
    }), 200

@bp.route('/cleanup', methods=['POST'])
@authenticate
@require_permission('admin')
def cleanup_export_files():
    """
    Clean up old export files (admin only)
    """
    try:
        max_age_hours = request.json.get('maxAgeHours', 24) if request.is_json else 24
        export_service.cleanup_temp_files(max_age_hours)
        
        return jsonify({
            'success': True,
            'message': f'Cleaned up export files older than {max_age_hours} hours'
        }), 200
        
    except Exception as e:
        logger.error(f"Error during export cleanup: {e}")
        return jsonify({'success': False, 'error': 'Cleanup failed'}), 500
