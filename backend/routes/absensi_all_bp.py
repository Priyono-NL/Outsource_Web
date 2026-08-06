import pandas as pd
from io import BytesIO
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_, and_, func, cast, String, text
from datetime import datetime
from collections import defaultdict

from extensions import db
from model.absensi_all import Absensi_all
from model.employment import OsEmployment
from model.person import OsPerson
from model.ob_emp import ObEmployee

AbsenAll_bp = Blueprint('AbsenAll_bp', __name__)

@AbsenAll_bp.route('/absensiAll')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str).strip()
        sub_company_id = request.args.get('sub_company', '', type=str)
        start_date = request.args.get('start_date', '', type=str)
        end_date = request.args.get('end_date', '', type=str)
        status_filter = request.args.get('status_filter', 'all_data', type=str)

        query = Absensi_all.query

        # Filter Utama: Hanya employee_id dengan panjang < 8 karakter
        query = query.filter(func.char_length(cast(Absensi_all.employee_id, String)) < 8)

        # Filter Tanggal
        if start_date:
            query = query.filter(Absensi_all.clocking_date >= start_date)
        if end_date:
            query = query.filter(Absensi_all.clocking_date <= end_date)

        # Filter Status Absensi (Violations)
        if status_filter == 'violation_all':
            query = query.filter(or_(Absensi_all.clock_in.is_(None), Absensi_all.clock_out.is_(None)))
        elif status_filter == 'no_in':
            query = query.filter(and_(Absensi_all.clock_in.is_(None), Absensi_all.clock_out.is_not(None)))
        elif status_filter == 'no_out':
            query = query.filter(and_(Absensi_all.clock_in.is_not(None), Absensi_all.clock_out.is_(None)))
        elif status_filter == 'no_both':
            query = query.filter(and_(Absensi_all.clock_in.is_(None), Absensi_all.clock_out.is_(None)))

        # Subquery Lookup Cepat untuk Pencarian Nama/NRP
        if search:
            os_matches = db.session.query(OsEmployment.employee_code)\
                .outerjoin(OsPerson, OsEmployment.person_id == OsPerson.person_id)\
                .filter(func.char_length(cast(OsEmployment.employee_code, String)) < 8)\
                .filter(or_(
                    OsEmployment.employee_code.ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%")
                )).all()

            ob_matches = db.session.query(ObEmployee.employee_id)\
                .filter(func.char_length(cast(ObEmployee.employee_id, String)) < 8)\
                .filter(or_(
                    ObEmployee.employee_id.ilike(f"%{search}%"),
                    ObEmployee.employee_name.ilike(f"%{search}%")
                )).all()

            matched_ids = [r[0] for r in os_matches if r[0]] + [r[0] for r in ob_matches if r[0]]

            if matched_ids:
                query = query.filter(Absensi_all.employee_id.in_(matched_ids))
            else:
                query = query.filter(db.false())

        elif sub_company_id:
            os_subcom_matches = db.session.query(OsEmployment.employee_code)\
                .filter(func.char_length(cast(OsEmployment.employee_code, String)) < 8)\
                .filter(OsEmployment.sub_company_id == sub_company_id).all()
            
            matched_ids = [r[0] for r in os_subcom_matches if r[0]]
            if matched_ids:
                query = query.filter(Absensi_all.employee_id.in_(matched_ids))
            else:
                query = query.filter(db.false())

        # Pagination
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