import pandas as pd
from io import BytesIO
from collections import defaultdict
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import text
from datetime import datetime
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from extensions import db
from model.subCompany import SubCompany

AbsenBreak_bp = Blueprint('AbsenBreak_bp', __name__)

# =============================================================================
# CONFIGURATION CONSTANTS (CLEAN & MAINTAINABLE)
# =============================================================================
HYBRID_NODES = ['161', '162', '166', '167', '191', '192', '188', '189', '175', '173']

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
def _format_period_string(start_str, end_str):
    if not start_str and not end_str:
        return "-"

    def parse_and_format(date_val):
        try:
            dt = datetime.strptime(str(date_val).strip(), '%Y-%m-%d')
            return dt.strftime('%d %b %Y')
        except Exception:
            return str(date_val)

    formatted_start = parse_and_format(start_str)
    formatted_end = parse_and_format(end_str)

    if formatted_start == formatted_end:
        return formatted_start
    return f"{formatted_start} s/d {formatted_end}"

def _get_hybrid_pattern():
    if not HYBRID_NODES:
        return "^$"  
    return "|".join(HYBRID_NODES)

def determine_shift(clock_in_val, is_saturday):
    if not clock_in_val: 
        return 'SHIFT 1'
        
    try:
        if isinstance(clock_in_val, datetime): 
            jam = clock_in_val.hour * 100 + clock_in_val.minute
        else:
            val_str = str(clock_in_val).strip()
            time_str = val_str.split(' ')[1] if ' ' in val_str else val_str
            time_parts = time_str.split(':')
            jam = int(time_parts[0]) * 100 + int(time_parts[1])
    except Exception: 
        return 'SHIFT 1'

    if is_saturday:
        # Shift 1: 04:00 s/d 10:59
        if 400 <= jam <= 1059: 
            return 'SHIFT 1'
        # Shift 2: 11:00 s/d 14:59
        elif 1100 <= jam <= 1459: 
            return 'SHIFT 2'
        # Shift 3: 15:00 s/d 03:59 (Lintas Malam)
        else: 
            return 'SHIFT 3'
            
    else: # HARI NORMAL
        # Shift 1: 04:00 s/d 12:59
        if 400 <= jam <= 1259: 
            return 'SHIFT 1'
        # Shift 2: 13:00 s/d 19:59 (Jam 18:00 akan aman masuk ke sini)
        elif 1300 <= jam <= 1959: 
            return 'SHIFT 2'
        # Shift 3: 20:00 s/d 03:59 (Lintas Malam)
        else: 
            return 'SHIFT 3'

