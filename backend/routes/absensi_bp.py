import pandas as pd
from io import BytesIO
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_, and_

from extensions import db
from model.absensi import Absensi, BAC_os
from model.employment import OsEmployment
from model.person import OsPerson

AbsenOs_bp = Blueprint('AbsenOs_bp', __name__)

@AbsenOs_bp.route('/absensi')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        sub_company_id = request.args.get('sub_company', '', type=str)
        start_date = request.args.get('start_date', '', type=str)
        end_date = request.args.get('end_date', '', type=str)
        status_filter = request.args.get('status_filter', 'all_data', type=str)

        query = Absensi.query

        if status_filter == 'violation_all':
            query = query.filter(or_(Absensi.clocking_in.is_(None), Absensi.clocking_out.is_(None)))
        elif status_filter == 'no_in':
            query = query.filter(and_(Absensi.clocking_in.is_(None), Absensi.clocking_out.is_not(None)))
        elif status_filter == 'no_out':
            query = query.filter(and_(Absensi.clocking_in.is_not(None), Absensi.clocking_out.is_(None)))
        elif status_filter == 'no_both':
            query = query.filter(and_(Absensi.clocking_in.is_(None), Absensi.clocking_out.is_(None)))
        
        needs_employment_join = bool(search or sub_company_id)
        if needs_employment_join:
            query = query.join(OsEmployment, Absensi.employee_id == OsEmployment.id)

        if search:
            query = query.join(OsPerson, OsEmployment.person_id == OsPerson.person_id)                     
            query = query.filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),                    
                )
            )
            
        if sub_company_id:
            query = query.filter(OsEmployment.sub_company_id == sub_company_id)

        if start_date:
            query = query.filter(Absensi.date_clocking >= start_date)
        if end_date:
            query = query.filter(Absensi.date_clocking <= end_date)

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

@AbsenOs_bp.route('/absensi/bac/<string:absenId>', methods=['GET'])
def get_bac(absenId):
    extra_info = db.session.query(BAC_os).filter(BAC_os.absensi_id == absenId).first()
    
    if not extra_info:
        return {"clock_in": "", "clock_out": "", "bac_no": "", "bac_ket": ""}
        
    return {
        "clock_in": extra_info.clock_in.isoformat() if extra_info.clock_in else "",
        "clock_out": extra_info.clock_out.isoformat() if extra_info.clock_out else "",
        "bac_no": extra_info.bac_no or "",
        "bac_ket": extra_info.bac_ket or ""
    }

@AbsenOs_bp.route('/absensi/<string:id>', methods=['PUT'])
def update(id):
    try:
        data = request.json
        
        if not data:
            return jsonify({"status": "error", "message": "Tidak ada data yang diterima"}), 400

        clock_in = data.get('clock_in') if data.get('clock_in') != '' else None
        clock_out = data.get('clock_out') if data.get('clock_out') != '' else None

        existing_bac = BAC_os.query.filter_by(absensi_id=id).first()

        if existing_bac:
            existing_bac.employee_id = data.get('employee_id')
            existing_bac.bac_no = data.get('bac_no')
            existing_bac.bac_ket = data.get('bac_ket')
            existing_bac.clock_date = data.get('clock_date')
            existing_bac.clock_in = clock_in
            existing_bac.clock_out = clock_out
            
            message = "BAC Absensi berhasil diupdate!"
            
        else:
            new_bac_os = BAC_os(
                absensi_id = id,
                employee_id = data.get('employee_id'),
                bac_no = data.get('bac_no'),
                bac_ket = data.get('bac_ket'),
                clock_date = data.get('clock_date'),
                clock_in = clock_in,
                clock_out = clock_out
            )
            db.session.add(new_bac_os)
            message = "BAC Absensi berhasil ditambahkan!"

        db.session.commit()

        return jsonify({
            "status": "success", 
            "message": message
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500