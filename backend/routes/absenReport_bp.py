import pandas as pd
from io import BytesIO
from collections import defaultdict
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import text
from sqlalchemy.orm import selectinload
from datetime import datetime

from extensions import db
from model.subCompany import SubCompany
from model.ob_emp import ObEmployee
from model.hr_models import User, UserSubcompanyAccess, UserCostCenterAccess

AbsenReport_bp = Blueprint('AbsenReport_bp', __name__)

# =============================================================================
# REUSABLE HELPERS (MENCEGAH DRY & OPTIMASI PERFORMA)
# =============================================================================
def _export_to_excel(df, sheet_name, filename, include_index=False):
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=include_index, sheet_name=sheet_name)
    output.seek(0)
    return send_file(
        output, 
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True, 
        download_name=filename
    )

def _clean_cc(val):
    if val is None:
        return None
    s = str(val).strip()
    if s.upper() in ('', 'NONE', 'NULL', 'NAN', 'TIDAK ADA CC'):
        return None
    return s

def _resolve_cc(terminal_cc_name, master_cc_name, use_cc):
    """
    Menentukan Tampilan Nama Cost Center:
    - Jika use_cc == 1: Prioritaskan Master CC Name.
    - Jika use_cc == 0: Prioritaskan Terminal Tapping CC Name, Fallback ke Master CC Name.
    """
    t_cc = _clean_cc(terminal_cc_name)
    m_cc = _clean_cc(master_cc_name)
    
    try:
        flag = int(use_cc)
    except (ValueError, TypeError):
        flag = 0

    if flag == 1:
        return m_cc or 'TIDAK ADA CC'
    
    return t_cc if t_cc else (m_cc or 'TIDAK ADA CC')

def _get_master_dictionaries():
    sql_os = """
        SELECT 
            CAST(os.employee_code AS CHAR) AS emp_id, 
            os.employee_name AS display_name, 
            COALESCE(occ.org_name, os.cc_name, os.cost_center_id) AS cc_name, 
            os.cost_center_id,
            os.sub_company_id,
            os.sub_company_name,
            COALESCE(os.use_cc, 0) AS use_cc,
            os.join_date AS valid_from,        
            os.termination_date AS valid_to    
        FROM vw_master_os_active os
        LEFT JOIN org_cost_center occ ON occ.cost_center = os.cost_center_id
        WHERE os.employee_code IS NOT NULL AND os.employee_code != ''
    """
    os_rows = db.session.execute(text(sql_os)).mappings().fetchall()
    os_map = {str(r['emp_id']).strip(): dict(r) for r in os_rows}

    ob_info = ObEmployee.query.options(selectinload(ObEmployee.cc_master)) \
                              .filter(ObEmployee.employee_id.is_not(None)).all()
    
    ob_map = {}
    for ob in ob_info:
        emp_id_str = str(ob.employee_id).strip()
        cc_name_resolved = ob.cc_master.org_name if ob.cc_master else str(ob.cost_center)        
        ob_map[emp_id_str] = {
            'emp_id': emp_id_str,
            'display_name': ob.employee_name,
            'cc_name': cc_name_resolved,
            'cost_center_id': ob.cost_center,
            'use_cc': 1
        }

    return os_map, ob_map

def _fetch_daily_attendance(search_date, worker_type='all'):
    sql = """
        SELECT 
            ta.employee_id,
            ta.card_id,
            MIN(COALESCE(ta.clock_in, ta.clock_out)) AS first_clock_in,
            MIN(CAST(COALESCE(occ.org_name, tm_in.cost_center, tm_out.cost_center) AS CHAR)) AS terminal_cc
            
        FROM `db-webapps`.TBL_ATTENDANCE ta
        LEFT JOIN `db-webapps`.TBL_TACTIVITIES tt_in ON ta.card_id = tt_in.CARD_ID AND ta.clock_in = tt_in.CLOCKING_DATE
        LEFT JOIN `db-it-andreas`.terminal_master tm_in ON tm_in.node_id = tt_in.TERMINAL_ID AND tm_in.company_id = '1111' AND tm_in.terminal_type = 'Attendance'
        LEFT JOIN `db-webapps`.TBL_TACTIVITIES tt_out ON ta.card_id = tt_out.CARD_ID AND ta.clock_out = tt_out.CLOCKING_DATE
        LEFT JOIN `db-it-andreas`.terminal_master tm_out ON tm_out.node_id = tt_out.TERMINAL_ID AND tm_out.company_id = '1111' AND tm_out.terminal_type = 'Attendance'
        LEFT JOIN org_cost_center occ ON occ.id = COALESCE(tm_in.org_cc_id, tm_out.org_cc_id) OR (tm_in.org_cc_id IS NULL AND tm_out.org_cc_id IS NULL AND occ.cost_center = CAST(COALESCE(tm_in.cost_center, tm_out.cost_center) AS CHAR))
        
        WHERE ta.clocking_date = :search_date
          AND ta.employee_id IS NOT NULL 
          AND ta.card_id != '00000.00000'
    """
    if worker_type == 'os':
        sql += " AND CHAR_LENGTH(CAST(ta.employee_id AS CHAR)) < 8 "
    elif worker_type == 'tetap':
        sql += " AND CHAR_LENGTH(CAST(ta.employee_id AS CHAR)) >= 8 "        
        
    sql += " GROUP BY ta.employee_id, ta.card_id, ta.clocking_date "

    return db.session.execute(text(sql), {'search_date': search_date}).mappings().fetchall()