def _build_filters_and_params(start_date, end_date, sub_company_id, department_id, search_text=None):
    """Membangun filter WHERE clause dinamis"""
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
            
    # 2. Filter Cost Center
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
    """CTE TERNORMALISASI: Mengambil Master Karyawan Tetap & OS berbasis Nomor Kartu"""
    return """
        WITH Karyawan AS (
            SELECT 
                CONVERT(k.employee_id USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_id, 
                MAX(CONVERT(k.employee_name USING utf8mb4) COLLATE utf8mb4_general_ci) AS display_name, 
                CONVERT(k.card_no USING utf8mb4) COLLATE utf8mb4_general_ci AS card_number, 
                MAX(CONVERT(CAST(COALESCE(occ.id, k.cost_center) AS CHAR) USING utf8mb4) COLLATE utf8mb4_general_ci) AS cost_center_id, 
                MAX(CONVERT(COALESCE(occ.org_name, k.dept_name) USING utf8mb4) COLLATE utf8mb4_general_ci) AS cc_name, 
                'sub00003' COLLATE utf8mb4_general_ci AS sub_company_id,
                'CRS' COLLATE utf8mb4_general_ci AS sub_company_name,
                'TETAP/KONTRAK' COLLATE utf8mb4_general_ci AS tipe_karyawan
            FROM vw_master_karyawan k
            LEFT JOIN org_cost_center occ ON occ.cost_center = k.cost_center
            WHERE k.card_no IS NOT NULL AND TRIM(k.card_no) != '' AND k.card_no != '00000.00000'
            GROUP BY k.employee_id, k.card_no
            
            UNION ALL
            
            SELECT 
                CONVERT(employee_code USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_id, 
                MAX(CONVERT(employee_name USING utf8mb4) COLLATE utf8mb4_general_ci) AS display_name, 
                CONVERT(card_number USING utf8mb4) COLLATE utf8mb4_general_ci AS card_number, 
                MAX(CONVERT(CAST(cost_center_id AS CHAR) USING utf8mb4) COLLATE utf8mb4_general_ci) AS cost_center_id, 
                MAX(CONVERT(cc_name USING utf8mb4) COLLATE utf8mb4_general_ci) AS cc_name, 
                MAX(CONVERT(sub_company_id USING utf8mb4) COLLATE utf8mb4_general_ci) AS sub_company_id,
                MAX(CONVERT(sub_company_name USING utf8mb4) COLLATE utf8mb4_general_ci) AS sub_company_name,
                MAX(CONVERT(COALESCE(type_worker, 'OS') USING utf8mb4) COLLATE utf8mb4_general_ci) AS tipe_karyawan
            FROM vw_master_os_active
            WHERE card_number IS NOT NULL AND TRIM(card_number) != '' AND card_number != '00000.00000'
            GROUP BY employee_code, card_number
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
# DATA PROCESSORS
# =============================================================================
def _get_break_data(start_date, end_date, sub_company_id, department_id, search_text=None, status_filter='all_data', shift_filter=''):
    filter_clause, params = _build_filters_and_params(start_date, end_date, sub_company_id, department_id, search_text)
    params['hybrid_pattern'] = _get_hybrid_pattern()
    base_cte = _get_base_karyawan_cte()

    sql_query = f"""
        {base_cte},
        ClockData AS (
            SELECT 
                CONVERT(card_id USING utf8mb4) COLLATE utf8mb4_general_ci AS card_id, 
                clocking_date as clock_date,
                MIN(CASE WHEN direction IN ('OUT', '1') THEN clocking_time END) as raw_out_dt,
                MAX(CASE WHEN direction IN ('IN', '0') THEN clocking_time END) as raw_in_dt,
                MAX(CASE WHEN direction IN ('OUT', '1') THEN node_id END) as node_out,
                MAX(CASE WHEN direction IN ('IN', '0') THEN node_id END) as node_in
            FROM VW_TACTIVITIES_STAGING_VALID
            WHERE clocking_date BETWEEN :start_date AND :end_date
              AND (clocking_type = 'Break' OR CAST(node_id AS CHAR) REGEXP :hybrid_pattern)
              AND card_id IS NOT NULL AND card_id != '' AND card_id != '00000.00000'
            GROUP BY card_id, clocking_date
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
            k.sub_company_name,
            k.tipe_karyawan,
            k.cc_name, 
            k.card_number,
            COALESCE(c.clock_date, m.tanggal_makan) AS ref_date,
            c.raw_out_dt,
            m.raw_makan_dt,
            c.raw_in_dt,
            IF(c.raw_out_dt IS NOT NULL, UPPER(DATE_FORMAT(c.raw_out_dt, '%d-%b-%Y')), '-') as tanggal_out,
            IF(c.raw_out_dt IS NOT NULL, DATE_FORMAT(c.raw_out_dt, '%H:%i'), '-') as waktu_out,
            IF(m.raw_makan_time IS NOT NULL, UPPER(DATE_FORMAT(m.tanggal_makan, '%d-%b-%Y')), '-') as tanggal_makan,
            IF(m.raw_makan_time IS NOT NULL, DATE_FORMAT(m.raw_makan_time, '%H:%i'), '-') as waktu_makan,
            IF(c.raw_in_dt IS NOT NULL, UPPER(DATE_FORMAT(c.raw_in_dt, '%d-%b-%Y')), '-') as tanggal_in,
            IF(c.raw_in_dt IS NOT NULL, DATE_FORMAT(c.raw_in_dt, '%H:%i'), '-') as waktu_in,
            c.node_out,
            c.node_in
        FROM Karyawan k
        LEFT JOIN ClockData c ON k.card_number = c.card_id
        LEFT JOIN MakanData m ON k.emp_id = m.emp_id AND c.clock_date = m.tanggal_makan
        WHERE (c.raw_out_dt IS NOT NULL OR m.raw_makan_dt IS NOT NULL OR c.raw_in_dt IS NOT NULL)
        {filter_clause}
    """
    
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

        start_break_dt = out_dt if out_dt is not None else makan_dt

        # -- DETEKSI SHIFT --
        is_saturday = (datetime.strptime(str(row['ref_date']), "%Y-%m-%d").weekday() == 5)
        detected_shift = determine_shift(start_break_dt, is_saturday)

        # -- FILTER SHIFT --
        if shift_filter and shift_filter != 'all_data':
            if detected_shift != shift_filter:
                continue

        total_mins = 0
        status = "Lengkap (Normal)"
        
        if not start_break_dt and not in_dt:
            status = "Tidak Lengkap (No Both)"
            total_mins = 0
        elif not start_break_dt:
            status = "Tidak Lengkap (No OUT)"
            total_mins = 0
        elif not in_dt:
            status = "Tidak Lengkap (No IN)"
            total_mins = 0
        else:
            diff_seconds = (in_dt - start_break_dt).total_seconds()
            calculated_mins = int(diff_seconds // 60)
            
            if calculated_mins <= 0:
                status = "Tidak Lengkap (0 Menit)"
                total_mins = 0
            else:
                total_mins = calculated_mins
                if total_mins > 90:
                    status = "> 90 Menit"
                elif total_mins >= 65:
                    status = "> 65 Menit"
                elif total_mins > 60:
                    status = "> 60 Menit"
                else:
                    status = "Lengkap (Normal)"

        # -- FILTER STATUS --
        if status_filter != 'all_data':
            if status_filter == 'lengkap' and status != 'Lengkap (Normal)':
                continue
            elif status_filter == 'tidak_lengkap' and not status.startswith('Tidak Lengkap'):
                continue
            elif status_filter == 'over60' and total_mins <= 60:
                continue
            elif status_filter == 'over65' and total_mins < 65:
                continue
            elif status_filter == 'over90' and total_mins <= 90:
                continue

        seen_records.add(unique_key)

        report_data.append({
            "emp_id": row['emp_id'], 
            "display_name": row['display_name'] or '-',
            "sub_company_name": row['sub_company_name'] or '-',
            "tipe_karyawan": row['tipe_karyawan'] or '-',
            "cc_name": row['cc_name'] or '-',
            "card_number": row['card_number'] or '-', 
            "shift": detected_shift,
            "tanggal_out": row['tanggal_out'],
            "waktu_out": row['waktu_out'],
            "node_out": get_break_area(row['node_out']),
            "tanggal_makan": row['tanggal_makan'],
            "waktu_makan": row['waktu_makan'],
            "tanggal_in": row['tanggal_in'],
            "waktu_in": row['waktu_in'],
            "node_in": get_break_area(row['node_in']),
            "total": total_mins, 
            "status": status
        })

    return report_data

def _get_access_data(start_date, end_date, sub_company_id, department_id, search_text=None, shift_filter=''):
    filter_clause, params = _build_filters_and_params(start_date, end_date, sub_company_id, department_id, search_text)
    params['hybrid_pattern'] = _get_hybrid_pattern()
    base_cte = _get_base_karyawan_cte()

    sql_query = f"""
        {base_cte},
        ClockData AS (
            SELECT 
                CONVERT(card_id USING utf8mb4) COLLATE utf8mb4_general_ci AS card_id, 
                clocking_date as clock_date,
                MIN(CASE WHEN direction IN ('IN', '0') THEN clocking_time END) as raw_in_dt,
                MAX(CASE WHEN direction IN ('OUT', '1') THEN clocking_time END) as raw_out_dt,
                MAX(CASE WHEN direction IN ('IN', '0') THEN node_id END) as node_in,
                MAX(CASE WHEN direction IN ('OUT', '1') THEN node_id END) as node_out
            FROM VW_TACTIVITIES_STAGING_VALID
            WHERE clocking_date BETWEEN :start_date AND :end_date
              AND (clocking_type = 'Access' OR CAST(node_id AS CHAR) REGEXP :hybrid_pattern)
              AND card_id IS NOT NULL AND card_id != '' AND card_id != '00000.00000'
            GROUP BY card_id, clocking_date
        )
        SELECT 
            k.emp_id, k.display_name, k.sub_company_name, k.tipe_karyawan, k.card_number, k.cc_name,
            c.clock_date,
            c.raw_in_dt,
            c.raw_out_dt,
            IF(c.raw_in_dt IS NOT NULL, UPPER(DATE_FORMAT(c.raw_in_dt, '%d-%b-%Y')), '-') as tanggal_in,
            IF(c.raw_in_dt IS NOT NULL, DATE_FORMAT(c.raw_in_dt, '%H:%i'), '-') as waktu_in,
            IF(c.raw_out_dt IS NOT NULL, UPPER(DATE_FORMAT(c.raw_out_dt, '%d-%b-%Y')), '-') as tanggal_out,
            IF(c.raw_out_dt IS NOT NULL, DATE_FORMAT(c.raw_out_dt, '%H:%i'), '-') as waktu_out,
            c.node_in, c.node_out
        FROM Karyawan k
        INNER JOIN ClockData c ON k.card_number = c.card_id
        WHERE 1=1 {filter_clause}
    """
    
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

        # -- DETEKSI SHIFT --
        is_saturday = (datetime.strptime(str(row['clock_date']), "%Y-%m-%d").weekday() == 5)
        # Menentukan shift dari waktu masuk (raw_in_dt) atau fallback keluar (raw_out_dt)
        ref_time = row['raw_in_dt'] if row['raw_in_dt'] else row['raw_out_dt']
        detected_shift = determine_shift(ref_time, is_saturday)

        # -- FILTER SHIFT --
        if shift_filter and shift_filter != 'all_data':
            if detected_shift != shift_filter:
                continue

        seen_records.add(unique_key)

        report_data.append({
            "emp_id": row['emp_id'], 
            "display_name": row['display_name'] or '-',
            "sub_company_name": row['sub_company_name'] or '-',
            "tipe_karyawan": row['tipe_karyawan'] or '-',
            "cc_name": row['cc_name'] or '-', 
            "card_number": row['card_number'] or '-',
            "shift": detected_shift, # Menambahkan field Shift
            "tanggal_in": row['tanggal_in'],
            "waktu_in": row['waktu_in'],
            "node_in": get_access_area(row['node_in']),
            "tanggal_out": row['tanggal_out'],
            "waktu_out": row['waktu_out'],
            "node_out": get_access_area(row['node_out'])
        })

    return report_data

def _get_summary_break_data(start_date, end_date):
    """
    Menghitung Summary Review Break Time >= 65 minutes.
    """
    all_breaks = _get_break_data(start_date, end_date, '', '', '', 'all_data', '')
    over_breaks = [b for b in all_breaks if b['total'] >= 65]
    
    sub_companies = ["CRS", "GLB", "PRO"]
    pivot_emp = defaultdict(lambda: defaultdict(set))
    pivot_days = defaultdict(lambda: defaultdict(int))
    
    for b in over_breaks:
        cc = b['cc_name']
        sc = b['sub_company_name']
        emp_id = b['emp_id']
        
        pivot_emp[cc][sc].add(emp_id)
        pivot_days[cc][sc] += 1
        
    def format_pivot(pivot_dict, is_set=False):
        data = []
        footer = {sc: 0 for sc in sub_companies}
        footer['grand_total'] = 0
        
        for cc, sc_data in sorted(pivot_dict.items()):
            counts = {}
            row_tot = 0
            for sc in sub_companies:
                val = len(sc_data.get(sc, set())) if is_set else sc_data.get(sc, 0)
                counts[sc] = val
                row_tot += val
                footer[sc] += val
            
            if row_tot > 0:
                data.append({'cc': cc, 'counts': counts, 'row_total': row_tot})
                footer['grand_total'] += row_tot
                
        return data, footer
        
    data_emp, foot_emp = format_pivot(pivot_emp, is_set=True)
    data_days, foot_days = format_pivot(pivot_days, is_set=False)
    
    return sub_companies, data_emp, foot_emp, data_days, foot_days

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
            request.args.get('status_filter', 'all_data').strip(),
            request.args.get('shift_filter', '').strip()
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
            request.args.get('search', '').strip(),
            request.args.get('shift', '').strip()
        )
        return jsonify(_paginate_data(report_data, int(request.args.get('page', 1)), int(request.args.get('pageSize', 10)))), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400 if isinstance(e, ValueError) else 500

@AbsenBreak_bp.route('/exportBreak')
def exportBreak():
    try:
        start = request.args.get('start_date', '').strip()
        end = request.args.get('end_date', '').strip()
        sub_comp = request.args.get('sub_company_id', '').strip() or request.args.get('sub_company', '').strip()
        dept = request.args.get('department_id', '').strip() or request.args.get('department', '').strip()
        search = request.args.get('search', '').strip()
        status_filter = request.args.get('status_filter', 'all_data').strip()
        shift_filter = request.args.get('shift', '').strip()

        report_data = _get_break_data(
            start, end, sub_comp, dept, search, status_filter, shift_filter
        )

        if not report_data: 
            return jsonify({"status": "error", "message": "Data tidak ditemukan"}), 400

        df = pd.DataFrame(report_data)
        
        df.rename(columns={
            'emp_id': 'Employee Id', 
            'display_name': 'Display Name', 
            'sub_company_name': 'Sub Company',
            'tipe_karyawan': 'Tipe',
            'cc_name': 'Cost Center', 
            'card_number': 'Absence Card No',
            'shift': 'Shift',
            'tanggal_out': 'TANGGAL OUT',
            'waktu_out': 'WAKTU OUT', 
            'node_out': 'NODE OUT', 
            'tanggal_makan': 'TANGGAL MAKAN',
            'waktu_makan': 'WAKTU MAKAN', 
            'tanggal_in': 'TANGGAL IN',
            'waktu_in': 'WAKTU IN', 
            'node_in': 'NODE IN', 
            'total': 'Total Menit', 
            'status': 'Status'
        }, inplace=True)
        
        selected_cols = [
            'Employee Id', 'Display Name', 'Sub Company', 'Tipe', 'Cost Center', 
            'Absence Card No', 'Shift', 'TANGGAL OUT', 'WAKTU OUT', 'NODE OUT', 
            'TANGGAL MAKAN', 'WAKTU MAKAN', 'TANGGAL IN', 'WAKTU IN', 'NODE IN', 
            'Total Menit', 'Status'
        ]
        df = df[selected_cols]

        periode_text = _format_period_string(start, end)
        output = BytesIO()

        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Break_Report', startrow=3)
            ws = writer.sheets['Break_Report']

            ws['A1'] = "LAPORAN LOG ISTIRAHAT KARYAWAN"
            ws['A1'].font = Font(name='Calibri', size=13, bold=True, color='1F4E78')
            ws['A2'] = f"Periode: {periode_text}"
            ws['A2'].font = Font(name='Calibri', size=11, bold=True, italic=True)

            header_fill = PatternFill(start_color="F2F4F7", end_color="F2F4F7", fill_type="solid")
            header_font = Font(name='Calibri', size=11, bold=True)
            for cell in ws[4]:
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(vertical="center")

            for col in ws.columns:
                max_len = 0
                col_letter = get_column_letter(col[0].column)
                for cell in col[3:]:
                    val_str = str(cell.value or '')
                    if len(val_str) > max_len:
                        max_len = len(val_str)
                ws.column_dimensions[col_letter].width = max(max_len + 4, 13)

        output.seek(0)
        file_name = f"Employee_Break_Report_{start}.xlsx" if start == end else f"Employee_Break_Report_{start}_to_{end}.xlsx"
        return send_file(output, as_attachment=True, download_name=file_name)
    except Exception as e: 
        return jsonify({"status": "error", "message": str(e)}), 500

@AbsenBreak_bp.route('/exportAccess')
def exportAccess():
    try:
        start = request.args.get('start_date', '').strip()
        end = request.args.get('end_date', '').strip()
        sub_comp = request.args.get('sub_company_id', '').strip() or request.args.get('sub_company', '').strip()
        dept = request.args.get('department_id', '').strip() or request.args.get('department', '').strip()
        search = request.args.get('search', '').strip()
        shift_filter = request.args.get('shift', '').strip()
        report_data = _get_access_data(start, end, sub_comp, dept, search, shift_filter)

        if not report_data: 
            return jsonify({"status": "error", "message": "Data tidak ditemukan"}), 400

        df = pd.DataFrame(report_data)
        
        df.rename(columns={
            'emp_id': 'Employee Id', 
            'display_name': 'Display Name', 
            'sub_company_name': 'Sub Company',
            'tipe_karyawan': 'Tipe',
            'cc_name': 'Cost Center',
            'card_number': 'Absence Card No', 
            'shift': 'Shift',
            'tanggal_in': 'TANGGAL IN', 
            'waktu_in': 'WAKTU IN', 
            'node_in': 'Node IN', 
            'tanggal_out': 'TANGGAL OUT', 
            'waktu_out': 'WAKTU OUT', 
            'node_out': 'Node OUT'
        }, inplace=True)
        
        # Penataan letak susunan kolom yang simetris (Shift disisipkan setelah Absence Card No)
        selected_cols = [
            'Employee Id', 'Display Name', 'Sub Company', 'Tipe', 'Cost Center', 
            'Absence Card No', 'Shift', 'TANGGAL IN', 'WAKTU IN', 'Node IN', 'TANGGAL OUT', 'WAKTU OUT', 'Node OUT'
        ]
        df = df[selected_cols]
        
        periode_text = _format_period_string(start, end)
        output = BytesIO()

        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Access_Report', startrow=3)
            ws = writer.sheets['Access_Report']

            ws['A1'] = "LAPORAN AKSES / CLOCKING KARYAWAN"
            ws['A1'].font = Font(name='Calibri', size=13, bold=True, color='1F4E78')
            ws['A2'] = f"Periode: {periode_text}"
            ws['A2'].font = Font(name='Calibri', size=11, bold=True, italic=True)

            header_fill = PatternFill(start_color="F2F4F7", end_color="F2F4F7", fill_type="solid")
            header_font = Font(name='Calibri', size=11, bold=True)
            for cell in ws[4]:
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(vertical="center")

            for col in ws.columns:
                max_len = 0
                col_letter = get_column_letter(col[0].column)
                for cell in col[3:]:
                    val_str = str(cell.value or '')
                    if len(val_str) > max_len:
                        max_len = len(val_str)
                ws.column_dimensions[col_letter].width = max(max_len + 4, 13)

        output.seek(0)
        file_name = f"Access_Clocking_Report_{start}.xlsx" if start == end else f"Access_Clocking_Report_{start}_to_{end}.xlsx"
        return send_file(output, as_attachment=True, download_name=file_name)
    except Exception as e: 
        return jsonify({"status": "error", "message": str(e)}), 500

# =============================================================================
# NEW ENDPOINTS: SUMMARY BREAK REPORT (API & EXCEL EXPORT)
# =============================================================================
@AbsenBreak_bp.route('/reportSumBreak')
def reportSumBreak():
    try:
        start = request.args.get('start_date', '').strip()
        end = request.args.get('end_date', '').strip()
        
        subcos, d_emp, f_emp, d_days, f_days = _get_summary_break_data(start, end)
        
        return jsonify({
            "status": "success",
            "sub_companies": subcos,
            "data_employees": d_emp,
            "footer_employees": f_emp,
            "data_days": d_days,
            "footer_days": f_days
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@AbsenBreak_bp.route('/exportSumBreak')
def exportSumBreak():
    try:
        start = request.args.get('start_date', '').strip()
        end = request.args.get('end_date', '').strip()
        
        subcos, d_emp, f_emp, d_days, f_days = _get_summary_break_data(start, end)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            
            # =======================================================
            # DATA TABLE 1: REVIEW BY TOTAL EMPLOYEES
            # =======================================================
            df_emp_rows = []
            for row in d_emp:
                r = {'Cost Center': row['cc']}
                for sc in subcos: r[sc] = row['counts'][sc] if row['counts'][sc] > 0 else None
                r['Grand Total'] = row['row_total']
                df_emp_rows.append(r)
            
            foot_e = {'Cost Center': 'Grand Total'}
            for sc in subcos: foot_e[sc] = f_emp[sc] if f_emp[sc] > 0 else None
            foot_e['Grand Total'] = f_emp['grand_total']
            df_emp_rows.append(foot_e)
            
            df_emp = pd.DataFrame(df_emp_rows)
            df_emp.to_excel(writer, index=False, sheet_name='Summary_Break', startrow=4)
            
            ws = writer.sheets['Summary_Break']
            ws['A1'] = "Summary Review Break Time >= 65 minutes"
            ws['A1'].font = Font(size=14, bold=True)
            ws['A2'] = _format_period_string(start, end)
            
            ws['A4'] = "Review by Total Employees"
            ws['A4'].font = Font(color="0000FF", bold=True)
            ws['A5'] = "COUNTUNIQUE of Employ Company"
            ws['A5'].font = Font(italic=True)
            
            for cell in ws[5]:
                cell.fill = PatternFill(start_color="8EA9DB", end_color="8EA9DB", fill_type="solid")
                cell.font = Font(color="FFFFFF", bold=True)
            
            # =======================================================
            # DATA TABLE 2: REVIEW BY TOTAL DAYS
            # =======================================================
            current_row = 5 + len(df_emp_rows) + 3 # Jeda 3 Baris antar tabel
            
            ws[f'A{current_row}'] = "Review by Total Days"
            ws[f'A{current_row}'].font = Font(color="0000FF", bold=True)
            ws[f'A{current_row+1}'] = "COUNTA of Tanggal IN ke I Company"
            ws[f'A{current_row+1}'].font = Font(italic=True)
            
            df_days_rows = []
            for row in d_days:
                r = {'Cost Center': row['cc']}
                for sc in subcos: r[sc] = row['counts'][sc] if row['counts'][sc] > 0 else None
                r['Grand Total'] = row['row_total']
                df_days_rows.append(r)
            
            foot_d = {'Cost Center': 'Grand Total'}
            for sc in subcos: foot_d[sc] = f_days[sc] if f_days[sc] > 0 else None
            foot_d['Grand Total'] = f_days['grand_total']
            df_days_rows.append(foot_d)
            
            df_days = pd.DataFrame(df_days_rows)
            df_days.to_excel(writer, index=False, sheet_name='Summary_Break', startrow=current_row+1, header=True)
            
            for cell in ws[current_row+2]:
                cell.fill = PatternFill(start_color="8EA9DB", end_color="8EA9DB", fill_type="solid")
                cell.font = Font(color="FFFFFF", bold=True)
                
            # Resize Kolom agar Rapi
            for col in ws.columns:
                ws.column_dimensions[col[0].column_letter].width = 18
                
        output.seek(0)
        file_name = f"Summary_Break_Report_{start}_to_{end}.xlsx"
        return send_file(output, as_attachment=True, download_name=file_name)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500
