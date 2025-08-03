from flask import Flask
from flask_socketio import SocketIO
from dotenv import load_dotenv
from flask_cors import CORS
from flask_talisman import Talisman
import os

from .middleware.error_handler import handle_error
from .routes import channels, outlier
from .utils.logger import logger

load_dotenv()

app = Flask(__name__)
CORS(app)
Talisman(app)
socketio = SocketIO(app)

app.register_error_handler(Exception, handle_error)

app.register_blueprint(channels.bp)
app.register_blueprint(outlier.bp)

outlier.init_outlier_service(socketio)

@app.route('/')
def index():
    logger.info('Root endpoint hit')
    return 'Hello, World!'

if __name__ == '__main__':
    socketio.run(app, debug=os.environ.get('FLASK_DEBUG', False))