# =============================================================================
# BUSINESS LOGIC: REPORTING
# =============================================================================
def _get_aggregated_mp_cc(search_date):
    """ Laporan 1: MP Per Cost Center """
    att_rows = _fetch_daily_attendance(search_date) if search_date else []
    os_map, ob_map = _get_master_dictionaries()
    
    cc_pivot = defaultdict(lambda: defaultdict(int))
    allowed_sub_companies = ["GLB", "PRO"]

    for row in att_rows:
        emp_id = str(row['employee_id']).strip()
        terminal_cc = row['terminal_cc']
        
        if emp_id in os_map:
            info = os_map[emp_id]
            final_cc = _resolve_cc(terminal_cc, info['cc_name'], info['use_cc'])
            sub_com = info['sub_company_name']
        elif emp_id in ob_map:
            info = ob_map[emp_id]
            final_cc = _resolve_cc(terminal_cc, info['cc_name'], 0) 
            sub_com = 'CRS'
        else:
            continue

        if sub_com in allowed_sub_companies:
            cc_pivot[final_cc][sub_com] += 1

    report_data = []
    for cc_name, sub_counts in cc_pivot.items():
        report_data.append({
            "cc": cc_name,
            "sub_companies": {sc: sub_counts.get(sc, 0) for sc in allowed_sub_companies},
            "total_manpower": sum(sub_counts.values())
        })

    report_data.sort(key=lambda x: x['total_manpower'], reverse=True)
    return allowed_sub_companies, report_data

def determine_shift(clock_in_val, is_saturday):
    if not clock_in_val: return 'SHIFT 1'
    try:
        if isinstance(clock_in_val, datetime): 
            jam = clock_in_val.hour * 100 + clock_in_val.minute
        else:
            val_str = str(clock_in_val).strip()
            time_str = val_str.split(' ')[1] if ' ' in val_str else val_str
            t = datetime.strptime(time_str, "%H:%M:%S")
            jam = t.hour * 100 + t.minute 
    except Exception: return 'SHIFT 1'

    if is_saturday:
        if 1500 <= jam <= 1900: return 'SHIFT 3'
        elif 1000 <= jam <= 1400: return 'SHIFT 2'
        else: return 'SHIFT 1'
    else:
        if jam >= 2000 or jam < 400: return 'SHIFT 3'
        elif 1300 <= jam <= 1700: return 'SHIFT 2'
        else: return 'SHIFT 1'

def _get_aggregated_daily_shift(search_date):
    """ Laporan 2: Summary Absensi Harian (Pivot Shift) """
    att_rows = _fetch_daily_attendance(search_date)
    os_map, ob_map = _get_master_dictionaries()
    
    is_saturday = (datetime.strptime(search_date, "%Y-%m-%d").weekday() == 5)
    default_shifts = ["SHIFT 1", "SHIFT 2", "SHIFT 3"]
    pivot = defaultdict(lambda: {"os": defaultdict(int), "ob": defaultdict(int)})

    for row in att_rows:
        emp_id = str(row['employee_id']).strip()
        terminal_cc = row['terminal_cc']
        shift_detected = determine_shift(row['first_clock_in'], is_saturday)
        
        if emp_id in os_map:
            info = os_map[emp_id]
            final_cc = _resolve_cc(terminal_cc, info['cc_name'], info['use_cc'])
            pivot[final_cc]["os"][shift_detected] += 1
        elif emp_id in ob_map:
            info = ob_map[emp_id]
            final_cc = _resolve_cc(terminal_cc, info['cc_name'], 0)
            pivot[final_cc]["ob"][shift_detected] += 1
        else:
            continue

    report_data = []
    totals_os, totals_ob = defaultdict(int), defaultdict(int)

    for cc_name, categories in pivot.items():
        os_counts = {s: categories["os"].get(s, 0) for s in default_shifts}
        ob_counts = {s: categories["ob"].get(s, 0) for s in default_shifts}
        total_cc = sum(os_counts.values()) + sum(ob_counts.values())

        for s in default_shifts:
            totals_os[s] += os_counts[s]
            totals_ob[s] += ob_counts[s]

        report_data.append({"cc": cc_name, "os": os_counts, "ob": ob_counts, "total_cc": total_cc})

    report_data.sort(key=lambda x: x['total_cc'], reverse=True)
    grand_total = sum(totals_os.values()) + sum(totals_ob.values())

    return report_data, totals_os, totals_ob, grand_total, default_shifts

