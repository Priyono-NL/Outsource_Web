import os
import pkgutil
import importlib
from flask import Flask, Blueprint, request, Response
from werkzeug.local import LocalProxy
from sqlalchemy.pool import NullPool

from extensions import db
from config import Config

def register_blueprints_dynamically(app):
    routes_dir = os.path.join(os.path.dirname(__file__), 'routes')
    registered_blueprints = set()

    for _, module_name, _ in pkgutil.iter_modules([routes_dir]):
        module = importlib.import_module(f"routes.{module_name}")

        for attribute_name in dir(module):
            attribute = getattr(module, attribute_name)

            # Lewati objek proxy Flask (request, session, g, current_app) agar tidak memicu request context
            if isinstance(attribute, LocalProxy):
                continue

            if isinstance(attribute, Blueprint) and attribute.name not in registered_blueprints:
                app.register_blueprint(attribute, url_prefix='/')
                registered_blueprints.add(attribute.name)
                # print(f"Registered blueprint: {attribute_name} from routes.{module_name}")

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'poolclass': NullPool,
    }

    app.config['SQLALCHEMY_BINDS_ENGINE_OPTIONS'] = {
        'db-hr': {'poolclass': NullPool},
        'db-it-andreas': {'poolclass': NullPool},
        'db-webapps': {'poolclass': NullPool}
    }

    ALLOWED_ORIGINS = Config.CORS_ORIGINS
    if isinstance(ALLOWED_ORIGINS, str):
        ALLOWED_ORIGINS = [o.strip() for o in ALLOWED_ORIGINS.split(',')]
    ALLOWED_HEADERS = "Content-Type, Authorization, X-Requested-With, X-User-Email, X-Tunnel-Skip-Anti-Phishing-Page"

    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            res = Response()
            origin = request.headers.get('Origin')            
            if origin in ALLOWED_ORIGINS:
                res.headers['Access-Control-Allow-Origin'] = origin            
            res.headers['Access-Control-Allow-Methods'] = "GET, POST, PUT, DELETE, OPTIONS"
            res.headers['Access-Control-Allow-Headers'] = ALLOWED_HEADERS
            res.headers['Access-Control-Allow-Credentials'] = "true"
            return res

    @app.after_request
    def after_request(response):
        origin = request.headers.get('Origin')        
        if origin in ALLOWED_ORIGINS:
            response.headers['Access-Control-Allow-Origin'] = origin            
        response.headers['Access-Control-Allow-Headers'] = ALLOWED_HEADERS
        response.headers['Access-Control-Allow-Methods'] = 'GET, PUT, POST, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response

    db.init_app(app)
    
    # =========================================================================
    # GARANSI PEMBERSIHAN SESI DATABASE SETELAH REQUEST SELESAI (DRY GLOBAL)
    # =========================================================================
    @app.teardown_appcontext
    def shutdown_session(exception=None):
        db.session.remove()
    
    # =========================================================================
    # REGISTRASI BLUEPRINT DINAMIS (AUTO-DISCOVERY)
    # =========================================================================
    register_blueprints_dynamically(app)
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5001)
