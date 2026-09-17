import pandas as pd
from io import BytesIO
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_

from extensions import db
from model.osCostCenter import OsCostCenter
from model.costCenter import costCenter
from model.employment import OsEmployment
from model.person import OsPerson
from model.hr_models import User, UserSubcompanyAccess, UserCostCenterAccess

osCC_bp = Blueprint('osCC_bp', __name__)

# Helper pembersih string & tanggal
def clean_val(val):
    if val is None:
        return None
    s = str(val).strip()
    if s.lower() in ('', 'null', 'none', 'undefined'):
        return None
    return s

def parse_date(date_str):
    cleaned = clean_val(date_str)
    if not cleaned:
        return None
    try:
        return datetime.strptime(cleaned, '%Y-%m-%d').date()
    except ValueError:
        return None

def get_allowed_subcompanies():
    user_email = request.headers.get('X-User-Email')
    if not user_email:
        return []
    user = User.query.filter_by(email=user_email).first()
    if not user:
        return []
    access_records = UserSubcompanyAccess.query.filter_by(user_id=user.id).all()
    return [a.sub_company_id for a in access_records]

@osCC_bp.route('/oscc', methods=['GET'])
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 20, type=int)
        search = request.args.get('search', '', type=str)
        filter_status = request.args.get('filter', '', type=str)
        req_subco = request.args.get('subcompany', '', type=str)
        req_dept = request.args.get('department', '', type=str)

        query = OsCostCenter.query.join(OsEmployment, OsCostCenter.employee_id == OsEmployment.id) \
                                  .join(OsPerson, OsEmployment.person_id == OsPerson.person_id)

        # 1. Restriksi SSO
        allowed_subco = get_allowed_subcompanies()
        if allowed_subco:
            query = query.filter(OsEmployment.sub_company_id.in_(allowed_subco))
            if req_subco and req_subco not in allowed_subco:
                return jsonify({"status": "error", "message": "Akses Subcompany ditolak"}), 403

        user_email = request.headers.get('X-User-Email')
        if user_email:
            user = User.query.filter_by(email=user_email).first()
            if user:
                cc_access = UserCostCenterAccess.query.filter_by(user_id=user.id).all()
                allowed_cc = [c.cost_center_id for c in cc_access]
                if allowed_cc:
                    query = query.filter(OsCostCenter.org_cc_id.in_(allowed_cc))
                    if req_dept and int(req_dept) not in allowed_cc:
                        return jsonify({"status": "error", "message": "Akses Departemen ditolak"}), 403

        # 2. Filter Dinamis
        if req_subco:
            query = query.filter(OsEmployment.sub_company_id == req_subco)

        if req_dept:
            try:
                query = query.filter(OsCostCenter.org_cc_id == int(req_dept))
            except ValueError:
                pass

        if search:
            query = query.filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),
                    OsCostCenter.cc_id.cast(db.String).ilike(f"%{search}%")
                )
            )
            
        now = datetime.now().date()
        if filter_status == 'active':
            query = query.filter(or_(OsCostCenter.valid_to >= now, OsCostCenter.valid_to == None))
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
        
        employee_id = clean_val(data.get('employee_id'))
        org_cc_id = clean_val(data.get('org_cc_id') or data.get('cc_id'))
        valid_from_raw = data.get('valid_from')
        valid_to_raw = data.get('valid_to')

        if not employee_id or not org_cc_id or not valid_from_raw:
            return jsonify({"status": "error", "message": "Employee ID, Cost Center, dan Valid From wajib diisi!"}), 400

        new_start_date = parse_date(valid_from_raw)
        if not new_start_date:
            return jsonify({"status": "error", "message": "Format Tanggal Valid From tidak valid!"}), 400

        new_end_date = parse_date(valid_to_raw)
        adjusted_valid_to = new_start_date - timedelta(days=1)

        # Master Cost Center Check
        master_cc = costCenter.query.get(org_cc_id)
        if not master_cc:
            return jsonify({"status": "error", "message": f"Master Cost Center dengan ID {org_cc_id} tidak ditemukan"}), 404

        # Delimit Record Aktif Sebelumnya (Menangani '9999-01-01' Maupun NULL)
        active_old_cc = OsCostCenter.query.filter(
            OsCostCenter.employee_id == employee_id,
            or_(
                OsCostCenter.valid_to == None,
                OsCostCenter.valid_to >= new_start_date
            ),
            OsCostCenter.valid_from <= adjusted_valid_to
        ).all()

        for old_rec in active_old_cc:
            old_rec.valid_to = adjusted_valid_to
            db.session.add(old_rec)

        db.session.flush()

        # Simpan Record Baru
        new_OsCostCenter = OsCostCenter(
            employee_id = employee_id,
            cc_id       = master_cc.cost_center, 
            org_cc_id   = master_cc.id,          
            valid_from  = new_start_date,
            valid_to    = new_end_date
        )
        db.session.add(new_OsCostCenter)
        db.session.commit()

        return jsonify({"status": "success", "message": "Data Cost Center berhasil disimpan!"}), 201    

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Terjadi kesalahan pada server: " + str(e)}), 500


@osCC_bp.route('/oscc/<string:id>', methods=['PUT'])
def update(id):
    try:
        OsCostCenter_data = OsCostCenter.query.get(id)
        if not OsCostCenter_data:
            return jsonify({"status": "error", "message": "Data tidak ditemukan"}), 404

        data = request.json if request.is_json else request.form
        org_cc_id = clean_val(data.get('org_cc_id') or data.get('cc_id'))

        if org_cc_id:
            master_cc = costCenter.query.get(org_cc_id)
            if master_cc:
                OsCostCenter_data.org_cc_id = master_cc.id
                OsCostCenter_data.cc_id = master_cc.cost_center

        if 'valid_from' in data:
            v_from = parse_date(data.get('valid_from'))
            if v_from:
                OsCostCenter_data.valid_from = v_from

        if 'valid_to' in data:
            OsCostCenter_data.valid_to = parse_date(data.get('valid_to'))

        db.session.commit()
        return jsonify({"status": "success", "message": "Data Cost Center berhasil diupdate!"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@osCC_bp.route('/oscc/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = OsCostCenter.query.get(id)
        if not data:
            return jsonify({"status": "error", "message": "Data tidak ditemukan"}), 404

        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data Cost Center berhasil dihapus!"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500