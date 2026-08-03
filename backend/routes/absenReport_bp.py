import pandas as pd
from io import BytesIO
from collections import defaultdict
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import text
from datetime import datetime

from extensions import db

AbsenReport_bp = Blueprint('AbsenReport_bp', __name__)


# =============================================================================
# HELPER 1: PENGAMBILAN & PIVOTING DATA MANPOWER COST CENTER (LAPORAN 1)
# =============================================================================
def _get_aggregated_mp_cc(sub_company_id, search_date):
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

    if not attendance_rows:
        return [], []

    # Mapping OS
    os_subcom_clause = " AND os.sub_company_id = :sub_company_id " if sub_company_id else ""
    sql_os = f"""
        SELECT CAST(os.employee_code AS CHAR) AS emp_id, cc.org_name AS cc_name,
               COALESCE(sc.sub_company_name, os.sub_company_id, 'OS') AS sub_com_name
        FROM os_employment os
        LEFT JOIN os_org occ ON os.id = occ.employee_id
        LEFT JOIN org_cost_center cc ON occ.cc_id = cc.cost_center
        LEFT JOIN sub_company sc ON os.sub_company_id = sc.sub_company_id
        WHERE 1=1 {os_subcom_clause}
    """
    os_params = {'sub_company_id': sub_company_id} if sub_company_id else {}
    os_rows = db.session.execute(text(sql_os), os_params).mappings().fetchall()
    os_map = {str(r['emp_id']): {"cc": r['cc_name'] or 'TIDAK ADA CC', "sub_com": r['sub_com_name'] or 'UNKNOWN'} for r in os_rows if r['emp_id']}

    # Mapping OB
    sql_ob = """
        SELECT CAST(ob.employee_id AS CHAR) AS emp_id, COALESCE(cc.org_name, ob.cost_center) AS cc_name, 'CRS' AS sub_com_name
        FROM vw_master_karyawan ob
        LEFT JOIN org_cost_center cc ON ob.cost_center = cc.cost_center
    """
    ob_rows = db.session.execute(text(sql_ob)).mappings().fetchall()
    ob_map = {str(r['emp_id']): {"cc": r['cc_name'] or 'TIDAK ADA CC', "sub_com": r['sub_com_name']} for r in ob_rows if r['emp_id']}

    # Pivoting
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
    
    report_data = []
    for cc_name, sub_counts in cc_pivot.items():
        report_data.append({
            "cc": cc_name,
            "sub_companies": {sc: sub_counts.get(sc, 0) for sc in sub_company_list},
            "total_manpower": sum(sub_counts.values())
        })

    report_data.sort(key=lambda x: x['total_manpower'], reverse=True)
    return sub_company_list, report_data


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
        if 1500 <= jam <= 1900: return 'SHIFT 3'
        elif 1000 <= jam <= 1400: return 'SHIFT 2'
        elif 400 <= jam <= 900: return 'SHIFT 1' if jam < 730 else 'NS'
        else: return 'NS'
    else:
        if 2000 <= jam <= 2359: return 'SHIFT 3'
        elif 1300 <= jam <= 1700: return 'SHIFT 2'
        elif 400 <= jam <= 1000: return 'SHIFT 1' if jam < 730 else 'NS'
        else: return 'NS'

def _get_aggregated_daily_shift(search_date):
    """
    Mengembalikan tuple: (report_data, totals_os, totals_ob, grand_total, default_shifts)
    """
    target_date_obj = datetime.strptime(search_date, "%Y-%m-%d")
    is_saturday = (target_date_obj.weekday() == 5)
    default_shifts = ["NS", "SHIFT 1", "SHIFT 2", "SHIFT 3"]

    sql_attendance = """
        SELECT employee_id, clock_in
        FROM `db-webapps`.`TBL_ATTENDANCE`
        WHERE clocking_date = :search_date
          AND employee_id IS NOT NULL
    """
    attendance_rows = db.session.execute(text(sql_attendance), {'search_date': search_date}).mappings().fetchall()

    if not attendance_rows:
        return [], defaultdict(int), defaultdict(int), 0, default_shifts

    # Master OS & OB
    sql_os = """
        SELECT CAST(os.employee_code AS CHAR) AS emp_id, cc.org_name AS cc_name
        FROM os_employment os
        LEFT JOIN os_org occ ON os.id = occ.employee_id
        LEFT JOIN org_cost_center cc ON occ.cc_id = cc.cost_center
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

    # Pivoting
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
# ENDPOINT: LAPORAN MANPOWER PER COST CENTER (VIEW & EXPORT)
# =============================================================================
@AbsenReport_bp.route('/reportMpCc')
def reportMpCc():
    try:
        sub_company_id = request.args.get('sub_company', '', type=str).strip()
        search_date = request.args.get('search_date', '', type=str).strip()

        sub_company_list, report_data = _get_aggregated_mp_cc(sub_company_id, search_date)

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
        sub_company_id = request.args.get('sub_company', '', type=str).strip()
        search_date = request.args.get('search_date', '', type=str).strip()

        sub_company_list, report_data = _get_aggregated_mp_cc(sub_company_id, search_date)

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


# =============================================================================
# ENDPOINT: LAPORAN SUMMARY HARIAN SHIFT (VIEW & EXPORT)
# =============================================================================
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

        # Ekstrak data dari hasil Helper
        for row in report_data:
            cc_indices.append(row['cc'])
            data_values.append([
                row['os']['NS'], row['os']['SHIFT 1'], row['os']['SHIFT 2'], row['os']['SHIFT 3'],
                row['ob']['NS'], row['ob']['SHIFT 1'], row['ob']['SHIFT 2'], row['ob']['SHIFT 3'],
                row['total_cc']
            ])

        # Tambahkan Row TOTAL di Paling Bawah
        cc_indices.append('TOTAL')
        data_values.append([
            totals_os['NS'], totals_os['SHIFT 1'], totals_os['SHIFT 2'], totals_os['SHIFT 3'],
            totals_ob['NS'], totals_ob['SHIFT 1'], totals_ob['SHIFT 2'], totals_ob['SHIFT 3'],
            grand_total
        ])

        # MultiIndex Header
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