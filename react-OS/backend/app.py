import pandas as pd
from flask import Flask, jsonify, Response, request
from flask_cors import CORS

from extensions import db
from config import Config

from model.person import OsPerson
from model.subCompany import SubCompany
from model.employment import OsEmployment

from routes.employee_bp import employee_bp
from routes.subCompany_bp import subCom_bp
from routes.training_bp import train_bp
from routes.medical_bp import medical_bp
from routes.canteen_bp import canteen_bp
from routes.alokasi_bp import alokasi_bp

def create_app():
    app = Flask(__name__)
    CORS(app)    
    app.config.from_object(Config)
    db.init_app(app)

    app.register_blueprint(employee_bp, url_prefix='/')
    app.register_blueprint(subCom_bp, url_prefix='/')
    app.register_blueprint(train_bp, url_prefix='/')
    app.register_blueprint(medical_bp, url_prefix='/')
    app.register_blueprint(canteen_bp, url_prefix='/')
    app.register_blueprint(alokasi_bp, url_prefix='/')
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)