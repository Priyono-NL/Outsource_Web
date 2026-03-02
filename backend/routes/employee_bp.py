from flask import Blueprint, request, jsonify
from extensions import db

from model.employment import OsEmployment
from model.person import OsPerson
from model.card import OsCard
from model.osCostCenter import OsCostCenter
from model.grade import OsGrade

employee_bp = Blueprint('employee_bp', __name__)

@employee_bp.route('/employee')
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

@employee_bp.route('/employee/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form
        #person
        name = data.get('nama')
        gender = data.get('gender')
        address = data.get('address')
        pob = data.get('pob')
        dob = data.get('dob')
        religion = data.get('religion')
        resident_id = data.get('resident_id')

        #employment
        employee_id = data.get('employee_id')
        sub_company_id = data.get('sub_company_id')
        #person_id = id yang baru di buat dari person
        valid_from = data.get('valid_from')
        valid_to = data.get('valid_to')

        #card
        #employee_id = id baru yang dibuat dari employment
        card_number = data.get('card_number')
        c_valid_from = data.get('c_valid_from')
        c_valid_to = data.get('c_valid_to')

        #grade
        #employee_id = id baru yang dibuat dari employment
        grade = data.get('grade')
        valid_from = data.get('valid_from')
        valid_to = data.get('valid_to')

        #org-cost center
        #employee_id = id baru yang dibuat dari employment
        cc_id = data.get('cc_id')
        valid_from = data.get('valid_from')
        valid_to = data.get('valid_to')

        return jsonify({
            "status": "success",
            "message": f"Data berhasil disimpan!"
        }), 201     
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": "Terjadi kesalahan pada server: " + str(e)
        }), 500
