from flask import Flask
from flask_cors import CORS
from datetime import timedelta

from extensions import db
from config import Config
from routes.auth_bp import auth_bp
from routes.costCenter_bp import costCenter_bp
from routes.subCompany_bp import subCom_bp
from routes.training_bp import train_bp
from routes.medical_bp import medical_bp
from routes.canteen_bp import canteen_bp
from routes.employee_bp import employee_bp
from routes.alokasi_bp import alokasi_bp
from routes.osMedical_bp import osMedical_bp
from routes.osTraining_bp import osTraining_bp
from routes.osCard_bp import osCard_bp
from routes.osCC_bp import osCC_bp

def create_app():
    app = Flask(__name__)
    CORS(app, supports_credentials=True, origins=["http://localhost:5173"])    
    app.config.from_object(Config)
    db.init_app(app)
    app.register_blueprint(auth_bp, url_prefix='/')
    #master Data
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
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)