def _get_mp_employee_data(start_date, end_date, sub_company_id, department_id, search_text='', user_email=None):
    if not start_date or not end_date:
        raise ValueError("Parameter start_date dan end_date wajib diisi")

    # =========================================================================
    # 1. RESOLUSI PASTI UNTUK TARGET COST CENTER (ID, KODE, & NAMA)
    # =========================================================================
    target_dept_id = None
    target_cc_code = None
    target_cc_name = None
    if department_id:
        sql_cc = text("SELECT id, cost_center, org_name FROM org_cost_center WHERE id = :dept_id OR cost_center = :dept_id")
        cc_res = db.session.execute(sql_cc, {'dept_id': department_id}).fetchone()
        if cc_res:
            target_dept_id = str(cc_res[0]).strip()
            target_cc_code = str(cc_res[1]).strip()
            target_cc_name = str(cc_res[2]).strip() if cc_res[2] else None
        else:
            target_dept_id = str(department_id).strip()
            target_cc_code = str(department_id).strip()

    sql_attendance = """
        SELECT 
            daily.employee_id, 
            COUNT(daily.clocking_date) AS working_days,
            SUM(TIMESTAMPDIFF(MINUTE, daily.true_clock_in, daily.true_clock_out)) / 60.0 AS working_hours,
            MIN(daily.terminal_cc) AS terminal_cc,
            MIN(daily.terminal_cc_id) AS terminal_cc_id,
            MIN(daily.terminal_org_cc_id) AS terminal_org_cc_id
        FROM (
            SELECT 
                ta.employee_id, ta.clocking_date, MIN(ta.clock_in) AS true_clock_in, MAX(ta.clock_out) AS true_clock_out,
                MIN(CAST(COALESCE(occ.org_name, tm_in.cost_center, tm_out.cost_center) AS CHAR)) AS terminal_cc,
                MIN(CAST(COALESCE(tm_in.cost_center, tm_out.cost_center) AS CHAR)) AS terminal_cc_id,
                MIN(CAST(COALESCE(tm_in.org_cc_id, tm_out.org_cc_id) AS CHAR)) AS terminal_org_cc_id
            FROM `db-webapps`.TBL_ATTENDANCE ta
            LEFT JOIN `db-webapps`.TBL_TACTIVITIES tt_in ON ta.card_id = tt_in.CARD_ID AND ta.clock_in = tt_in.CLOCKING_DATE
            LEFT JOIN `db-it-andreas`.terminal_master tm_in ON tm_in.node_id = tt_in.TERMINAL_ID AND tm_in.company_id = '1111' AND tm_in.terminal_type = 'Attendance'
            LEFT JOIN `db-webapps`.TBL_TACTIVITIES tt_out ON ta.card_id = tt_out.CARD_ID AND ta.clock_out = tt_out.CLOCKING_DATE
            LEFT JOIN `db-it-andreas`.terminal_master tm_out ON tm_out.node_id = tt_out.TERMINAL_ID AND tm_out.company_id = '1111' AND tm_out.terminal_type = 'Attendance'
            LEFT JOIN org_cost_center occ ON occ.id = COALESCE(tm_in.org_cc_id, tm_out.org_cc_id) OR (tm_in.org_cc_id IS NULL AND tm_out.org_cc_id IS NULL AND occ.cost_center = CAST(COALESCE(tm_in.cost_center, tm_out.cost_center) AS CHAR))
            
            WHERE ta.clocking_date BETWEEN :start_date AND :end_date
              AND ta.employee_id IS NOT NULL 
              AND ta.card_id != '00000.00000'
              AND CHAR_LENGTH(CAST(ta.employee_id AS CHAR)) < 8
            GROUP BY ta.employee_id, ta.clocking_date
        ) daily
        GROUP BY daily.employee_id
    """
    
    att_rows = db.session.execute(text(sql_attendance), {'start_date': start_date, 'end_date': end_date}).mappings().fetchall()
    os_map, _ = _get_master_dictionaries()
    
    allowed_sub_companies = None
    if user_email:
        user = User.query.filter_by(email=user_email).first()
        if user:
            subco_recs = UserSubcompanyAccess.query.filter_by(user_id=user.id).all()
            if subco_recs:
                allowed_sub_companies = [a.sub_company_id for a in subco_recs]

    if not allowed_sub_companies:
        if sub_company_id == 'TYPE_OS':
            sc_rows = db.session.query(SubCompany.sub_company_id).filter(SubCompany.type_company == 'OS').all()
            allowed_sub_companies = [str(r[0]).strip() for r in sc_rows]
        elif sub_company_id == 'TYPE_VENDOR':
            sc_rows = db.session.query(SubCompany.sub_company_id).filter(SubCompany.type_company == 'Vendor').all()
            allowed_sub_companies = [str(r[0]).strip() for r in sc_rows]
        elif sub_company_id:
            allowed_sub_companies = [sub_company_id]
        
    report_data = []

    for row in att_rows:
        emp_id = str(row['employee_id']).strip()
        if emp_id not in os_map:
            continue
            
        info = os_map[emp_id]
        
        # 1. Filter Text Pencarian
        if search_text:
            s_lower = search_text.lower()
            if s_lower not in emp_id.lower() and s_lower not in (info['display_name'] or '').lower():
                continue

        # 2. Filter Sub Company
        db_sub_com = _clean_cc(info.get('sub_company_id'))
        if allowed_sub_companies is not None and db_sub_com not in allowed_sub_companies:
            continue

        # =========================================================================
        # 3. EVALUASI COST CENTER DENGAN DUA LAPIS MATCHING
        # =========================================================================
        use_cc_flag = int(info.get('use_cc', 0) or 0)
        master_cc_id = _clean_cc(info.get('cost_center_id'))
        master_cc_name = _clean_cc(info.get('cc_name'))
        
        terminal_org_cc_id = _clean_cc(row.get('terminal_org_cc_id'))
        terminal_cc_id = _clean_cc(row.get('terminal_cc_id'))
        terminal_cc_name = _clean_cc(row.get('terminal_cc'))
        
        final_cc_name = _resolve_cc(terminal_cc_name, master_cc_name, use_cc_flag)

        if target_dept_id:
            is_matched = False
            
            if use_cc_flag == 1:
                if master_cc_id == target_cc_code or (master_cc_name and target_cc_name and master_cc_name == target_cc_name):
                    is_matched = True
            else:
                # Prioritaskan pencocokan org_cc_id
                if terminal_org_cc_id and terminal_org_cc_id == target_dept_id:
                    is_matched = True
                elif not terminal_org_cc_id and (terminal_cc_id == target_cc_code or (terminal_cc_name and target_cc_name and terminal_cc_name == target_cc_name)):
                    is_matched = True
                elif not terminal_org_cc_id and not terminal_cc_id and (master_cc_id == target_cc_code or master_cc_name == target_cc_name):
                    is_matched = True

            if not is_matched:
                continue

        valid_from = info.get('valid_from')
        valid_to = info.get('valid_to')

        report_data.append({
            "emp_id": emp_id,
            "display_name": info['display_name'] or '-',
            "cc_name": final_cc_name,
            "working_days": int(row['working_days'] or 0),
            "working_hours": round(float(row['working_hours'] or 0), 2),
            "join_date": valid_from.strftime('%d-%b-%Y').upper() if hasattr(valid_from, 'strftime') else (valid_from if valid_from else '-'),
            "termination_date": valid_to.strftime('%d-%b-%Y').upper() if hasattr(valid_to, 'strftime') else (valid_to if valid_to else '-')
        }) 

    return report_data

