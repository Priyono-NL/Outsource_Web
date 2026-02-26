import pandas as pd, os, io
from dotenv import load_dotenv
from flask import Flask, jsonify, Response, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

load_dotenv()
app = Flask(__name__)
CORS(app)

user = os.getenv('DB_USER')
pw = os.getenv('DB_PASSWORD')
host = os.getenv('DB_HOST')
db_name = os.getenv('DB_NAME')

app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{user}:{pw}@{host}/{db_name}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class OsEmployment(db.Model):
    __tablename__ = 'os_employment'

    employee_id = db.Column(db.Integer, primary_key=True)
    sub_company_id = db.Column(db.String(10))
    person_id = db.Column(db.Integer)
    nik = db.Column(db.Integer)
    valid_from = db.Column(db.Date)
    valid_to = db.Column(db.Date)

    def to_dict(self):
        return {
            'employee_id': self.employee_id,
            'sub_company_id': self.sub_company_id,
            'person_id': self.person_id,
            'nik': self.nik,
            'valid_from': self.valid_from.strftime('%d %b %Y') if self.valid_from else None,
            'valid_to': self.valid_to.strftime('%d %b %Y') if self.valid_to else None
        }

@app.route('/employee')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        pagination = OsEmployment.query.paginate(page=page, per_page=pageSize, error_out=False)
        return jsonify({
            "status": "success",
            "data": [emp.to_dict() for emp in pagination.items],
            "total_page": pagination.pages,
            "current_page": pagination.page,
            "total_item": pagination.total
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True)