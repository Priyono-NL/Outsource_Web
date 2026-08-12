from flask import Blueprint, request, jsonify
from sqlalchemy import or_, and_, func, cast, String, tuple_

from extensions import db
from model.absensi_all import Absensi_all
from model.vw_master_os import VwMasterOsActive

AbsenAll_bp = Blueprint('AbsenAll_bp', __name__)

@AbsenAll_bp.route('/absensiAll', methods=['GET'])
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str).strip()
        sub_company_id = request.args.get('sub_company', '', type=str).strip()
        department_id = request.args.get('department', '', type=str).strip()
        
        start_date = request.args.get('start_date', '', type=str)
        end_date = request.args.get('end_date', '', type=str)
        status_filter = request.args.get('status_filter', 'all_data', type=str)

        query = Absensi_all.query
        query = query.filter(func.char_length(cast(Absensi_all.employee_id, String)) < 8)
        query = query.filter(Absensi_all.card_id != '00000.00000')

        if start_date:
            query = query.filter(Absensi_all.clocking_date >= start_date)
        if end_date:
            query = query.filter(Absensi_all.clocking_date <= end_date)

        # =====================================================================
        # UPDATE: FILTER STATUS (SINKRON DENGAN REACT & LOGIKA ANOMALI)
        # =====================================================================
        if status_filter == 'lengkap':
            query = query.filter(and_(
                Absensi_all.clock_in.is_not(None), 
                Absensi_all.clock_out.is_not(None),
                Absensi_all.flag_anomaly != 1
            ))
            
        elif status_filter == 'anomali':
            query = query.filter(Absensi_all.flag_anomaly == 1)
            
        elif status_filter in ['tidak_lengkap', 'violation_all']:
            query = query.filter(
                or_(Absensi_all.clock_in.is_(None), Absensi_all.clock_out.is_(None))
            )
            
        elif status_filter == 'no_in':
            query = query.filter(and_(Absensi_all.clock_in.is_(None), Absensi_all.clock_out.is_not(None)))
            
        elif status_filter == 'no_out':
            query = query.filter(and_(Absensi_all.clock_in.is_not(None), Absensi_all.clock_out.is_(None)))
            
        elif status_filter == 'no_both':
            query = query.filter(and_(Absensi_all.clock_in.is_(None), Absensi_all.clock_out.is_(None)))

        # =====================================================================
        # LOOKUP DATA MASTER OS (TIDAK ADA PERUBAHAN)
        # =====================================================================
        if search or sub_company_id or department_id:
            os_query = db.session.query(VwMasterOsActive.employee_code)

            if department_id:
                os_query = os_query.filter(VwMasterOsActive.cost_center_id == department_id)

            if sub_company_id:
                os_query = os_query.filter(VwMasterOsActive.sub_company_id == sub_company_id)

            if search:
                os_query = os_query.filter(or_(
                    VwMasterOsActive.employee_code.ilike(f"%{search}%"),
                    VwMasterOsActive.employee_name.ilike(f"%{search}%"),
                    VwMasterOsActive.card_number.ilike(f"%{search}%")
                ))
            
            os_matches = os_query.all()
            matched_ids = [r[0] for r in os_matches if r[0]]

            if matched_ids:
                if search:
                    query = query.filter(or_(
                        Absensi_all.employee_id.in_(matched_ids),
                        Absensi_all.card_id.ilike(f"%{search}%")
                    ))
                else:
                    query = query.filter(Absensi_all.employee_id.in_(matched_ids))
            else:
                if search:
                    query = query.filter(Absensi_all.card_id.ilike(f"%{search}%"))
                else:
                    query = query.filter(db.false())

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