# =============================================================================
# ENDPOINTS (ROUTE API)
# =============================================================================
@AbsenReport_bp.route('/reportMpCc')
def reportMpCc():
    try:
        search_date = request.args.get('search_date', '', type=str).strip()
        sub_company_list, report_data = _get_aggregated_mp_cc(search_date)
        return jsonify({"status": "success", "sub_companies": sub_company_list, "data": report_data}), 200
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

        date_tag = search_date if search_date else 'all_period'
        return _export_to_excel(pd.DataFrame(excel_rows), 'MP_Per_Cost_Center', f"Report_Manpower_CC_{date_tag}.xlsx")
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@AbsenReport_bp.route('/reportHarian')
def reportHarian():
    try:
        search_date = request.args.get('search_date', '', type=str).strip()
        if not search_date: return jsonify({"status": "error", "message": "Tanggal pencarian wajib diisi"}), 400

        report_data, totals_os, totals_ob, grand_total, default_shifts = _get_aggregated_daily_shift(search_date)
        return jsonify({
            "status": "success", "shifts": default_shifts, "data": report_data,
            "totals": {
                "os": {s: totals_os[s] for s in default_shifts},
                "ob": {s: totals_ob[s] for s in default_shifts},
                "grand_total": grand_total
            }, "total_item": len(report_data)
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@AbsenReport_bp.route('/exportHarian')
def exportHarian():
    try:
        search_date = request.args.get('search_date', '', type=str).strip()
        if not search_date: return jsonify({"status": "error", "message": "Tanggal pencarian wajib diisi"}), 400

        report_data, totals_os, totals_ob, grand_total, default_shifts = _get_aggregated_daily_shift(search_date)
        if not report_data: return jsonify({"status": "error", "message": "Data absensi harian tidak ditemukan"}), 400

        cc_indices, data_values = [], []
        for row in report_data:
            cc_indices.append(row['cc'])
            data_values.append([
                row['os']['SHIFT 1'], row['os']['SHIFT 2'], row['os']['SHIFT 3'],
                row['ob']['SHIFT 1'], row['ob']['SHIFT 2'], row['ob']['SHIFT 3'],
                row['total_cc']
            ])

        cc_indices.append('TOTAL')
        data_values.append([
            totals_os['SHIFT 1'], totals_os['SHIFT 2'], totals_os['SHIFT 3'],
            totals_ob['SHIFT 1'], totals_ob['SHIFT 2'], totals_ob['SHIFT 3'],
            grand_total
        ])

        columns = pd.MultiIndex.from_tuples([
            ('MAN POWER', 'Outsourcing', 'SHIFT 1'), 
            ('MAN POWER', 'Outsourcing', 'SHIFT 2'), 
            ('MAN POWER', 'Outsourcing', 'SHIFT 3'),
            ('MAN POWER', 'Tetap / Kontrak', 'SHIFT 1'), 
            ('MAN POWER', 'Tetap / Kontrak', 'SHIFT 2'), 
            ('MAN POWER', 'Tetap / Kontrak', 'SHIFT 3'),
            ('TOTAL', '', '')
        ])

        df = pd.DataFrame(data_values, index=cc_indices, columns=columns)
        df.index.name = 'COST CENTER'

        return _export_to_excel(df, 'Absensi_Harian', f"Report_Absensi_Harian_{search_date}.xlsx", include_index=True)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@AbsenReport_bp.route('/reportMpEmp')
def reportMpEmployee():
    try:
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('pageSize', 10))
        user_email = request.headers.get('X-User-Email')

        report_data = _get_mp_employee_data(
            start_date, end_date, 
            request.args.get('sub_company', '').strip(), 
            request.args.get('department', '').strip(),
            request.args.get('search', '').strip(),
            user_email=user_email
        )

        total_item = len(report_data)
        start_idx = (page - 1) * page_size
        return jsonify({
            "status": "success", "data": report_data[start_idx : start_idx + page_size],
            "total_item": total_item, "current_page": page,
            "total_page": (total_item + page_size - 1) // page_size if total_item > 0 else 1
        }), 200
    except ValueError as ve:
        return jsonify({"status": "error", "message": str(ve)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@AbsenReport_bp.route('/exportMpEmp')
def exportMpEmployee():
    try:
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()
        user_email = request.headers.get('X-User-Email')
        
        report_data = _get_mp_employee_data(
            start_date, end_date, 
            request.args.get('sub_company', '').strip(), 
            request.args.get('department', '').strip(),
            request.args.get('search', '').strip(),
            user_email=user_email
        )
        
        if not report_data:
            return jsonify({"status": "error", "message": "Data absensi tidak ditemukan"}), 400

        excel_rows = [{
            'Employee Id': r['emp_id'], 'Display Name': r['display_name'], 'Cost Center': r['cc_name'],
            'Number of Working Days': r['working_days'], 'Working Hours': r['working_hours'],
            'Join Date': r['join_date'], 'Termination Date': r['termination_date']
        } for r in report_data]

        return _export_to_excel(pd.DataFrame(excel_rows), 'MP_Per_Employee', f"Report_Manpower_Employee_{start_date}_to_{end_date}.xlsx")
    except ValueError as ve:
        return jsonify({"status": "error", "message": str(ve)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500