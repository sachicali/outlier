from flask import jsonify
from .logger import logger

def handle_error(e):
    logger.error(f'An error occurred: {e}')
    return jsonify(error=str(e)), 500
