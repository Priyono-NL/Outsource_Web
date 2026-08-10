import pandas as pd
from io import BytesIO
from collections import defaultdict
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import text
from datetime import datetime, date

from extensions import db

AbsenReport_bp = Blueprint('AbsenReport_bp', __name__)

# =============================================================================
# HELPER 1: PENGAMBILAN & PIVOTING DATA MANPOWER COST CENTER (LAPORAN 1)
# =============================================================================
def _get_aggregated_mp_cc(search_date):
    att_where = ["employee_id < 10000000", "employee_id IS NOT NULL", "card_id != '00000.00000'"]
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

    if not attendance_rows:
        return [], []

    sql_os = """
        SELECT 
            employee_code AS emp_id, 
            cc_name,
            sub_company_name AS sub_com_name
        FROM vw_master_os_active
    """
    os_rows = db.session.execute(text(sql_os)).mappings().fetchall()
    os_map = {str(r['emp_id']): {"cc": r['cc_name'] or 'TIDAK ADA CC', "sub_com": r['sub_com_name'] or 'UNKNOWN'} for r in os_rows if r['emp_id']}

    sql_ob = """
        SELECT CAST(ob.employee_id AS CHAR) AS emp_id, COALESCE(cc.org_name, ob.cost_center) AS cc_name, 'CRS' AS sub_com_name
        FROM vw_master_karyawan ob
        LEFT JOIN org_cost_center cc ON ob.cost_center = cc.cost_center
    """
    ob_rows = db.session.execute(text(sql_ob)).mappings().fetchall()
    ob_map = {str(r['emp_id']): {"cc": r['cc_name'] or 'TIDAK ADA CC', "sub_com": r['sub_com_name']} for r in ob_rows if r['emp_id']}

    cc_pivot = defaultdict(lambda: defaultdict(int))
    
    allowed_sub_companies = ["GLB", "PRO"]

    for row in attendance_rows:
        str_emp_id = str(row['employee_id'])
        total_absen = row['total_absen']
        info = os_map.get(str_emp_id) or ob_map.get(str_emp_id)

        cc_name = info['cc'] if info else 'TIDAK ADA CC'
        sub_com = info['sub_com'] if info else 'UNKNOWN'

        if sub_com not in allowed_sub_companies:
            continue

        cc_pivot[cc_name][sub_com] += total_absen

    report_data = []
    for cc_name, sub_counts in cc_pivot.items():
        report_data.append({
            "cc": cc_name,
            "sub_companies": {sc: sub_counts.get(sc, 0) for sc in allowed_sub_companies},
            "total_manpower": sum(sub_counts.values())
        })

    report_data.sort(key=lambda x: x['total_manpower'], reverse=True)
    
    return allowed_sub_companies, report_data

# =============================================================================
# HELPER 2: LOGIKA SHIFT & PENGAMBILAN DATA LAPORAN HARIAN (LAPORAN 2)
# =============================================================================
def determine_shift(clock_in_val, is_saturday):
    if not clock_in_val:
        return 'NS'
        
    try:
        if isinstance(clock_in_val, datetime):
            jam = clock_in_val.hour * 100 + clock_in_val.minute
        else:
            val_str = str(clock_in_val).strip()
            time_str = val_str.split(' ')[1] if ' ' in val_str else val_str
            t = datetime.strptime(time_str, "%H:%M:%S")
            jam = t.hour * 100 + t.minute 
    except Exception:
        return 'NS'

    if is_saturday:
        # ==================== HARI SABTU ====================
        if 1500 <= jam <= 1900: 
            return 'SHIFT 3'
        elif 1000 <= jam <= 1400: 
            return 'SHIFT 2'
        elif 400 <= jam <= 900: 
            return 'SHIFT 1'
        else: 
            return 'NS'
    else:
        # ==================== HARI BIASA ====================
        if jam >= 2000 or jam < 400: 
            return 'SHIFT 3'
        elif 1300 <= jam <= 1700: 
            return 'SHIFT 2'
        elif 400 <= jam <= 1000: 
            return 'SHIFT 1'
        else: 
            return 'NS'

