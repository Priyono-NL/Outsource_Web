import pandas as pd
from io import BytesIO
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import text
from datetime import datetime, date

from extensions import db

AbsenBreak_bp = Blueprint('AbsenBreak_bp', __name__)

# =============================================================================
# REUSABLE HELPERS (Mencegah pengulangan kode / DRY)
# =============================================================================

def _build_filters_and_params(start_date, end_date, sub_company_id, department_id):
    """Membangun filter WHERE clause dinamis dan dictionary parameter SQL"""
    if not start_date or not end_date:
        raise ValueError("Parameter start_date dan end_date wajib diisi")

    filters = []
    params = {'start_date': start_date, 'end_date': end_date}
    
    if sub_company_id:
        filters.append("k.sub_company_id = :sub_company_id")
        params['sub_company_id'] = sub_company_id
        
    if department_id:
        filters.append("k.cost_center = :department_id")
        params['department_id'] = department_id
        
    filter_clause = " AND " + " AND ".join(filters) if filters else ""
    return filter_clause, params

def _get_base_karyawan_cte():
    """Mengembalikan CTE dasar untuk menggabungkan master karyawan & OS"""
    return """
        WITH Karyawan AS (
            SELECT 
                CONVERT(employee_id USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_id, 
                CONVERT(employee_name USING utf8mb4) COLLATE utf8mb4_general_ci AS display_name, 
                CONVERT(card_no USING utf8mb4) COLLATE utf8mb4_general_ci AS card_number, 
                CONVERT(CAST(cost_center AS CHAR) USING utf8mb4) COLLATE utf8mb4_general_ci AS cost_center, 
                CONVERT(dept_name USING utf8mb4) COLLATE utf8mb4_general_ci AS cc_name, 
                CONVERT(company_id USING utf8mb4) COLLATE utf8mb4_general_ci AS sub_company_id
            FROM vw_master_karyawan
            
            UNION
            
            SELECT 
                CONVERT(employee_code USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_id, 
                CONVERT(employee_name USING utf8mb4) COLLATE utf8mb4_general_ci AS display_name, 
                CONVERT(card_number USING utf8mb4) COLLATE utf8mb4_general_ci AS card_number, 
                CONVERT(CAST(cost_center_id AS CHAR) USING utf8mb4) COLLATE utf8mb4_general_ci AS cost_center, 
                CONVERT(cc_name USING utf8mb4) COLLATE utf8mb4_general_ci AS cc_name, 
                CONVERT(sub_company_id USING utf8mb4) COLLATE utf8mb4_general_ci AS sub_company_id
            FROM vw_master_os_active
        )
    """

def _paginate_data(report_data, page, page_size):
    """Helper untuk memotong data sesuai pagination yang diminta"""
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
# DATA PROCESSORS
# =============================================================================

