import pandas as pd
from io import BytesIO
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_
from extensions import db
from model.osCostCenter import OsCostCenter
from model.employment import OsEmployment
from model.person import OsPerson
from model.hr_models import User, UserSubcompanyAccess

osCC_bp = Blueprint('osCC_bp', __name__)

@osCC_bp.route('/oscc')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        filter_status = request.args.get('filter', '', type=str)
        req_subco = request.args.get('subcompany', '', type=str)

        query = OsCostCenter.query.join(OsEmployment, OsCostCenter.employee_id == OsEmployment.id) \
                                  .join(OsPerson, OsEmployment.person_id == OsPerson.person_id)

        user_email = request.headers.get('X-User-Email')
        if user_email:
            user = User.query.filter_by(email=user_email).first()
            if user:
                access_records = UserSubcompanyAccess.query.filter_by(user_id=user.id).all()
                allowed_access = [a.sub_company_id for a in access_records]
                if allowed_access:
                    query = query.filter(OsEmployment.sub_company_id.in_(allowed_access))
                    if req_subco and req_subco not in allowed_access:
                        return jsonify({"status": "error", "message": "Akses ditolak"}), 403
        if req_subco:
            query = query.filter(OsEmployment.sub_company_id == req_subco)
        if search:
            query = query.filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),
                    OsCostCenter.cc_id.ilike(f"%{search}%") # Perbaikan pencarian CC
                )
            )
            
        now = datetime.now()
        if filter_status == 'active':
            query = query.filter((OsCostCenter.valid_to >= now) | (OsCostCenter.valid_to == None))
        elif filter_status == 'inactive':
            query = query.filter(OsCostCenter.valid_to < now)
            
        pagination = query.paginate(page=page, per_page=pageSize, error_out=False)
        return jsonify({
            "status": "success",
            "data": [emp.to_dict() for emp in pagination.items],
            "total_page": pagination.pages,
            "current_page": pagination.page,
            "total_item": pagination.total
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@osCC_bp.route('/oscc/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form
        old_cc = OsCostCenter.query.filter_by(employee_id=data.get('employee_id')).order_by(OsCostCenter.id.desc()).first()
        if old_cc and data.get('valid_from'):
            try:
                new_valid_from = datetime.strptime(data.get('valid_from'), '%Y-%m-%d')
                previous_day = new_valid_from - timedelta(days=1)
                old_cc.valid_to = previous_day.date()
            except ValueError as e:
                print(f"Format tanggal salah: {e}")

        new_OsCostCenter = OsCostCenter(
            employee_id = data.get('employee_id'),
            cc_id = data.get('cc_id'),
            valid_from = data.get('valid_from'),
            valid_to = data.get('valid_to')
        )
        db.session.add(new_OsCostCenter)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil disimpan!"}), 201    
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Terjadi kesalahan pada server: " + str(e)}), 500

@osCC_bp.route('/oscc/<string:id>', methods=['PUT'])
def update(id):
    try:
        OsCostCenter_data = OsCostCenter.query.filter_by(id=id).first()
        data = request.json
        OsCostCenter_data.employee_id = data.get('employee_id', OsCostCenter_data.employee_id)
        OsCostCenter_data.cc_id = data.get('cc_id', OsCostCenter_data.cc_id)
        OsCostCenter_data.valid_from = data.get('valid_from', OsCostCenter_data.valid_from)
        if 'valid_to' in data:
            new_valid_to = data.get('valid_to')
            OsCostCenter_data.valid_to = new_valid_to if new_valid_to else None
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@osCC_bp.route('/oscc/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = OsCostCenter.query.filter_by(id=id).first()
        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500