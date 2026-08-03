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

# =============================================================================
# 1. ENDPOINT: LIST DATA ABSENSI (DETAIL & PAGINATION)
# =============================================================================
@AbsenAll_bp.route('/absensiAll')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str).strip()
        sub_company_id = request.args.get('sub_company', '', type=str)
        start_date = request.args.get('start_date', '', type=str)
        search_date = request.args.get('search_date', '', type=str)
        status_filter = request.args.get('status_filter', 'all_data', type=str)

        query = Absensi_all.query

        # Filter Utama: Hanya employee_id dengan panjang < 8 karakter
        query = query.filter(func.char_length(cast(Absensi_all.employee_id, String)) < 8)

        # Filter Tanggal
        if start_date:
            query = query.filter(Absensi_all.clocking_date >= start_date)
        if search_date:
            query = query.filter(Absensi_all.clocking_date <= search_date)

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


# =============================================================================
# 2. ENDPOINT: LAPORAN MANPOWER PER COST CENTER
# =============================================================================
@AbsenAll_bp.route('/reportMpCc')
def reportMpCc():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        sub_company_id = request.args.get('sub_company', '', type=str).strip()
        search_date = request.args.get('search_date', '', type=str).strip()

        att_where = ["employee_id < 10000000", "employee_id IS NOT NULL"]
        params = {}

        if search_date:
            att_where.append("clocking_date = :search_date")
            params['search_date'] = search_date

        att_where_sql = " AND ".join(att_where)

        sql_attendance = f"""
            SELECT employee_id, COUNT(*) AS total_absen
            FROM `db-webapps`.`TBL_ATTENDANCE`
            WHERE {att_where_sql}
            GROUP BY employee_id
        """
        attendance_rows = db.session.execute(text(sql_attendance), params).fetchall()

        if not attendance_rows:
            return jsonify({
                "status": "success", 
                "sub_companies": [],
                "data": [], 
                "total_page": 0, 
                "current_page": page, 
                "total_item": 0
            }), 200

        # Mapping Outsource (OS)
        os_subcom_clause = " AND os.sub_company_id = :sub_company_id " if sub_company_id else ""
        sql_os = f"""
            SELECT 
                CAST(os.employee_code AS CHAR) AS emp_id,
                cc.org_name AS cc_name,
                COALESCE(sc.sub_company_name, os.sub_company_id, 'OS') AS sub_com_name
            FROM os_employment os
            LEFT JOIN os_org occ ON os.id = occ.employee_id
            LEFT JOIN org_cost_center cc ON occ.cc_id = cc.cost_center
            LEFT JOIN sub_company sc ON os.sub_company_id = sc.sub_company_id
            WHERE 1=1 {os_subcom_clause}
        """
        os_params = {'sub_company_id': sub_company_id} if sub_company_id else {}
        os_rows = db.session.execute(text(sql_os), os_params).fetchall()

        os_map = {
            str(row[0]): {
                "cc": row[1] or 'TIDAK ADA CC', 
                "sub_com": row[2] or 'UNKNOWN'
            } for row in os_rows if row[0]
        }

        # Mapping Organik (OB)
        sql_ob = """
            SELECT 
                CAST(ob.employee_id AS CHAR) AS emp_id,
                COALESCE(cc.org_name, ob.cost_center) AS cc_name,
                'CRS' AS sub_com_name
            FROM vw_master_karyawan ob
            LEFT JOIN org_cost_center cc ON ob.cost_center = cc.cost_center
        """
        ob_rows = db.session.execute(text(sql_ob)).fetchall()
        ob_map = {
            str(row[0]): {
                "cc": row[1] or 'TIDAK ADA CC', 
                "sub_com": row[2]
            } for row in ob_rows if row[0]
        }

        cc_pivot = defaultdict(lambda: defaultdict(int))
        all_sub_companies = set()

        for emp_id, total_absen in attendance_rows:
            str_emp_id = str(emp_id)

            info = os_map.get(str_emp_id) or ob_map.get(str_emp_id)

            if sub_company_id and str_emp_id not in os_map:
                continue

            if not info:
                cc_name = 'TIDAK ADA CC'
                sub_com = 'UNKNOWN'
            else:
                cc_name = info['cc']
                sub_com = info['sub_com']

            cc_pivot[cc_name][sub_com] += total_absen
            all_sub_companies.add(sub_com)

        sub_company_list = sorted(list(all_sub_companies))

        report_data = []
        for cc_name, sub_counts in cc_pivot.items():
            total_mp = sum(sub_counts.values())
            
            row = {
                "cc": cc_name,
                "sub_companies": {sc: sub_counts.get(sc, 0) for sc in sub_company_list},
                "total_manpower": total_mp
            }
            report_data.append(row)

        report_data.sort(key=lambda x: x['total_manpower'], reverse=True)

        total_item = len(report_data)
        total_page = (total_item + pageSize - 1) // pageSize if pageSize > 0 else 1
        
        start_idx = (page - 1) * pageSize
        end_idx = start_idx + pageSize
        paginated_data = report_data[start_idx:end_idx]

        return jsonify({
            "status": "success",
            "sub_companies": sub_company_list,
            "data": paginated_data,
            "total_page": total_page,
            "current_page": page,
            "total_item": total_item
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@AbsenAll_bp.route('/exportMpCc')
def exportMpCc():
    try:
        sub_company_id = request.args.get('sub_company', '', type=str).strip()
        search_date = request.args.get('search_date', '', type=str).strip()

        # =========================================================================
        # 1. TARIK DATA ABSENSI (Menggunakan .mappings())
        # =========================================================================
        att_where = ["employee_id < 10000000", "employee_id IS NOT NULL"]
        params = {}

        if search_date:
            att_where.append("clocking_date = :search_date")
            params['search_date'] = search_date

        att_where_sql = " AND ".join(att_where)

        sql_attendance = f"""
            SELECT employee_id, COUNT(*) AS total_absen
            FROM `db-webapps`.`TBL_ATTENDANCE`
            WHERE {att_where_sql}
            GROUP BY employee_id
        """
        attendance_rows = db.session.execute(text(sql_attendance), params).mappings().fetchall()

        # Handling jika data absensi kosong
        if not attendance_rows:
            return jsonify({
                "status": "error", 
                "message": "Data absensi tidak ditemukan untuk periode/filter ini"
            }), 400

        # =========================================================================
        # 2. MAPPING MASTER DATA (OS & OB) VIA KEY NAME
        # =========================================================================
        # A. Mapping Outsource (OS)
        os_subcom_clause = " AND os.sub_company_id = :sub_company_id " if sub_company_id else ""
        sql_os = f"""
            SELECT 
                CAST(os.employee_code AS CHAR) AS emp_id,
                cc.org_name AS cc_name,
                COALESCE(sc.sub_company_name, os.sub_company_id, 'OS') AS sub_com_name
            FROM os_employment os
            LEFT JOIN os_org occ ON os.id = occ.employee_id
            LEFT JOIN org_cost_center cc ON occ.cc_id = cc.cost_center
            LEFT JOIN sub_company sc ON os.sub_company_id = sc.sub_company_id
            WHERE 1=1 {os_subcom_clause}
        """
        os_params = {'sub_company_id': sub_company_id} if sub_company_id else {}
        os_rows = db.session.execute(text(sql_os), os_params).mappings().fetchall()

        os_map = {
            str(row['emp_id']): {
                "cc": row['cc_name'] or 'TIDAK ADA CC', 
                "sub_com": row['sub_com_name'] or 'UNKNOWN'
            } for row in os_rows if row['emp_id']
        }

        # B. Mapping Organik (OB)
        sql_ob = """
            SELECT 
                CAST(ob.employee_id AS CHAR) AS emp_id,
                COALESCE(cc.org_name, ob.cost_center) AS cc_name,
                'CRS' AS sub_com_name
            FROM vw_master_karyawan ob
            LEFT JOIN org_cost_center cc ON ob.cost_center = cc.cost_center
        """
        ob_rows = db.session.execute(text(sql_ob)).mappings().fetchall()
        ob_map = {
            str(row['emp_id']): {
                "cc": row['cc_name'] or 'TIDAK ADA CC', 
                "sub_com": row['sub_com_name']
            } for row in ob_rows if row['emp_id']
        }

        # =========================================================================
        # 3. PIVOTING & AGREGASI DI PYTHON MEMORY
        # =========================================================================
        cc_pivot = defaultdict(lambda: defaultdict(int))
        all_sub_companies = set()

        for row in attendance_rows:
            str_emp_id = str(row['employee_id'])
            total_absen = row['total_absen']
            
            info = os_map.get(str_emp_id) or ob_map.get(str_emp_id)

            if sub_company_id and str_emp_id not in os_map:
                continue

            cc_name = info['cc'] if info else 'TIDAK ADA CC'
            sub_com = info['sub_com'] if info else 'UNKNOWN'

            cc_pivot[cc_name][sub_com] += total_absen
            all_sub_companies.add(sub_com)

        sub_company_list = sorted(list(all_sub_companies))

        # =========================================================================
        # 4. GENERATE FILE EXCEL (.XLSX) DENGAN BARIS TOTAL
        # =========================================================================
        excel_rows = []
        for cc_name, sub_counts in cc_pivot.items():
            row_dict = {'COST CENTER': cc_name}
            
            # Kolom Rincian Per Sub Company
            for sc in sub_company_list:
                row_dict[sc] = sub_counts.get(sc, 0)
                
            # Kolom Total Manpower Per Cost Center
            row_dict['TOTAL MANPOWER'] = sum(sub_counts.values())
            excel_rows.append(row_dict)

        if excel_rows:
            total_row = {'COST CENTER': 'TOTAL'}
            
            # Total vertikal per Sub Company
            for sc in sub_company_list:
                total_row[sc] = sum(row.get(sc, 0) for row in excel_rows)
                
            # Grand Total Manpower
            total_row['TOTAL MANPOWER'] = sum(row.get('TOTAL MANPOWER', 0) for row in excel_rows)
            
            # Sisipkan ke baris paling akhir
            excel_rows.append(total_row)

        # Konversi ke DataFrame
        df = pd.DataFrame(excel_rows)

        # Stream file ke memori (RAM)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='MP_Per_Cost_Center')
        output.seek(0)

        date_tag = search_date if search_date else 'all_period'
        filename = f"Report_Manpower_CC_{date_tag}.xlsx"

        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500