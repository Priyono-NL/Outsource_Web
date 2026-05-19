import pandas as pd
from io import BytesIO
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_

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

        query = Absensi.query
        
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

@AbsenOs_bp.route('/violation')
def violation_list():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        sub_company_id = request.args.get('sub_company', '', type=str)
        start_date = request.args.get('start_date', '', type=str)
        end_date = request.args.get('end_date', '', type=str)

        query = Absensi.query

        query = query.filter(
            or_(
                Absensi.clocking_in.is_(None),
                Absensi.clocking_out.is_(None)
            )
        )
        
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

@AbsenOs_bp.route('/absensi/<string:id>', methods=['PUT'])
def update(id):
    try:
        data = request.json
        data['absensi_id'] = id

        new_bac_os = BAC_os(
            absensi_id = data.get('absensi_id'),
            employee_id = data.get('employee_id'),
            bac_no = data.get('bac_no'),
            bac_ket = data.get('bac_ket'),
        )

        print("--- DEBUG DATA ---")
        print(f"ID yang diterima: {id}")
        print(f"Isi JSON: {data}")
        print("------------------")
        
        if not data:
            return jsonify({"status": "error", "message": "Tidak ada data yang diterima"}), 400

        return jsonify({
            "status": "success", 
            "message": f"BAC Absensi berhasil diupdate!",
            "received_data": data
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500