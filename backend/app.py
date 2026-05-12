from flask import Flask, request, Response
from flask_cors import CORS
from datetime import timedelta

from extensions import db
from config import Config
# from routes.auth_bp import auth_bp
from routes.costCenter_bp import costCenter_bp
from routes.subCompany_bp import subCom_bp
from routes.training_bp import train_bp
from routes.medical_bp import medical_bp
from routes.canteen_bp import canteen_bp
from routes.person_bp import person_bp
from routes.employee_bp import employee_bp
from routes.alokasi_bp import alokasi_bp
from routes.osMedical_bp import osMedical_bp
from routes.osTraining_bp import osTraining_bp
from routes.osCard_bp import osCard_bp
from routes.osCC_bp import osCC_bp
from routes.osGrade_bp import osGrade_bp
from routes.blacklist_bp import blacklist_bp
from routes.osType import osType_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app, 
        supports_credentials=True, 
        origins=Config.CORS_ORIGINS, 
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    
    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            res = Response()
            res.headers['Access-Control-Allow-Origin'] = "https://w6wz4p4z-3000.asse.devtunnels.ms"
            res.headers['Access-Control-Allow-Methods'] = "GET, POST, PUT, DELETE, OPTIONS"
            res.headers['Access-Control-Allow-Headers'] = "Content-Type, Authorization, X-Tunnel-Skip-Anti-Phishing-Page"
            res.headers['Access-Control-Allow-Credentials'] = "true"
            return res

    @app.after_request
    def after_request(response):
        # Gunakan get origin dengan aman
        origin = request.headers.get('Origin')
        allowed_origins = Config.CORS_ORIGINS
        if origin in allowed_origins or origin == "https://w6wz4p4z-3000.asse.devtunnels.ms":
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-Tunnel-Skip-Anti-Phishing-Page'
            response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
            response.headers['Access-Control-Allow-Credentials'] = 'true'
        return response

    db.init_app(app)
    # app.register_blueprint(auth_bp, url_prefix='/')
    #master Data
    app.register_blueprint(person_bp, url_prefix='/')
    app.register_blueprint(subCom_bp, url_prefix='/')
    app.register_blueprint(train_bp, url_prefix='/')
    app.register_blueprint(medical_bp, url_prefix='/')
    app.register_blueprint(canteen_bp, url_prefix='/')
    app.register_blueprint(costCenter_bp, url_prefix='/')
    #transaksi
    app.register_blueprint(employee_bp, url_prefix='/')
    app.register_blueprint(alokasi_bp, url_prefix='/')
    app.register_blueprint(osMedical_bp, url_prefix='/')
    app.register_blueprint(osTraining_bp, url_prefix='/')    
    app.register_blueprint(osCard_bp, url_prefix='/')
    app.register_blueprint(osCC_bp, url_prefix='/')
    app.register_blueprint(osGrade_bp, url_prefix='/')
    app.register_blueprint(blacklist_bp, url_prefix='/')
    app.register_blueprint(osType_bp, url_prefix='/')
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)