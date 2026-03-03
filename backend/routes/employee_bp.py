from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from extensions import db

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
        query = OsEmployment.query
        if search:
            query = query.join(OsPerson, OsEmployment.person_id == OsPerson.person_id)                     
            query = query.filter(
                or_(
                    OsEmployment.employee_id.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),                    
                )
            )
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

@employee_bp.route('/employee/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form
        #person
        newPerson = OsPerson(
            name = data.get('nama'),
            gender = data.get('gender'),
            address = data.get('address'),
            pob = data.get('pob'),
            dob = data.get('dob'),
            religion = data.get('religion'),
            resident_id = data.get('resident_id')
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
