from flask import Flask, request, Response
from datetime import timedelta
from sqlalchemy.pool import NullPool # <--- 1. IMPORT NULLPOOL DI SINI

from extensions import db
from config import Config
from routes.auth_bp import auth_bp
from routes.permission_bp import permission_bp
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
from routes.absensi_bp import AbsenOs_bp
from routes.terminal_bp import terminal_bp
from routes.ob_emp_bp import ob_emp_bp
from routes.periode_bp import periode_bp
from routes.absenReport_bp import AbsenReport_bp
from routes.absenBreak_bp import AbsenBreak_bp
from routes.absenVendor_bp import absenVendor_bp
from routes.userManagement_bp import userManagement_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)    

    # =========================================================================
    # 2. KONFIGURASI NULLPOOL (MATIKAN CONNECTION POOLING SLEEP)
    # =========================================================================
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'poolclass': NullPool
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
    # 3. GARANSI PEMBERSIHAN SESI DATABASE SETELAH REQUEST SELESAI
    # =========================================================================
    @app.teardown_appcontext
    def shutdown_session(exception=None):
        db.session.remove()
    
    # Registrasi Blueprint
    app.register_blueprint(auth_bp, url_prefix='/')
    app.register_blueprint(permission_bp, url_prefix='/')
    app.register_blueprint(userManagement_bp, url_prefix='/')
    
    # Master Data
    app.register_blueprint(person_bp, url_prefix='/')
    app.register_blueprint(subCom_bp, url_prefix='/')
    app.register_blueprint(train_bp, url_prefix='/')
    app.register_blueprint(medical_bp, url_prefix='/')
    app.register_blueprint(canteen_bp, url_prefix='/')
    app.register_blueprint(costCenter_bp, url_prefix='/')
    app.register_blueprint(employee_bp, url_prefix='/')
    app.register_blueprint(alokasi_bp, url_prefix='/')
    app.register_blueprint(osMedical_bp, url_prefix='/')
    app.register_blueprint(osTraining_bp, url_prefix='/')    
    app.register_blueprint(osCard_bp, url_prefix='/')
    app.register_blueprint(osCC_bp, url_prefix='/')
    app.register_blueprint(osGrade_bp, url_prefix='/')
    app.register_blueprint(blacklist_bp, url_prefix='/')
    app.register_blueprint(osType_bp, url_prefix='/')    
    app.register_blueprint(terminal_bp, url_prefix='/')
    app.register_blueprint(ob_emp_bp, url_prefix='/')
    app.register_blueprint(periode_bp, url_prefix='/')    
    app.register_blueprint(AbsenOs_bp, url_prefix='/')
    app.register_blueprint(AbsenReport_bp, url_prefix='/')
    app.register_blueprint(AbsenBreak_bp, url_prefix='/')
    app.register_blueprint(absenVendor_bp, url_prefix='/')
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5001)