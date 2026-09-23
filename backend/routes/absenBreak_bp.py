import pandas as pd
from io import BytesIO
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import text
from datetime import datetime, date

from extensions import db
from model.subCompany import SubCompany

AbsenBreak_bp = Blueprint('AbsenBreak_bp', __name__)

# =============================================================================
# CONFIGURATION CONSTANTS (CLEAN & MAINTAINABLE)
# =============================================================================
HYBRID_NODES = ['161', '162', '166', '167', '191', '192', '188', '189', '175', '173']
MAX_BREAK_MINUTES = 240

# =============================================================================
# ZERO-ZOMBIE CONNECTION POLICY (TEARDOWN HOOK)
# =============================================================================
@AbsenBreak_bp.teardown_request
def teardown_request(exception=None):
    try:
        db.session.remove()
    except Exception:
        pass

# =============================================================================
# REUSABLE HELPERS (DRY CORE)
# =============================================================================

def _get_hybrid_pattern():
    """Mengonversi array HYBRID_NODES menjadi pola REGEXP MySQL"""
    if not HYBRID_NODES:
        return "^$"  
    return "|".join(HYBRID_NODES)

def _build_filters_and_params(start_date, end_date, sub_company_id, department_id, search_text=None):
    """Membangun filter WHERE clause dinamis (Sangat Cepat Berkat Normalisasi CTE)"""
    if not start_date or not end_date:
        raise ValueError("Parameter start_date dan end_date wajib diisi")

    filters = []
    params = {'start_date': start_date, 'end_date': end_date}
    
    # 1. Filter Sub Company
    if sub_company_id:
        if sub_company_id in ('TYPE_OS', 'TYPE_VENDOR'):
            target_type = 'OS' if sub_company_id == 'TYPE_OS' else 'Vendor'
            sc_rows = db.session.query(SubCompany.sub_company_id).filter(SubCompany.type_company == target_type).all()
            sc_list = [str(r[0]).strip() for r in sc_rows if r[0]]            
            if sc_list:
                in_clause = ", ".join([f"'{sc}'" for sc in sc_list])
                filters.append(f"k.sub_company_id IN ({in_clause})")
            else:
                filters.append("1 = 0") 
        else:
            filters.append("k.sub_company_id = :sub_company_id")
            params['sub_company_id'] = sub_company_id
            
    # 2. Filter Cost Center (SEKARANG LANGSUNG TEMBAK KE ID NUMERIK)
    if department_id:
        filters.append("k.cost_center_id = :department_id")
        params['department_id'] = department_id
            
    # 3. Filter Pencarian Teks
    if search_text:
        filters.append("(k.emp_id LIKE :search OR k.display_name LIKE :search OR k.card_number LIKE :search)")
        params['search'] = f"%{search_text}%"
        
    filter_clause = " AND " + " AND ".join(filters) if filters else ""
    return filter_clause, params

def _get_base_karyawan_cte():
    """CTE TERNORMALISASI: Mengubah string code Karyawan Tetap menjadi ID numerik org_cost_center"""
    return """
        WITH Karyawan AS (
            SELECT 
                CONVERT(k.employee_id USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_id, 
                CONVERT(k.employee_name USING utf8mb4) COLLATE utf8mb4_general_ci AS display_name, 
                CONVERT(k.card_no USING utf8mb4) COLLATE utf8mb4_general_ci AS card_number, 
                -- NORMALISASI: Ubah kode text jadi ID numerik
                CONVERT(CAST(COALESCE(occ.id, k.cost_center) AS CHAR) USING utf8mb4) COLLATE utf8mb4_general_ci AS cost_center_id, 
                CONVERT(COALESCE(occ.org_name, k.dept_name) USING utf8mb4) COLLATE utf8mb4_general_ci AS cc_name, 
                CONVERT(k.company_id USING utf8mb4) COLLATE utf8mb4_general_ci AS sub_company_id
            FROM vw_master_karyawan k
            LEFT JOIN org_cost_center occ ON occ.cost_center = k.cost_center
            
            UNION
            
            SELECT 
                CONVERT(employee_code USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_id, 
                CONVERT(employee_name USING utf8mb4) COLLATE utf8mb4_general_ci AS display_name, 
                CONVERT(card_number USING utf8mb4) COLLATE utf8mb4_general_ci AS card_number, 
                CONVERT(CAST(cost_center_id AS CHAR) USING utf8mb4) COLLATE utf8mb4_general_ci AS cost_center_id, 
                CONVERT(cc_name USING utf8mb4) COLLATE utf8mb4_general_ci AS cc_name, 
                CONVERT(sub_company_id USING utf8mb4) COLLATE utf8mb4_general_ci AS sub_company_id
            FROM vw_master_os_active
        )
    """

