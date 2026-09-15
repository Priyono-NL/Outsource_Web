import pandas as pd
from io import BytesIO
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_
from extensions import db
from model.grade import OsGrade
from model.employment import OsEmployment
from model.person import OsPerson
from model.osCostCenter import OsCostCenter
from model.hr_models import User, UserSubcompanyAccess, UserCostCenterAccess

osGrade_bp = Blueprint('osGrade_bp', __name__)

@osGrade_bp.route('/osgrade', methods=['GET'])
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        filter_status = request.args.get('filter', '', type=str)
        req_subco = request.args.get('subcompany', '', type=str)
        req_dept = request.args.get('department', '', type=str)
        
        query = OsGrade.query.join(OsEmployment, OsGrade.employee_id == OsEmployment.id) \
                            .join(OsPerson, OsEmployment.person_id == OsPerson.person_id)
        
        # Flag tracking untuk mencegah Duplicate Join ke OsCostCenter
        has_joined_cc = False

        # --- 1. SSO DATA ISOLATION (RESTRICTIONS DARI USER) ---
        user_email = request.headers.get('X-User-Email')
        if user_email:
            user = User.query.filter_by(email=user_email).first()
            if user:
                # Restriksi Subcompany
                access_records = UserSubcompanyAccess.query.filter_by(user_id=user.id).all()
                allowed_access = [a.sub_company_id for a in access_records]
                if allowed_access:
                    query = query.filter(OsEmployment.sub_company_id.in_(allowed_access))
                    if req_subco and req_subco not in allowed_access:
                        return jsonify({"status": "error", "message": "Akses Subcompany ditolak"}), 403

                # Restriksi Department / Cost Center
                cc_access = UserCostCenterAccess.query.filter_by(user_id=user.id).all()
                allowed_cc = [c.cost_center_id for c in cc_access]
                if allowed_cc:
                    if not has_joined_cc:
                        query = query.join(OsCostCenter, OsGrade.employee_id == OsCostCenter.employee_id)
                        has_joined_cc = True
                    query = query.filter(OsCostCenter.org_cc_id.in_(allowed_cc))
                    
                    if req_dept:
                        try:
                            if int(req_dept) not in allowed_cc:
                                return jsonify({"status": "error", "message": "Akses Departemen ditolak"}), 403
                        except ValueError:
                            pass

        # --- 2. FILTER PARAMETER SEMENTARA DARI FRONTEND ---
        if req_subco:
            query = query.filter(OsEmployment.sub_company_id == req_subco)

        if req_dept:
            if not has_joined_cc:
                query = query.join(OsCostCenter, OsGrade.employee_id == OsCostCenter.employee_id)
                has_joined_cc = True
            try:
                query = query.filter(OsCostCenter.org_cc_id == int(req_dept))
            except ValueError:
                pass

        if search:
            query = query.filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),
                    OsGrade.grade.ilike(f"%{search}%")
                )
            )
            
        now = datetime.now()
        if filter_status == 'active':
            query = query.filter((OsGrade.valid_to >= now) | (OsGrade.valid_to == None))
        elif filter_status == 'inactive':
            query = query.filter(OsGrade.valid_to < now)
            
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

@osGrade_bp.route('/osgrade/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form
        old_grade = OsGrade.query.filter_by(employee_id=data.get('employee_id')).order_by(OsGrade.id.desc()).first()
        if old_grade and data.get('valid_from'):
            try:
                new_valid_from = datetime.strptime(data.get('valid_from'), '%Y-%m-%d')
                previous_day = new_valid_from - timedelta(days=1)
                old_grade.valid_to = previous_day.date()
            except ValueError as e:
                print(f"Format tanggal salah: {e}")

        new_OsGrade = OsGrade(
            employee_id = data.get('employee_id'),
            grade = data.get('grade'),
            valid_from = data.get('valid_from'),
            valid_to = data.get('valid_to') if data.get('valid_to') else None
        )
        db.session.add(new_OsGrade)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data grade berhasil disimpan!"}), 201     
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Terjadi kesalahan pada server: " + str(e)}), 500

@osGrade_bp.route('/osgrade/<string:id>', methods=['PUT'])
def update(id):
    try:
        OsGrade_data = OsGrade.query.filter_by(id=id).first()
        if not OsGrade_data:
            return jsonify({"status": "error", "message": "Data grade tidak ditemukan"}), 404

        data = request.json
        OsGrade_data.employee_id = data.get('employee_id', OsGrade_data.employee_id)
        OsGrade_data.grade = data.get('grade', OsGrade_data.grade)
        OsGrade_data.valid_from = data.get('valid_from', OsGrade_data.valid_from)
        if 'valid_to' in data:
            new_valid_to = data.get('valid_to')
            OsGrade_data.valid_to = new_valid_to if new_valid_to else None
        db.session.commit()
        return jsonify({"status": "success", "message": "Data grade berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@osGrade_bp.route('/osgrade/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = OsGrade.query.filter_by(id=id).first()
        if not data:
            return jsonify({"status": "error", "message": "Data grade tidak ditemukan"}), 404

        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data grade berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500