import pandas as pd
from io import BytesIO
from datetime import datetime
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_

from extensions import db
from .auth_bp import login_required
from model.employment import OsEmployment
from model.person import OsPerson
from model.card import OsCard
from model.osCostCenter import OsCostCenter
from model.grade import OsGrade
from model.alokasi import Alokasi
from model.canteen import canteen, canteenDetail

employee_bp = Blueprint('employee_bp', __name__)

@employee_bp.route('/employee')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        filter = request.args.get('filter', '', type=str)
        query = OsEmployment.query
        now = datetime.now()
        if search:
            query = query.join(OsPerson, OsEmployment.person_id == OsPerson.person_id)                     
            query = query.filter(
                or_(
                    OsEmployment.employee_id.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),                    
                )
            )
        if filter == 'active':
            query = query.filter(OsEmployment.valid_to >= now)
        elif filter == 'inactive':
            query = query.filter(OsEmployment.valid_to < now)
        pagination = query.paginate(page=page, per_page=pageSize, error_out=False)
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

@employee_bp.route('/employee/search/<string:emp_id>', methods=['GET'])
def search_employee(emp_id):
    try:
        result = db.session.query(OsPerson.name) \
            .join(OsEmployment, OsPerson.person_id == OsEmployment.person_id) \
            .filter(OsEmployment.employee_id == emp_id) \
            .first()
        if result:
            return jsonify({"status": "success", "full_name": result.name}), 200
        return jsonify({"status": "error", "message": "Employee ID tidak Ada"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@employee_bp.route('/employee/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form
        #person
        newPerson = OsPerson(
            name = data.get('nama'),
            gender = data.get('gender'),            
            pob = data.get('pob'),
            dob = data.get('dob'),
            religion = data.get('religion'),
            resident_id = data.get('resident_id'),
            address = data.get('address')
        )
        db.session.add(newPerson)
        db.session.flush()
        #employment
        newEmployment = OsEmployment(
            employee_id = data.get('employee_id'),
            sub_company_id = data.get('sub_company_id'),
            person_id = newPerson.person_id,
            valid_from = data.get('valid_from'),
            valid_to = data.get('valid_to')
        )
        db.session.add(newEmployment)
        db.session.flush()
        #card
        newCard = OsCard(
            employee_id = newEmployment.employee_id,
            card_number = data.get('card_number'),
            valid_from = data.get('c_valid_from'),
            valid_to = data.get('c_valid_to')
        )
        db.session.add(newCard)
        #grade
        newGrade = OsGrade(
            employee_id = newEmployment.employee_id,
            grade = data.get('grade'),
            valid_from = data.get('valid_from'),
            valid_to = data.get('valid_to')
        )       
        db.session.add(newGrade)
        #org cost center
        newCC = OsCostCenter(
            employee_id = newEmployment.employee_id,
            cc_id = data.get('cc_id'),
            valid_from = data.get('valid_from'),
            valid_to = data.get('valid_to')
        )       
        db.session.add(newCC)
        #canteen
        if (data.get('cc_id')):
            cc_def = canteen.query.join(canteenDetail, canteen.canteen_id == canteenDetail.canteen_id).filter(canteenDetail.cc_id.ilike(data.get('cc_id'))).first()
            newAlokasi = Alokasi(
                employee_id = newEmployment.employee_id,
                canteen_id = cc_def.canteen_id,
                valid_from = data.get('valid_from'),
                valid_to = data.get('valid_to')
            )
            db.session.add(newAlokasi)            
        #commit all
        db.session.commit()
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

@employee_bp.route('/employee/template', methods=['GET'])
def template():
    try:
        example_data = [{
            "nama": "Budi Contoh",
            "gender": "L",
            "pob": "Bandung",
            "dob": "2026-03-20",
            "religion": "Islam",
            "resident_id": "32xxxx",
            "address": "Alamat Rumah",
            
        }]
        df = pd.DataFrame(example_data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Template_Import')
        output.seek(0)
        return send_file(
            output, 
            as_attachment=True, 
            download_name="Template_Import.xlsx"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@employee_bp.route('/employee/export', methods=['GET'])
def export():
    return

@employee_bp.route('/employee/upload', methods=['GET'])
def upload():
    return

@employee_bp.before_request
@login_required
def before_request():
    pass