from flask import Blueprint, request, jsonify
from sqlalchemy import or_, and_, func, cast, String, text

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
        # FILTER STATUS ANOMALI
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
            query = query.filter(or_(Absensi_all.clock_in.is_(None), Absensi_all.clock_out.is_(None)))
        elif status_filter == 'no_in':
            query = query.filter(and_(Absensi_all.clock_in.is_(None), Absensi_all.clock_out.is_not(None)))
        elif status_filter == 'no_out':
            query = query.filter(and_(Absensi_all.clock_in.is_not(None), Absensi_all.clock_out.is_(None)))
        elif status_filter == 'no_both':
            query = query.filter(and_(Absensi_all.clock_in.is_(None), Absensi_all.clock_out.is_(None)))

        # =====================================================================
        # LOOKUP DATA MASTER OS (UNTUK SUB COMPANY & PENCARIAN)
        # =====================================================================
        if search or sub_company_id:
            os_query = db.session.query(VwMasterOsActive.employee_code)

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

        # =====================================================================
        # EKSEKUSI PAGINASI ORM
        # =====================================================================
        pagination = query.paginate(page=page, per_page=pageSize, error_out=False)
        items = pagination.items

        # =====================================================================
        # [DEBUG LOGGER] REKONSILIASI OS DETAIL ABSENSI
        # =====================================================================
        # print(f"\n[DEBUG - DETAIL ABSENSI] === PERIODE: {start_date} s/d {end_date} ===")
        # print(f"-> Filter Status  : {status_filter}")
        # print(f"-> Pencarian Teks : '{search}' | Sub Company: '{sub_company_id}'")
        # print(f"-> Total Data OS Ditemukan: {pagination.total}")
        # print(f"=========================================================\n")

        # =====================================================================
        # ENRICHMENT (EVALUASI FLAG use_cc: TERMINAL CC vs MASTER CC)
        # =====================================================================
        final_data = []
        cc_map = {}
        use_cc_map = {}
        master_cc_map = {}

        if items:
            card_ids = tuple(set(str(item.card_id).strip() for item in items if item.card_id))
            dates = tuple(set(str(item.clocking_date) for item in items if item.clocking_date))
            emp_ids = tuple(set(str(item.employee_id).strip() for item in items if item.employee_id))

            # 1. Lookup Flag use_cc & Master Cost Center Name dari VwMasterOsActive
            if card_ids or emp_ids:
                os_filters = []
                if card_ids:
                    os_filters.append(VwMasterOsActive.card_number.in_(card_ids))
                if emp_ids:
                    os_filters.append(VwMasterOsActive.employee_code.in_(emp_ids))
                
                os_info = db.session.query(
                    VwMasterOsActive.card_number,
                    VwMasterOsActive.employee_code,
                    VwMasterOsActive.use_cc,
                    VwMasterOsActive.cc_name
                ).filter(or_(*os_filters)).all()

                for r in os_info:
                    val_use_cc = int(getattr(r, 'use_cc', 0) or 0)
                    cc_master_name = getattr(r, 'cc_name', None)
                    
                    if r.card_number:
                        card_k = str(r.card_number).strip()
                        use_cc_map[card_k] = val_use_cc
                        if cc_master_name: 
                            master_cc_map[card_k] = cc_master_name
                    if r.employee_code:
                        emp_k = str(r.employee_code).strip()
                        use_cc_map[emp_k] = val_use_cc
                        if cc_master_name: 
                            master_cc_map[emp_k] = cc_master_name

            # 2. Query Terminal CC dari Lokasi Tapping (TBL_TACTIVITIES)
            if card_ids and dates:
                sql_terminal_cc = """
                    SELECT 
                        sub.card_id,
                        sub.clocking_date,
                        COALESCE(occ.org_name, sub.raw_cc, 'TIDAK ADA CC') AS terminal_cc
                    FROM (
                        SELECT 
                            ta.card_id,
                            ta.clocking_date,
                            MAX(COALESCE(tm_in.cost_center, tm_out.cost_center)) AS raw_cc
                        FROM `db-webapps`.TBL_ATTENDANCE ta
                        LEFT JOIN `db-webapps`.TBL_TACTIVITIES tt_in 
                            ON ta.card_id = tt_in.CARD_ID 
                           AND ta.clock_in = tt_in.CLOCKING_DATE
                        LEFT JOIN `db-it-andreas`.terminal_master tm_in 
                            ON tm_in.node_id COLLATE utf8mb4_general_ci = tt_in.TERMINAL_ID 
                           AND tm_in.company_id = '1111' 
                           AND tm_in.terminal_type = 'Attendance'
                        LEFT JOIN `db-webapps`.TBL_TACTIVITIES tt_out 
                            ON ta.card_id = tt_out.CARD_ID 
                           AND ta.clock_out = tt_out.CLOCKING_DATE
                        LEFT JOIN `db-it-andreas`.terminal_master tm_out 
                            ON tm_out.node_id COLLATE utf8mb4_general_ci = tt_out.TERMINAL_ID 
                           AND tm_out.company_id = '1111' 
                           AND tm_out.terminal_type = 'Attendance'
                        WHERE ta.card_id IN :card_ids 
                          AND ta.clocking_date IN :dates
                        GROUP BY 
                            ta.card_id,
                            ta.clocking_date
                    ) sub
                    LEFT JOIN org_cost_center occ 
                        ON occ.cost_center COLLATE utf8mb4_general_ci = sub.raw_cc
                """
                
                cc_rows = db.session.execute(text(sql_terminal_cc), {
                    'card_ids': card_ids,
                    'dates': dates
                }).mappings().fetchall()

                cc_map = {(str(row['card_id']).strip(), str(row['clocking_date'])): row['terminal_cc'] for row in cc_rows}

        # 3. Penentuan Output Cost Center Berdasarkan Flag use_cc
        for emp in items:
            emp_dict = emp.to_dict()
            card_key = str(emp.card_id).strip() if emp.card_id else ''
            emp_key = str(emp.employee_id).strip() if emp.employee_id else ''
            date_key = str(emp.clocking_date)

            # Cek nilai flag (prioritas card_key -> emp_key -> default 0)
            flag_use_cc = use_cc_map.get(card_key, use_cc_map.get(emp_key, 0))

            if flag_use_cc == 1:
                # Karyawan Menggunakan Master Cost Center
                master_val = master_cc_map.get(card_key, master_cc_map.get(emp_key, emp_dict.get('cost_center', 'TIDAK ADA CC')))
                emp_dict['cost_center'] = master_val
            else:
                # Karyawan Menggunakan Node ID Cost Center (Terminal Tap)
                key = (card_key, date_key)
                terminal_val = cc_map.get(key)
                if terminal_val:
                    emp_dict['cost_center'] = terminal_val
                else:
                    # Fallback ke Master CC jika data tapping mesin tidak ditemukan
                    master_val = master_cc_map.get(card_key, master_cc_map.get(emp_key, emp_dict.get('cost_center', 'TIDAK ADA CC')))
                    emp_dict['cost_center'] = master_val

            final_data.append(emp_dict)

        # =====================================================================
        # RETURN KE FRONTEND (REACT JS)
        # =====================================================================
        return jsonify({
            "status": "success",
            "data": final_data,
            "total_page": pagination.pages,
            "current_page": pagination.page,
            "total_item": pagination.total
        }), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500