def _get_aggregated_daily_shift(search_date):
    target_date_obj = datetime.strptime(search_date, "%Y-%m-%d")
    is_saturday = (target_date_obj.weekday() == 5)
    default_shifts = ["SHIFT 1", "SHIFT 2", "SHIFT 3"]

    sql_attendance = """
        SELECT employee_id, clock_in
        FROM `db-webapps`.`TBL_ATTENDANCE`
        WHERE clocking_date = :search_date
          AND employee_id IS NOT NULL
          AND card_id != '00000.00000'
    """
    attendance_rows = db.session.execute(text(sql_attendance), {'search_date': search_date}).mappings().fetchall()

    if not attendance_rows:
        return [], defaultdict(int), defaultdict(int), 0, default_shifts

    sql_os = """
        SELECT employee_code AS emp_id, cc_name
        FROM vw_master_os_active
    """
    os_rows = db.session.execute(text(sql_os)).mappings().fetchall()
    os_map = {str(r['emp_id']): r['cc_name'] or 'TIDAK ADA CC' for r in os_rows if r['emp_id']}

    sql_ob = """
        SELECT CAST(ob.employee_id AS CHAR) AS emp_id, COALESCE(cc.org_name, ob.cost_center) AS cc_name
        FROM vw_master_karyawan ob
        LEFT JOIN org_cost_center cc ON ob.cost_center = cc.cost_center
    """
    ob_rows = db.session.execute(text(sql_ob)).mappings().fetchall()
    ob_map = {str(r['emp_id']): r['cc_name'] or 'TIDAK ADA CC' for r in ob_rows if r['emp_id']}

    pivot = defaultdict(lambda: {"os": defaultdict(int), "ob": defaultdict(int)})

    for row in attendance_rows:
        emp_id = row['employee_id']
        str_emp_id = str(emp_id)
        clock_in_val = row['clock_in']
        
        shift_detected = determine_shift(clock_in_val, is_saturday)
        
        try: emp_id_num = int(emp_id)
        except ValueError: emp_id_num = 0

        is_outsource = emp_id_num < 10000000

        if is_outsource:
            cc_name = os_map.get(str_emp_id, 'TIDAK ADA CC')
            pivot[cc_name]["os"][shift_detected] += 1
        else:
            cc_name = ob_map.get(str_emp_id, 'TIDAK ADA CC')
            pivot[cc_name]["ob"][shift_detected] += 1

    report_data = []
    totals_os = defaultdict(int)
    totals_ob = defaultdict(int)

    for cc_name, categories in pivot.items():
        os_counts = {s: categories["os"].get(s, 0) for s in default_shifts}
        ob_counts = {s: categories["ob"].get(s, 0) for s in default_shifts}
        total_cc = sum(os_counts.values()) + sum(ob_counts.values())

        for s in default_shifts:
            totals_os[s] += os_counts[s]
            totals_ob[s] += ob_counts[s]

        report_data.append({
            "cc": cc_name,
            "os": os_counts,
            "ob": ob_counts,
            "total_cc": total_cc
        })

    report_data.sort(key=lambda x: x['total_cc'], reverse=True)
    grand_total = sum(totals_os.values()) + sum(totals_ob.values())
    return report_data, totals_os, totals_ob, grand_total, default_shifts

