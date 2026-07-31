import pandas as pd
from io import BytesIO
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_, and_
from datetime import datetime

from extensions import db
from model.absensi_all import Absensi_all
from model.employment import OsEmployment
from model.person import OsPerson
AbsenAll_bp = Blueprint('AbsenAll_bp', __name__)

@AbsenAll_bp.route('/absensiAll')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        sub_company_id = request.args.get('sub_company', '', type=str)
        start_date = request.args.get('start_date', '', type=str)
        end_date = request.args.get('end_date', '', type=str)
        status_filter = request.args.get('status_filter', 'all_data', type=str)

        query = Absensi_all.query

        if status_filter == 'violation_all':
            query = query.filter(or_(Absensi_all.clock_in.is_(None), Absensi_all.clock_out.is_(None)))
        elif status_filter == 'no_in':
            query = query.filter(and_(Absensi_all.clock_in.is_(None), Absensi_all.clock_out.is_not(None)))
        elif status_filter == 'no_out':
            query = query.filter(and_(Absensi_all.clock_in.is_not(None), Absensi_all.clock_out.is_(None)))
        elif status_filter == 'no_both':
            query = query.filter(and_(Absensi_all.clock_in.is_(None), Absensi_all.clock_out.is_(None)))
        
        needs_employment_join = bool(search or sub_company_id)
        if needs_employment_join:
            query = query.join(OsEmployment, Absensi_all.employee_id == OsEmployment.id)

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
            query = query.filter(Absensi_all.clocking_date >= start_date)
        if end_date:
            query = query.filter(Absensi_all.clocking_date <= end_date)

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