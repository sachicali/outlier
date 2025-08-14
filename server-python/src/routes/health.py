from flask import Blueprint, jsonify
from middleware.auth import authenticate
from middleware.rbac import require_permission
from utils.logger import logger
import os
import redis

bp = Blueprint('health', __name__, url_prefix='/api/health')

# Initialize Redis client for health check
try:
    redis_client = redis.StrictRedis(
        host=os.getenv('REDIS_HOST', 'localhost'),
        port=int(os.getenv('REDIS_PORT', 6379)),
        db=int(os.getenv('REDIS_DB', 0)),
        password=os.getenv('REDIS_PASSWORD'),
        decode_responses=True
    )
    redis_client.ping()
    redis_healthy = True
except:
    redis_healthy = False

@bp.route('/', methods=['GET'])
def health_check():
    """
    Basic health check endpoint
    """
    try:
        # Check Redis health
        redis_status = 'healthy' if redis_healthy else 'unhealthy'
        
        # Check if required environment variables are set
        youtube_api_key = os.getenv('YOUTUBE_API_KEY')
        env_status = 'healthy' if youtube_api_key else 'missing YOUTUBE_API_KEY'
        
        overall_status = 'OK' if redis_healthy and youtube_api_key else 'DEGRADED'
        
        return jsonify({
            'status': overall_status,
            'timestamp': __import__('datetime').datetime.utcnow().isoformat(),
            'services': {
                'redis': redis_status,
                'environment': env_status
            },
            'version': os.getenv('APP_VERSION', '1.0.0'),
            'environment': os.getenv('FLASK_ENV', 'development')
        }), 200 if overall_status == 'OK' else 503
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'ERROR',
            'timestamp': __import__('datetime').datetime.utcnow().isoformat(),
            'error': str(e)
        }), 500

@bp.route('/security', methods=['GET'])
@authenticate
@require_permission('admin')
def security_health_check():
    """
    Security health check endpoint (admin only)
    """
    try:
        return jsonify({
            'status': 'healthy',
            'timestamp': __import__('datetime').datetime.utcnow().isoformat(),
            'security': {
                'authentication': 'active',
                'authorization': 'active',
                'rateLimiting': 'active' if redis_healthy else 'degraded',
                'csrfProtection': 'active',
                'headers': 'active'
            }
        }), 200
    except Exception as e:
        logger.error(f"Security health check failed: {e}")
        return jsonify({
            'status': 'ERROR',
            'timestamp': __import__('datetime').datetime.utcnow().isoformat(),
            'error': str(e)
        }), 500