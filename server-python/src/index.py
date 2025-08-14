from flask import Flask
# from flask_socketio import SocketIO
from dotenv import load_dotenv
from flask_cors import CORS
from flask_talisman import Talisman
import os

from middleware.error_handler import handle_error
from routes import channels, outlier, auth, api_keys, config, health, queues, dashboard, favorites, exports, two_factor
from utils.logger import logger

load_dotenv()

def create_app():
    app = Flask(__name__)
    CORS(app)
    Talisman(app)
    # socketio = SocketIO(app)

    app.register_error_handler(Exception, handle_error)

    # Register all blueprints
    app.register_blueprint(auth.bp)
    app.register_blueprint(two_factor.bp)
    app.register_blueprint(api_keys.bp)
    app.register_blueprint(channels.bp)
    app.register_blueprint(config.bp)
    app.register_blueprint(health.bp)
    app.register_blueprint(outlier.bp)
    app.register_blueprint(queues.bp)
    app.register_blueprint(dashboard.bp)
    app.register_blueprint(favorites.bp)
    app.register_blueprint(exports.bp)

    # Initialize outlier service without socketio
    # outlier.init_outlier_service(socketio)

    @app.route('/')
    def index():
        logger.info('Root endpoint hit')
        return 'YouTube Outlier Discovery API'

    return app  # , socketio

def main():
    app = create_app()  # , socketio = create_app()
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=os.environ.get('FLASK_DEBUG', False), host='0.0.0.0', port=port)

if __name__ == '__main__':
    main()