def _paginate_data(report_data, page, page_size):
    total_item = len(report_data)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    
    return {
        "status": "success",
        "data": report_data[start_idx:end_idx],
        "total_item": total_item,
        "current_page": page,
        "total_page": (total_item + page_size - 1) // page_size if total_item > 0 else 1
    }

# =============================================================================
# DATA PROCESSORS DENGAN CONTEXT MANAGER (HIT-AND-RUN)
# =============================================================================
def _get_break_data(start_date, end_date, sub_company_id, department_id, search_text=None, status_filter='all_data'):
    filter_clause, params = _build_filters_and_params(start_date, end_date, sub_company_id, department_id, search_text)
    params['hybrid_pattern'] = _get_hybrid_pattern()
    base_cte = _get_base_karyawan_cte()

    sql_query = f"""
        {base_cte},
        ClockData AS (
            SELECT 
                CONVERT(employee_id USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_id, 
                clocking_date as clock_date,
                MIN(CASE WHEN direction IN ('OUT', '1') THEN clocking_time END) as raw_out_dt,
                MAX(CASE WHEN direction IN ('IN', '0') THEN clocking_time END) as raw_in_dt,
                MAX(CASE WHEN direction IN ('OUT', '1') THEN node_id END) as node_out,
                MAX(CASE WHEN direction IN ('IN', '0') THEN node_id END) as node_in
            FROM VW_TACTIVITIES_STAGING_VALID
            WHERE clocking_date BETWEEN :start_date AND :end_date
              AND (clocking_type = 'Break' OR CAST(node_id AS CHAR) REGEXP :hybrid_pattern)
            GROUP BY employee_id, clocking_date
        ),
        MakanData AS (
            SELECT 
                CONVERT(EMPLOYEE_ID USING utf8mb4) COLLATE utf8mb4_general_ci as emp_id, 
                TANGGAL_MAKAN as tanggal_makan, 
                MIN(JAM_MAKAN) as raw_makan_time,
                MIN(STR_TO_DATE(CONCAT(DATE_FORMAT(TANGGAL_MAKAN, '%Y-%m-%d'), ' ', JAM_MAKAN), '%Y-%m-%d %H:%i:%s')) as raw_makan_dt
            FROM `db-webapps`.`KANTIN_KARYAWAN_MAKAN_TBL`
            WHERE TANGGAL_MAKAN BETWEEN :start_date AND :end_date
            GROUP BY EMPLOYEE_ID, TANGGAL_MAKAN
        )
        SELECT 
            k.emp_id, 
            k.display_name, 
            k.cc_name,
            k.card_number,
            COALESCE(c.clock_date, m.tanggal_makan) AS ref_date,
            c.raw_out_dt,
            m.raw_makan_dt,
            c.raw_in_dt,
            IF(c.raw_out_dt IS NOT NULL, UPPER(DATE_FORMAT(c.raw_out_dt, '%d-%b-%Y %H:%i')), '-') as waktu_out,
            IF(m.raw_makan_time IS NOT NULL, UPPER(CONCAT(DATE_FORMAT(m.tanggal_makan, '%d-%b-%Y'), ' ', DATE_FORMAT(m.raw_makan_time, '%H:%i'))), '-') as waktu_makan,
            IF(c.raw_in_dt IS NOT NULL, UPPER(DATE_FORMAT(c.raw_in_dt, '%d-%b-%Y %H:%i')), '-') as waktu_in,
            c.node_out,
            c.node_in
        FROM Karyawan k
        LEFT JOIN ClockData c ON k.emp_id = c.emp_id
        LEFT JOIN MakanData m ON k.emp_id = m.emp_id AND c.clock_date = m.tanggal_makan
        WHERE (c.raw_out_dt IS NOT NULL OR m.raw_makan_dt IS NOT NULL OR c.raw_in_dt IS NOT NULL)
        {filter_clause}
    """
    
    # EKSEKUSI RAW QUERY ZERO-ZOMBIE
    with db.engine.connect() as conn:
        rows = conn.execute(text(sql_query), params).mappings().fetchall()
        
    report_data = []

    def get_break_area(node_id):
        if not node_id: return "-"
        node_str = str(node_id).split('-')[-1]
        if node_str in ('161', '162'): return 'Access Dekat Loker 94'
        if node_str in ('166', '167'): return 'Access Dekat Loker Garuda'
        if node_str in ('191', '192'): return 'Access Gerbang Biru'
        if node_str in ('188', '189'): return 'Access 86'
        if node_str in ('175', '173'): return 'Access Gerbang 92'
        if node_str in ('114', '115', '215', '216'): return 'Access Bike'
        return f"Node {node_str}"

    seen_records = set()
    for row in rows:
        unique_key = f"{row['emp_id']}_{row['ref_date']}"        
        if unique_key in seen_records:
            continue
        
        out_dt = row['raw_out_dt']
        makan_dt = row['raw_makan_dt']
        in_dt = row['raw_in_dt']

        valid_start_dts = [dt for dt in [out_dt, makan_dt] if dt is not None]
        start_break_dt = min(valid_start_dts) if valid_start_dts else None

        total_mins = 0
        status = "Normal Break"
        
        if not start_break_dt and not in_dt:
            status = "No Both"
        elif not start_break_dt:
            status = "No Clocking OUT"
        elif not in_dt:
            status = "No Clocking IN"
        else:
            if in_dt > start_break_dt:
                diff_seconds = (in_dt - start_break_dt).total_seconds()
                total_mins = max(0, int(diff_seconds // 60))
            else:
                total_mins = 0

            if total_mins > MAX_BREAK_MINUTES:
                continue

            if total_mins == 0: 
                status = "0 Menit"
            elif total_mins > 60: 
                status = ">60"

        if status_filter != 'all_data':
            if status_filter == 'lengkap' and status != 'Normal Break': continue
            elif status_filter == 'overbreak' and status != '>60': continue
            elif status_filter == 'tidak_lengkap' and status not in ('No Clocking IN', 'No Clocking OUT', 'No Both', '0 Menit'): continue

        seen_records.add(unique_key)

        report_data.append({
            "emp_id": row['emp_id'], 
            "display_name": row['display_name'] or '-',
            "cc_name": row['cc_name'] or '-',
            "card_number": row['card_number'] or '-', 
            "waktu_out": row['waktu_out'],
            "node_out": get_break_area(row['node_out']),
            "waktu_makan": row['waktu_makan'],
            "waktu_in": row['waktu_in'],
            "node_in": get_break_area(row['node_in']),
            "total": total_mins, 
            "status": status
        })

    return report_data

def _get_access_data(start_date, end_date, sub_company_id, department_id, search_text=None):
    filter_clause, params = _build_filters_and_params(start_date, end_date, sub_company_id, department_id, search_text)
    params['hybrid_pattern'] = _get_hybrid_pattern()
    base_cte = _get_base_karyawan_cte()

    sql_query = f"""
        {base_cte},
        ClockData AS (
            SELECT 
                CONVERT(employee_id USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_id, 
                clocking_date as clock_date,
                MIN(CASE WHEN direction IN ('IN', '0') THEN clocking_time END) as raw_in,
                MAX(CASE WHEN direction IN ('OUT', '1') THEN clocking_time END) as raw_out,
                MAX(CASE WHEN direction IN ('IN', '0') THEN node_id END) as node_in,
                MAX(CASE WHEN direction IN ('OUT', '1') THEN node_id END) as node_out
            FROM VW_TACTIVITIES_STAGING_VALID
            WHERE clocking_date BETWEEN :start_date AND :end_date
              AND (clocking_type = 'Access' OR CAST(node_id AS CHAR) REGEXP :hybrid_pattern)
            GROUP BY employee_id, clocking_date
        )
        SELECT 
            k.emp_id, k.display_name, k.card_number, k.cc_name,
            c.clock_date,
            IF(c.raw_in IS NOT NULL, UPPER(DATE_FORMAT(c.raw_in, '%d-%b-%Y %H:%i')), '-') as waktu_in,
            IF(c.raw_out IS NOT NULL, UPPER(DATE_FORMAT(c.raw_out, '%d-%b-%Y %H:%i')), '-') as waktu_out,
            c.node_in, c.node_out
        FROM Karyawan k
        INNER JOIN ClockData c ON k.emp_id = c.emp_id
        WHERE 1=1 {filter_clause}
    """
    
    # EKSEKUSI RAW QUERY ZERO-ZOMBIE
    with db.engine.connect() as conn:
        rows = conn.execute(text(sql_query), params).mappings().fetchall()
        
    report_data = []
    seen_records = set()
    
    def get_access_area(node_id):
        if not node_id: return "-"
        node_str = str(node_id).split('-')[-1]
        if node_str in ('188', '189'): return 'Access 86'
        if node_str in ('173', '175'): return 'Access 92'
        if node_str in ('111', '112', '113', '114', '115', '215', '219', '116', '117', '118'): return 'Access 94'
        return f"Node {node_str}"

    for row in rows:
        unique_key = f"{row['emp_id']}_{row['clock_date']}"        
        if unique_key in seen_records:
            continue
        seen_records.add(unique_key)

        report_data.append({
            "emp_id": row['emp_id'], 
            "display_name": row['display_name'] or '-',
            "cc_name": row['cc_name'] or '-', 
            "card_number": row['card_number'] or '-',
            "waktu_in": row['waktu_in'],
            "node_in": get_access_area(row['node_in']),
            "waktu_out": row['waktu_out'],
            "node_out": get_access_area(row['node_out'])
        })

    return report_data

# =============================================================================
# ENDPOINTS
# =============================================================================
@AbsenBreak_bp.route('/reportBreak')
def reportBreak():
    try:
        report_data = _get_break_data(
            request.args.get('start_date', '').strip(), 
            request.args.get('end_date', '').strip(),
            request.args.get('sub_company_id', '').strip() or request.args.get('sub_company', '').strip(),
            request.args.get('department_id', '').strip() or request.args.get('department', '').strip(),
            request.args.get('search', '').strip(),
            request.args.get('status_filter', 'all_data').strip()
        )
        return jsonify(_paginate_data(report_data, int(request.args.get('page', 1)), int(request.args.get('pageSize', 10)))), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400 if isinstance(e, ValueError) else 500

@AbsenBreak_bp.route('/reportAccess')
def reportAccess():
    try:
        report_data = _get_access_data(
            request.args.get('start_date', '').strip(), 
            request.args.get('end_date', '').strip(),
            request.args.get('sub_company_id', '').strip() or request.args.get('sub_company', '').strip(),
            request.args.get('department_id', '').strip() or request.args.get('department', '').strip(),
            request.args.get('search', '').strip()
        )
        return jsonify(_paginate_data(report_data, int(request.args.get('page', 1)), int(request.args.get('pageSize', 10)))), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400 if isinstance(e, ValueError) else 500

@AbsenBreak_bp.route('/exportBreak')
def exportBreak():
    try:
        start = request.args.get('start_date', '').strip()
        end = request.args.get('end_date', '').strip()
        report_data = _get_break_data(
            start, 
            end, 
            request.args.get('sub_company', '').strip(), 
            request.args.get('department', '').strip(),
            request.args.get('search', '').strip(),
            request.args.get('status_filter', 'all_data').strip()
        )

        if not report_data: return jsonify({"status": "error", "message": "Data tidak ditemukan"}), 400

        df = pd.DataFrame(report_data)
        
        df.rename(columns={
            'emp_id': 'Employee Id', 'display_name': 'Display Name', 'cc_name': 'Cost Center', 'card_number': 'Absence Card No',
            'waktu_out': 'Waktu OUT', 'node_out': 'Node OUT', 'waktu_makan': 'Waktu Makan', 
            'waktu_in': 'Waktu IN', 'node_in': 'Node IN', 'total': 'Total Menit', 'status': 'Status'
        }, inplace=True)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer: df.to_excel(writer, index=False, sheet_name='Break_Report')
        output.seek(0)
        
        return send_file(output, as_attachment=True, download_name=f"Employee_Break_Report_{start}_to_{end}.xlsx")
    except Exception as e: return jsonify({"status": "error", "message": str(e)}), 500

@AbsenBreak_bp.route('/exportAccess')
def exportAccess():
    try:
        start = request.args.get('start_date', '').strip()
        end = request.args.get('end_date', '').strip()
        report_data = _get_access_data(start, end, request.args.get('sub_company', '').strip(), request.args.get('department', '').strip())

        if not report_data: return jsonify({"status": "error", "message": "Data tidak ditemukan"}), 400

        df = pd.DataFrame(report_data)
        
        df.rename(columns={
            'emp_id': 'Employee Id', 'display_name': 'Display Name', 'cc_name': 'Cost Center',
            'card_number': 'Absence Card No', 'waktu_in': 'Waktu IN', 'node_in': 'Node IN', 
            'waktu_out': 'Waktu OUT', 'node_out': 'Node OUT'
        }, inplace=True)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer: df.to_excel(writer, index=False, sheet_name='Access_Report')
        output.seek(0)
        
        return send_file(output, as_attachment=True, download_name=f"Access_Clocking_Report_{start}_to_{end}.xlsx")
    except Exception as e: return jsonify({"status": "error", "message": str(e)}), 500