# =============================================================================
# HELPER 3: LAPORAN MANPOWER PER EMPLOYEE
# =============================================================================
def _get_mp_employee_data(start_date, end_date, sub_company_id, department_id):
    if not start_date or not end_date:
        raise ValueError("Parameter start_date dan end_date wajib diisi")

    sql_attendance = """
        SELECT 
            daily.employee_id, 
            COUNT(daily.clocking_date) AS working_days,
            SUM(TIMESTAMPDIFF(MINUTE, daily.true_clock_in, daily.true_clock_out)) / 60.0 AS working_hours
        FROM (
            SELECT 
                employee_id,
                clocking_date,
                MIN(clock_in) AS true_clock_in,
                MAX(clock_out) AS true_clock_out
            FROM `db-webapps`.`TBL_ATTENDANCE`
            WHERE clocking_date BETWEEN :start_date AND :end_date
              AND employee_id < 10000000 
              AND employee_id IS NOT NULL
              AND card_id != '00000.00000'
            GROUP BY employee_id, clocking_date
        ) AS daily
        GROUP BY daily.employee_id
    """
    
    att_rows = db.session.execute(text(sql_attendance), {
        'start_date': start_date, 
        'end_date': end_date
    }).mappings().fetchall()

    if not att_rows:
        return []
        
    att_map = {str(r['employee_id']): r for r in att_rows}

    os_filters = []
    os_params = {}
    
    if sub_company_id:
        os_filters.append("sub_company_id = :sub_company_id")
        os_params['sub_company_id'] = sub_company_id
        
    if department_id:
        os_filters.append("cost_center_id = :department_id")
        os_params['department_id'] = department_id
        
    filter_clause = " AND " + " AND ".join(os_filters) if os_filters else ""

    sql_os = f"""
        SELECT 
            employee_code AS emp_id,
            employee_name AS display_name,
            cc_name,
            emp_join_date AS valid_from,
            emp_termination_date AS valid_to
        FROM vw_master_os_active
        WHERE 1=1 {filter_clause}
    """
    
    os_rows = db.session.execute(text(sql_os), os_params).mappings().fetchall()
    
    report_data = []
    for row in os_rows:
        emp_id = str(row['emp_id'])
        
        if emp_id in att_map:
            att_data = att_map[emp_id]
            
            join_dt = row['valid_from'].strftime('%d-%b-%Y').upper() if row['valid_from'] else '-'
            term_dt = row['valid_to'].strftime('%d-%b-%Y').upper() if row['valid_to'] else '-'
            
            report_data.append({
                "emp_id": emp_id,
                "display_name": row['display_name'] or '-',
                "cc_name": row['cc_name'] or 'TIDAK ADA CC',
                "working_days": int(att_data['working_days'] or 0),
                "working_hours": round(float(att_data['working_hours'] or 0), 2),
                "join_date": join_dt,
                "termination_date": term_dt
            }) 

    return report_data

