from flask import jsonify
import sys
import os

# Add the src directory to the path so we can import from utils
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from utils.logger import logger

def handle_error(e):
    logger.error(f'An error occurred: {e}')
    return jsonify(error=str(e)), 500
