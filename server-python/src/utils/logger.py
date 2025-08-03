import logging
import os

# Create logs directory if it doesn't exist
if not os.path.exists('logs'):
    os.makedirs('logs')

# Create a logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Create handlers
info_handler = logging.FileHandler('logs/info.log')
info_handler.setLevel(logging.INFO)
error_handler = logging.FileHandler('logs/error.log')
error_handler.setLevel(logging.ERROR)

# Create formatters and add it to handlers
log_format = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
info_handler.setFormatter(log_format)
error_handler.setFormatter(log_format)

# Add handlers to the logger
logger.addHandler(info_handler)
logger.addHandler(error_handler)