# =============================================================================
# ENDPOINT
# =============================================================================
@AbsenReport_bp.route('/reportMpCc')
def reportMpCc():
    try:
        search_date = request.args.get('search_date', '', type=str).strip()
        sub_company_list, report_data = _get_aggregated_mp_cc(search_date)

        return jsonify({
            "status": "success",
            "sub_companies": sub_company_list,
            "data": report_data
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@AbsenReport_bp.route('/exportMpCc')
def exportMpCc():
    try:
        search_date = request.args.get('search_date', '', type=str).strip()
        sub_company_list, report_data = _get_aggregated_mp_cc(search_date)

        if not report_data:
            return jsonify({"status": "error", "message": "Data absensi tidak ditemukan"}), 400

        excel_rows = []
        for row in report_data:
            flat_row = {'COST CENTER': row['cc']}
            for sc in sub_company_list:
                flat_row[sc] = row['sub_companies'].get(sc, 0)
            flat_row['TOTAL MANPOWER'] = row['total_manpower']
            excel_rows.append(flat_row)

        total_row = {'COST CENTER': 'TOTAL'}
        for sc in sub_company_list:
            total_row[sc] = sum(r.get(sc, 0) for r in excel_rows)
        total_row['TOTAL MANPOWER'] = sum(r.get('TOTAL MANPOWER', 0) for r in excel_rows)
        excel_rows.append(total_row)

        df = pd.DataFrame(excel_rows)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='MP_Per_Cost_Center')
        output.seek(0)

        date_tag = search_date if search_date else 'all_period'
        return send_file(
            output, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True, download_name=f"Report_Manpower_CC_{date_tag}.xlsx"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@AbsenReport_bp.route('/reportHarian')
def reportHarian():
    try:
        search_date = request.args.get('search_date', '', type=str).strip()
        if not search_date:
            return jsonify({"status": "error", "message": "Tanggal pencarian (search_date) wajib diisi"}), 400

        report_data, totals_os, totals_ob, grand_total, default_shifts = _get_aggregated_daily_shift(search_date)

        return jsonify({
            "status": "success",
            "shifts": default_shifts,
            "data": report_data,
            "totals": {
                "os": {s: totals_os[s] for s in default_shifts},
                "ob": {s: totals_ob[s] for s in default_shifts},
                "grand_total": grand_total
            },
            "total_item": len(report_data)
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@AbsenReport_bp.route('/exportHarian')
def exportHarian():
    try:
        search_date = request.args.get('search_date', '', type=str).strip()
        if not search_date:
            return jsonify({"status": "error", "message": "Tanggal pencarian (search_date) wajib diisi"}), 400

        report_data, totals_os, totals_ob, grand_total, default_shifts = _get_aggregated_daily_shift(search_date)

        if not report_data:
            return jsonify({"status": "error", "message": "Data absensi harian tidak ditemukan"}), 400

        cc_indices = []
        data_values = []

        for row in report_data:
            cc_indices.append(row['cc'])
            data_values.append([
                row['os']['NS'], row['os']['SHIFT 1'], row['os']['SHIFT 2'], row['os']['SHIFT 3'],
                row['ob']['NS'], row['ob']['SHIFT 1'], row['ob']['SHIFT 2'], row['ob']['SHIFT 3'],
                row['total_cc']
            ])

        cc_indices.append('TOTAL')
        data_values.append([
            totals_os['NS'], totals_os['SHIFT 1'], totals_os['SHIFT 2'], totals_os['SHIFT 3'],
            totals_ob['NS'], totals_ob['SHIFT 1'], totals_ob['SHIFT 2'], totals_ob['SHIFT 3'],
            grand_total
        ])

        columns = pd.MultiIndex.from_tuples([
            ('MAN POWER', 'Outsourcing', 'NS'),
            ('MAN POWER', 'Outsourcing', 'SHIFT 1'),
            ('MAN POWER', 'Outsourcing', 'SHIFT 2'),
            ('MAN POWER', 'Outsourcing', 'SHIFT 3'),
            ('MAN POWER', 'Tetap / Kontrak', 'NS'),
            ('MAN POWER', 'Tetap / Kontrak', 'SHIFT 1'),
            ('MAN POWER', 'Tetap / Kontrak', 'SHIFT 2'),
            ('MAN POWER', 'Tetap / Kontrak', 'SHIFT 3'),
            ('TOTAL', '', '')
        ])

        df = pd.DataFrame(data_values, index=cc_indices, columns=columns)
        df.index.name = 'COST CENTER'

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Absensi_Harian', index=True)
        output.seek(0)

        return send_file(
            output, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True, download_name=f"Report_Absensi_Harian_{search_date}.xlsx"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@AbsenReport_bp.route('/reportMpEmp')
def reportMpEmployee():
    try:
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()
        sub_company_id = request.args.get('sub_company', '').strip()
        department_id = request.args.get('department', '').strip() 
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('pageSize', 10))

        report_data = _get_mp_employee_data(start_date, end_date, sub_company_id, department_id)

        total_item = len(report_data)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        
        paginated_data = report_data[start_idx:end_idx]

        return jsonify({
            "status": "success",
            "data": paginated_data,
            "total_item": total_item,
            "current_page": page,
            "total_page": (total_item + page_size - 1) // page_size if total_item > 0 else 1
        }), 200

    except ValueError as ve:
        return jsonify({"status": "error", "message": str(ve)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@AbsenReport_bp.route('/exportMpEmp')
@AbsenReport_bp.route('/exportMpEmp')
def exportMpEmployee():
    try:
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()
        sub_company_id = request.args.get('sub_company', '').strip()
        department_id = request.args.get('department', '').strip()
        
        report_data = _get_mp_employee_data(start_date, end_date, sub_company_id, department_id)

        if not report_data:
            return jsonify({"status": "error", "message": "Data absensi tidak ditemukan untuk periode/departemen ini"}), 400

        excel_rows = []
        for row in report_data:
            excel_rows.append({
                'Employee Id': row['emp_id'],
                'Display Name': row['display_name'],
                'Cost Center': row['cc_name'],
                'Number of Working Days': row['working_days'],
                'Working Hours': row['working_hours'],
                'Join Date': row['join_date'],
                'Termination Date': row['termination_date']
            })

        df = pd.DataFrame(excel_rows)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='MP_Per_Employee')
        output.seek(0)

        filename = f"Report_Manpower_Employee_{start_date}_to_{end_date}.xlsx"
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )

    except ValueError as ve:
        return jsonify({"status": "error", "message": str(ve)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500