def _get_break_data(start_date, end_date, sub_company_id, department_id):
    filter_clause, params = _build_filters_and_params(start_date, end_date, sub_company_id, department_id)
    base_cte = _get_base_karyawan_cte()

    sql_query = f"""
        {base_cte},
        ClockData AS (
            SELECT 
                CONVERT(emp_id USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_id, 
                DATE(clocking_time) as clock_date,
                DATE_FORMAT(MIN(CASE WHEN direction = 'OUT' THEN clocking_time END), '%H:%i') as jam_out,
                DATE_FORMAT(MAX(CASE WHEN direction = 'IN' THEN clocking_time END), '%H:%i') as jam_in,
                MAX(node_id) as node_id
            FROM vw_filter_test
            WHERE DATE(clocking_time) BETWEEN :start_date AND :end_date
              AND action_flag = 'Break'
            GROUP BY emp_id, DATE(clocking_time)
        ),
        MakanData AS (
            SELECT 
                CONVERT(EMPLOYEE_ID USING utf8mb4) COLLATE utf8mb4_general_ci as emp_id, 
                TANGGAL_MAKAN as tanggal_makan, 
                DATE_FORMAT(MIN(JAM_MAKAN), '%H:%i') as jam_makan
            FROM `db-webapps`.`KANTIN_KARYAWAN_MAKAN_TBL`
            WHERE TANGGAL_MAKAN BETWEEN :start_date AND :end_date
            GROUP BY EMPLOYEE_ID, TANGGAL_MAKAN
        )
        SELECT 
            k.emp_id, 
            k.display_name, 
            k.card_number,
            c.clock_date as tanggal_out, 
            c.jam_out,
            m.tanggal_makan, 
            m.jam_makan,
            c.clock_date as tanggal_in, 
            c.jam_in,
            c.node_id
        FROM Karyawan k
        LEFT JOIN ClockData c ON k.emp_id = c.emp_id
        LEFT JOIN MakanData m ON k.emp_id = m.emp_id AND c.clock_date = m.tanggal_makan
        WHERE (c.jam_out IS NOT NULL OR m.jam_makan IS NOT NULL OR c.jam_in IS NOT NULL)
        {filter_clause}
    """
    
    rows = db.session.execute(text(sql_query), params).mappings().fetchall()
    report_data = []

    def get_break_area(node_id):
        if not node_id: return "-"
        node_str = str(node_id)
        if node_str in ('161', '162'): return 'Access Dekat Loker 94'
        if node_str in ('166', '167'): return 'Access Dekat Loker Garuda'
        if node_str in ('191', '192'): return 'Access Gerbang Biru'
        if node_str in ('188', '189'): return 'Access 86'
        if node_str in ('175', '173'): return 'Access Gerbang 92'
        if node_str in ('114', '115', '215', '216'): return 'Access Bike'
        return f"Node {node_str}"

    for row in rows:
        jam_out_str, jam_makan_str, jam_in_str = row['jam_out'], row['jam_makan'], row['jam_in']
        
        tgl_out_str = row['tanggal_out'].strftime('%d-%b-%Y').upper() if row['tanggal_out'] else ""
        tgl_mak_str = row['tanggal_makan'].strftime('%d-%b-%Y').upper() if row['tanggal_makan'] else ""
        tgl_in_str = row['tanggal_in'].strftime('%d-%b-%Y').upper() if row['tanggal_in'] else ""
        
        total_mins = 0
        status = "Normal Break"
        
        if not jam_in_str:
            status = "No Clocking IN"
        else:
            start_break_str = min(filter(None, [jam_out_str, jam_makan_str]), default=None)
                
            if start_break_str:
                dt_in = datetime.strptime(jam_in_str, '%H:%M')
                dt_start = datetime.strptime(start_break_str, '%H:%M')
                
                total_mins = max(0, int((dt_in - dt_start).total_seconds() // 60))
                if total_mins > 60: status = ">60"
            else:
                status = "No Clocking OUT"
                
        report_data.append({
            "emp_id": row['emp_id'], "display_name": row['display_name'] or '-',
            "card_number": row['card_number'] or '-', "tanggal_out": tgl_out_str,
            "jam_out": jam_out_str or "", "tanggal_makan": tgl_mak_str,
            "jam_makan": jam_makan_str or "", "tanggal_in": tgl_in_str,
            "jam_in": jam_in_str or "", "access_area": get_break_area(row['node_id']),
            "total": total_mins, "status": status
        })

    return report_data


def _get_access_data(start_date, end_date, sub_company_id, department_id):
    filter_clause, params = _build_filters_and_params(start_date, end_date, sub_company_id, department_id)
    base_cte = _get_base_karyawan_cte()

    sql_query = f"""
        {base_cte},
        ClockData AS (
            SELECT 
                CONVERT(emp_id USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_id, 
                DATE(clocking_time) as clock_date,
                DATE_FORMAT(MIN(CASE WHEN direction = 'IN' THEN clocking_time END), '%H:%i') as time_in,
                DATE_FORMAT(MAX(CASE WHEN direction = 'OUT' THEN clocking_time END), '%H:%i') as time_out,
                MAX(node_id) as node_id
            FROM vw_filter_test
            WHERE DATE(clocking_time) BETWEEN :start_date AND :end_date
              AND action_flag = 'Access'
            GROUP BY emp_id, DATE(clocking_time)
        )
        SELECT 
            k.emp_id, k.display_name, k.card_number, k.cc_name,
            c.clock_date, c.time_in, c.time_out, c.node_id
        FROM Karyawan k
        INNER JOIN ClockData c ON k.emp_id = c.emp_id
        WHERE 1=1 {filter_clause}
    """
    
    rows = db.session.execute(text(sql_query), params).mappings().fetchall()
    report_data = []
    
    def get_access_area(node_id):
        if not node_id: return "-"
        node_str = str(node_id)
        if node_str in ('188', '189'): return 'Access 86'
        if node_str in ('173', '175'): return 'Access 92'
        if node_str in ('111', '112', '113', '114', '115', '215', '219', '116', '117', '118'): return 'Access 94'
        return f"Node {node_str}"

    for row in rows:
        report_data.append({
            "emp_id": row['emp_id'], "display_name": row['display_name'] or '-',
            "cc_name": row['cc_name'] or '-', "card_number": row['card_number'] or '-',
            "time_in": row['time_in'] or "", "time_out": row['time_out'] or "",
            "access_area": get_access_area(row['node_id'])
        })

    return report_data


# =============================================================================
# ENDPOINTS
# =============================================================================

@AbsenBreak_bp.route('/reportBreak')
def reportBreak():
    try:
        report_data = _get_break_data(
            request.args.get('start_date', '').strip(), request.args.get('end_date', '').strip(),
            request.args.get('sub_company_id', '').strip() or request.args.get('sub_company', '').strip(),
            request.args.get('department_id', '').strip() or request.args.get('department', '').strip()
        )
        return jsonify(_paginate_data(report_data, int(request.args.get('page', 1)), int(request.args.get('pageSize', 10)))), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400 if isinstance(e, ValueError) else 500


@AbsenBreak_bp.route('/reportAccess')
def reportAccess():
    try:
        report_data = _get_access_data(
            request.args.get('start_date', '').strip(), request.args.get('end_date', '').strip(),
            request.args.get('sub_company_id', '').strip() or request.args.get('sub_company', '').strip(),
            request.args.get('department_id', '').strip() or request.args.get('department', '').strip()
        )
        return jsonify(_paginate_data(report_data, int(request.args.get('page', 1)), int(request.args.get('pageSize', 10)))), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400 if isinstance(e, ValueError) else 500


@AbsenBreak_bp.route('/exportBreak')
def exportBreak():
    try:
        start = request.args.get('start_date', '').strip()
        end = request.args.get('end_date', '').strip()
        report_data = _get_break_data(start, end, request.args.get('sub_company', '').strip(), request.args.get('department', '').strip())

        if not report_data: return jsonify({"status": "error", "message": "Data tidak ditemukan"}), 400

        df = pd.DataFrame(report_data)
        df.rename(columns={
            'emp_id': 'Employee Id', 'display_name': 'Display Name', 'card_number': 'Absence Card No',
            'tanggal_out': 'Tanggal OUT', 'jam_out': 'Jam OUT', 'tanggal_makan': 'Tanggal Makan',
            'jam_makan': 'Jam Makan', 'tanggal_in': 'Tanggal IN', 'jam_in': 'Jam IN',
            'access_area': 'Access Area', 'total': 'Total', 'status': 'Status'
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
            'card_number': 'Absence Card No', 'time_in': 'Time In', 'time_out': 'Time Out', 'access_area': 'Access Area'
        }, inplace=True)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer: df.to_excel(writer, index=False, sheet_name='Access_Report')
        output.seek(0)
        
        return send_file(output, as_attachment=True, download_name=f"Access_Clocking_Report_{start}_to_{end}.xlsx")
    except Exception as e: return jsonify({"status": "error", "message": str(e)}), 500