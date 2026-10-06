import os
from io import BytesIO
from datetime import datetime, timedelta
import pandas as pd
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import text
from PIL import Image, ImageOps
from openpyxl.styles import Font
from openpyxl.worksheet.datavalidation import DataValidation  # TAMBAHAN IMPORT

from extensions import db
from model.bac_os import BAC_os

AbsenOs_bp = Blueprint('AbsenOs_bp', __name__)

BAC_EVIDENCE_FOLDER = 'static/uploads/bac_evidence'
if not os.path.exists(BAC_EVIDENCE_FOLDER):
    os.makedirs(BAC_EVIDENCE_FOLDER)

@AbsenOs_bp.teardown_request
def teardown_request(exception=None):
    try:
        db.session.remove()
    except Exception:
        pass

# =============================================================================
# REUSABLE HELPERS & SHIFT DETERMINER
# =============================================================================
def clean_str(val):
    if val is None or pd.isna(val):
        return None
    s = str(val).strip()
    return None if s.lower() in ('', 'none', 'null', 'nan', 'kosong') else s

def parse_dt(dt_val):
    s = clean_str(dt_val)
    if not s:
        return None
    s = s.replace('Z', '').split('.')[0]
    formats = (
        '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M',
        '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M',
        '%d/%m/%Y %H:%M', '%Y-%m-%d %H.%M'
    )
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None

def format_dt(val, is_time=False, iso=False):
    if not val or str(val).lower() in ('none', 'null', ''):
        return "" if not is_time else "KOSONG"
    if hasattr(val, 'strftime'):
        if iso:
            return val.strftime('%Y-%m-%dT%H:%M')
        return val.strftime('%Y-%m-%d %H:%M' if is_time else '%Y-%m-%d')
    val_str = str(val).strip().replace('T', ' ')
    return val_str[:16] if is_time else val_str[:10]

def determine_shift(clock_in_val, clocking_date_val):
    if not clock_in_val or str(clock_in_val).lower() in ('none', 'null', '', 'kosong'):
        return 'SHIFT 1'
    is_saturday = False
    if clocking_date_val:
        try:
            if isinstance(clocking_date_val, datetime):
                is_saturday = (clocking_date_val.weekday() == 5)
            elif hasattr(clocking_date_val, 'weekday'):
                is_saturday = (clocking_date_val.weekday() == 5)
            else:
                c_date_str = str(clocking_date_val).strip()[:10]
                is_saturday = (datetime.strptime(c_date_str, '%Y-%m-%d').weekday() == 5)
        except Exception:
            is_saturday = False

    jam = 0
    try:
        if isinstance(clock_in_val, datetime):
            jam = clock_in_val.hour * 100 + clock_in_val.minute
        else:
            val_str = str(clock_in_val).strip().replace('T', ' ')
            time_str = val_str.split(' ')[1] if ' ' in val_str else val_str
            time_parts = time_str.split(':')
            jam = int(time_parts[0]) * 100 + int(time_parts[1])
    except Exception:
        return 'SHIFT 1'

    if is_saturday:
        if 1500 <= jam <= 1900: return 'SHIFT 3'
        elif 1000 <= jam <= 1400: return 'SHIFT 2'
        else: return 'SHIFT 1'
    else:
        if jam >= 2000 or jam < 400: return 'SHIFT 3'
        elif 1300 <= jam <= 1700: return 'SHIFT 2'
        else: return 'SHIFT 1'

def process_and_save_bac_evidence(file_storage, target_folder, filename_without_ext, max_width=1000, quality=80):
    try:
        img = Image.open(file_storage)
        try: img = ImageOps.exif_transpose(img)
        except Exception: pass
        if img.mode in ("RGBA", "P"): img = img.convert("RGB")
        if img.width > max_width:
            ratio = max_width / float(img.width)
            new_height = int((float(img.height) * float(ratio)))
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
        new_filename = f"{filename_without_ext}.webp"
        file_path = os.path.join(target_folder, new_filename)
        img.save(file_path, "WEBP", quality=quality, optimize=True)
        return f"/{target_folder}/{new_filename}"
    except Exception as e:
        print(f"[ERROR] Gagal mengompresi bukti BAC: {str(e)}")
        return None

def upsert_bac_record(employee_id, clock_date, bac_no, bac_ket, clock_in, clock_out, evidence_photo=None):
    existing = BAC_os.query.filter_by(employee_id=employee_id, clock_date=clock_date).first()
    if existing:
        existing.bac_no = bac_no
        existing.bac_ket = bac_ket
        existing.clock_in = clock_in
        existing.clock_out = clock_out
        if evidence_photo: existing.evidence_photo = evidence_photo
        return existing, False
    else:
        new_bac = BAC_os(
            employee_id=employee_id, bac_no=bac_no, bac_ket=bac_ket,
            clock_date=clock_date, clock_in=clock_in, clock_out=clock_out,
            evidence_photo=evidence_photo, status=1
        )
        db.session.add(new_bac)
        return new_bac, True

# =============================================================================
# CORE SQL QUERY BUILDER
# =============================================================================
def _build_absensi_raw_sql(start_date, end_date, status_filter='all_data', shift_filter='', search='', sub_company_id='', department_id='', worker_type='all'):

    where_clauses = ["1=1", "ex.id IS NULL"]
    params = {}

    if start_date:
        where_clauses.append("ta.clocking_date >= :start_date")
        params['start_date'] = start_date
    if end_date:
        where_clauses.append("ta.clocking_date <= :end_date")
        params['end_date'] = end_date

    if worker_type == 'os':
        where_clauses.append("CHAR_LENGTH(CAST(m.emp_code AS CHAR)) < 8")
    elif worker_type == 'tetap':
        where_clauses.append("CHAR_LENGTH(CAST(m.emp_code AS CHAR)) >= 8")

    if status_filter == 'lengkap':
        where_clauses.append("(COALESCE(b.clock_in, ta.clock_in) IS NOT NULL AND COALESCE(b.clock_out, ta.clock_out) IS NOT NULL AND (ta.flag != 1 OR ta.flag IS NULL))")
    elif status_filter in ('anomali', 'template_revisi'):
        where_clauses.append("""(
            ta.flag = 1 
            OR 
            (SELECT COUNT(1) 
             FROM `db-webapps`.TBL_ATTENDANCE a2 
             WHERE a2.card_id = ta.card_id 
             AND a2.clocking_date = ta.clocking_date) > 1
        )""")
    elif status_filter == 'no_in':
        where_clauses.append("""(
            COALESCE(b.clock_in, ta.clock_in) IS NULL 
            OR 
            (
                b.clock_in IS NULL 
                AND 
                EXISTS (
                    SELECT 1 FROM `db-webapps`.TBL_ATTENDANCE a2 
                    WHERE a2.card_id = ta.card_id 
                    AND a2.clocking_date = ta.clocking_date 
                    AND a2.clock_in IS NULL
                )
            )
        )""")
    elif status_filter == 'no_out':
       where_clauses.append("""(
            COALESCE(b.clock_out, ta.clock_out) IS NULL 
            OR 
            (
                b.clock_out IS NULL 
                AND 
                EXISTS (
                    SELECT 1 FROM `db-webapps`.TBL_ATTENDANCE a2 
                    WHERE a2.card_id = ta.card_id 
                    AND a2.clocking_date = ta.clocking_date 
                    AND a2.clock_out IS NULL
                )
            )
        )""")
    elif status_filter == 'no_both':
        where_clauses.append("(b.clock_in IS NOT NULL AND b.clock_out IS NOT NULL)")

    if shift_filter in ('SHIFT 1', 'SHIFT 2', 'SHIFT 3'):
        eff_in_sql = "COALESCE(b.clock_in, ta.clock_in)"
        is_sat_sql = "DAYOFWEEK(ta.clocking_date) = 7"
        time_num_sql = f"(HOUR({eff_in_sql}) * 100 + MINUTE({eff_in_sql}))"

        sat_s2 = f"({is_sat_sql} AND {time_num_sql} >= 1000 AND {time_num_sql} <= 1400)"
        sat_s3 = f"({is_sat_sql} AND {time_num_sql} >= 1500 AND {time_num_sql} <= 1900)"

        weekday_s2 = f"(NOT ({is_sat_sql}) AND {time_num_sql} >= 1300 AND {time_num_sql} <= 1700)"
        weekday_s3 = f"(NOT ({is_sat_sql}) AND ({time_num_sql} >= 2000 OR {time_num_sql} < 400))"

        if shift_filter == 'SHIFT 2':
            where_clauses.append(f"({eff_in_sql} IS NOT NULL AND ({sat_s2} OR {weekday_s2}))")
        elif shift_filter == 'SHIFT 3':
            where_clauses.append(f"({eff_in_sql} IS NOT NULL AND ({sat_s3} OR {weekday_s3}))")
        elif shift_filter == 'SHIFT 1':
            where_clauses.append(f"({eff_in_sql} IS NULL OR (NOT ({sat_s2} OR {sat_s3} OR {weekday_s2} OR {weekday_s3})))")

    if search:
        where_clauses.append("(m.emp_code LIKE :search OR m.emp_name LIKE :search OR m.master_card_id LIKE :search OR ta.card_id LIKE :search OR b.bac_no LIKE :search)")
        params['search'] = f"%{search}%"

    if sub_company_id:
        if sub_company_id == 'TYPE_OS': 
            where_clauses.append("m.emp_type = 'OS'")
        elif sub_company_id == 'TYPE_VENDOR': 
            where_clauses.append("m.emp_type = 'Vendor'")
        else:
            where_clauses.append("(m.sub_company_id = :sub_company_id OR m.sub_company_name = :sub_company_id)")
            params['sub_company_id'] = sub_company_id

    if department_id:
        sql_cc = text("SELECT id, cost_center, org_name FROM org_cost_center WHERE id = :dept_id OR cost_center = :dept_id OR org_name = :dept_id")
        with db.engine.connect() as conn:
            cc_res = conn.execute(sql_cc, {'dept_id': department_id}).fetchone()

        if cc_res:
            dept_cc_id = str(cc_res[0]).strip()
            dept_cc_code = str(cc_res[1]).strip()
            dept_cc_name = str(cc_res[2]).strip() if cc_res[2] else ''

            where_clauses.append("""(
                (m.use_cc = 1 AND (
                    m.dept_id = :dept_cc_id 
                    OR m.dept_code = :dept_cc_code 
                    OR m.cc_name = :dept_cc_name
                ))
                OR
                (m.use_cc = 0 AND (
                    CAST(COALESCE(tm_in.org_cc_id, tm_out.org_cc_id, occ.id) AS CHAR) = :dept_cc_id
                    OR CAST(COALESCE(tm_in.cost_center, tm_out.cost_center) AS CHAR) = :dept_cc_code
                    OR occ.org_name = :dept_cc_name
                    OR (tm_in.id IS NULL AND tm_out.id IS NULL AND (
                        m.dept_id = :dept_cc_id OR m.dept_code = :dept_cc_code OR m.cc_name = :dept_cc_name
                    ))
                ))
            )""")
            params.update({
                'dept_cc_id': dept_cc_id,
                'dept_cc_code': dept_cc_code,
                'dept_cc_name': dept_cc_name
            })
        else:
            where_clauses.append("""(
                (m.use_cc = 1 AND (m.dept_id = :dept_id OR m.dept_code = :dept_id OR m.cc_name = :dept_id))
                OR
                (m.use_cc = 0 AND (
                    CAST(COALESCE(tm_in.cost_center, tm_out.cost_center) AS CHAR) = :dept_id
                    OR occ.org_name = :dept_id
                    OR (m.dept_id = :dept_id OR m.dept_code = :dept_id OR m.cc_name = :dept_id)
                ))
            )""")
            params['dept_id'] = department_id

    where_sql = " AND ".join(where_clauses)

    sql_query = f"""
        WITH MasterEmp AS (
            SELECT 
                CONVERT(employee_id USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_code,
                MAX(CONVERT(employee_name USING utf8mb4) COLLATE utf8mb4_general_ci) AS emp_name,
                MAX(CONVERT(card_no USING utf8mb4) COLLATE utf8mb4_general_ci) AS master_card_id,
                '-' AS gender,
                'sub00003' AS sub_company_id,
                'CRS' AS sub_company_name,
                MAX(CONVERT(CAST(cost_center AS CHAR) USING utf8mb4) COLLATE utf8mb4_general_ci) AS dept_code,
                MAX(CONVERT(CAST(cost_center AS CHAR) USING utf8mb4) COLLATE utf8mb4_general_ci) AS dept_id,
                MAX(CONVERT(dept_name USING utf8mb4) COLLATE utf8mb4_general_ci) AS cc_name,
                'TETAP/KONTRAK' AS emp_type,
                1 AS use_cc
            FROM vw_master_karyawan
            WHERE employee_id IS NOT NULL AND employee_id != ''
            GROUP BY employee_id
            
            UNION ALL
            
            SELECT 
                CONVERT(employee_code USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_code,
                MAX(CONVERT(employee_name USING utf8mb4) COLLATE utf8mb4_general_ci) AS emp_name,
                MAX(CONVERT(card_number USING utf8mb4) COLLATE utf8mb4_general_ci) AS master_card_id,
                MAX(CONVERT(COALESCE(gender, '-') USING utf8mb4) COLLATE utf8mb4_general_ci) AS gender,
                MAX(CONVERT(sub_company_id USING utf8mb4) COLLATE utf8mb4_general_ci) AS sub_company_id,
                MAX(CONVERT(sub_company_name USING utf8mb4) COLLATE utf8mb4_general_ci) AS sub_company_name,
                MAX(CONVERT(CAST(cost_center_id AS CHAR) USING utf8mb4) COLLATE utf8mb4_general_ci) AS dept_code,
                MAX(CONVERT(CAST(org_cc_id AS CHAR) USING utf8mb4) COLLATE utf8mb4_general_ci) AS dept_id,
                MAX(CONVERT(cc_name USING utf8mb4) COLLATE utf8mb4_general_ci) AS cc_name,
                MAX(CONVERT(COALESCE(type_worker, 'OS') USING utf8mb4) COLLATE utf8mb4_general_ci) AS emp_type,
                MAX(COALESCE(use_cc, 0)) AS use_cc
            FROM vw_master_os_active
            WHERE employee_code IS NOT NULL AND employee_code != ''
            GROUP BY employee_code
        ),
        RawBacData AS (
            SELECT 
                m.master_card_id AS card_id,
                b.employee_id,
                b.clock_date,
                b.id,
                b.bac_no,
                b.bac_ket,
                b.clock_in,
                b.clock_out,
                b.evidence_photo,
                b.created_by,
                b.created_date
            FROM bac_os b
            LEFT JOIN MasterEmp m ON m.emp_code = CONVERT(b.employee_id USING utf8mb4) COLLATE utf8mb4_general_ci
            WHERE b.status = 1
            
            UNION ALL
            
            SELECT 
                m.master_card_id AS card_id,
                t.nrp AS employee_id,
                DATE(t.submit_at) AS clock_date,
                t.id,
                'BAC' AS bac_no,
                'BAC (kiosk/backdate)' AS bac_ket,
                CASE WHEN t.direction = 0 THEN t.submit_at ELSE NULL END AS clock_in,
                CASE WHEN t.direction = 1 THEN t.submit_at ELSE NULL END AS clock_out,
                NULL AS evidence_photo,
                'system' AS created_by,
                t.submit_at AS created_date
            FROM `db-webapps`.transaksi_absen t
            LEFT JOIN MasterEmp m ON m.emp_code = CONVERT(t.nrp USING utf8mb4) COLLATE utf8mb4_general_ci
            WHERE t.status IN (2, 7)
        ),
        BacAgg AS (
            SELECT 
                CONVERT(card_id USING utf8mb4) COLLATE utf8mb4_general_ci AS card_id,
                clock_date,
                MAX(employee_id) AS employee_id,
                MAX(id) AS id,
                MAX(bac_no) AS bac_no,
                MAX(bac_ket) AS bac_ket,
                MAX(clock_in) AS clock_in,
                MAX(clock_out) AS clock_out,
                MAX(evidence_photo) AS evidence_photo,
                MAX(created_by) AS created_by,
                MAX(created_date) AS created_date
            FROM RawBacData
            GROUP BY card_id, clock_date
        ),
        UnifiedAttendance AS (
            SELECT 
                CONVERT(card_id USING utf8mb4) COLLATE utf8mb4_general_ci AS card_id,
                clocking_date,
                clock_in,
                clock_out,
                flag
            FROM `db-webapps`.TBL_ATTENDANCE
            WHERE card_id != '00000.00000' AND card_id IS NOT NULL AND card_id != ''
            
            UNION ALL
            
            SELECT 
                b.card_id,
                b.clock_date AS clocking_date,
                NULL AS clock_in,
                NULL AS clock_out,
                0 AS flag
            FROM BacAgg b
            WHERE NOT EXISTS (
                SELECT 1 FROM `db-webapps`.TBL_ATTENDANCE a 
                WHERE a.card_id = b.card_id AND a.clocking_date = b.clock_date
            )
        ),
        AttendanceAgg AS (
            SELECT 
                card_id,
                clocking_date,
                clock_in,
                clock_out,
                flag
            FROM UnifiedAttendance
        )
        SELECT DISTINCT 
            m.emp_code AS employee_id,
            m.emp_code AS employee_code,
            m.emp_name AS employee_name,
            m.gender AS gender,
            COALESCE(m.sub_company_name, '-') AS subCom,
            
            COALESCE(NULLIF(ta.card_id, ''), NULLIF(m.master_card_id, ''), '-') AS card,
            
            CASE 
                WHEN m.use_cc = 1 THEN COALESCE(m.cc_name, '-')
                ELSE COALESCE(occ.org_name, tm_in.cost_center, tm_out.cost_center, m.cc_name, '-')
            END AS cc,
            
            m.emp_type AS type,

            DATE_FORMAT(ta.clock_in, '%Y-%m-%d %H:%i:%s') AS raw_ta_in,
            DATE_FORMAT(ta.clock_out, '%Y-%m-%d %H:%i:%s') AS raw_ta_out,
            
            DATE_FORMAT(ta.clocking_date, '%d %b %Y') AS v_clocking_date,
            DATE_FORMAT(ta.clocking_date, '%Y-%m-%d') AS clocking_date,
            
            IF(b.clock_in IS NOT NULL, DATE_FORMAT(b.clock_in, '%H:%i'), IF(ta.clock_in IS NOT NULL, DATE_FORMAT(ta.clock_in, '%H:%i'), 'KOSONG')) AS clock_in,
            IF(b.clock_out IS NOT NULL, DATE_FORMAT(b.clock_out, '%H:%i'), IF(ta.clock_out IS NOT NULL, DATE_FORMAT(ta.clock_out, '%H:%i'), 'KOSONG')) AS clock_out,
            
            COALESCE(DATE_FORMAT(b.clock_in, '%Y-%m-%d %H:%i:%s'), DATE_FORMAT(ta.clock_in, '%Y-%m-%d %H:%i:%s'), 'null') AS full_clock_in,
            COALESCE(DATE_FORMAT(b.clock_out, '%Y-%m-%d %H:%i:%s'), DATE_FORMAT(ta.clock_out, '%Y-%m-%d %H:%i:%s'), 'null') AS full_clock_out,
            
            COALESCE(b.id, NULL) AS bac_id,
            COALESCE(b.bac_no, '-') AS bac_no,
            COALESCE(b.bac_ket, '-') AS bac_ket,
            DATE_FORMAT(b.clock_in, '%Y-%m-%dT%H:%i') AS bac_clock_in,
            DATE_FORMAT(b.clock_out, '%Y-%m-%dT%H:%i') AS bac_clock_out,
            COALESCE(b.evidence_photo, '') AS bac_evidence,
            COALESCE(b.evidence_photo, '') AS evidence_photo,
            COALESCE(b.created_by, '-') AS bac_updated_by,
            IF(b.created_date IS NOT NULL, DATE_FORMAT(b.created_date, '%d %b %Y'), '-') AS bac_updated_date,
            
            CASE 
                WHEN b.clock_in IS NOT NULL OR b.clock_out IS NOT NULL THEN 'BAC Found'
                WHEN ta.flag = 1 THEN 'Tidak Lengkap'
                WHEN ta.clock_in IS NOT NULL AND ta.clock_out IS NOT NULL THEN 'Lengkap'
                ELSE 'Tidak Lengkap'
            END AS status
        FROM MasterEmp m
        INNER JOIN AttendanceAgg ta 
            ON m.master_card_id = ta.card_id
        LEFT JOIN attendance_exclusions ex 
            ON ex.employee_id = m.emp_code
            AND ex.clocking_date = ta.clocking_date
            AND (ex.clock_in <=> ta.clock_in)
            AND (ex.clock_out <=> ta.clock_out)
            AND ex.status = 1
        LEFT JOIN BacAgg b 
            ON b.card_id = ta.card_id
            AND b.clock_date = ta.clocking_date
        LEFT JOIN `db-webapps`.TBL_TACTIVITIES tt_in 
            ON ta.card_id = tt_in.CARD_ID AND ta.clock_in = tt_in.CLOCKING_DATE
        LEFT JOIN terminal_master tm_in 
            ON tm_in.node_id = tt_in.TERMINAL_ID AND tm_in.company_id = '1111' AND tm_in.terminal_type = 'Attendance'
        LEFT JOIN `db-webapps`.TBL_TACTIVITIES tt_out 
            ON ta.card_id = tt_out.CARD_ID AND ta.clock_out = tt_out.CLOCKING_DATE
        LEFT JOIN terminal_master tm_out 
            ON tm_out.node_id = tt_out.TERMINAL_ID AND tm_out.company_id = '1111' AND tm_out.terminal_type = 'Attendance'
        LEFT JOIN org_cost_center occ 
            ON occ.id = COALESCE(tm_in.org_cc_id, tm_out.org_cc_id) 
            OR (tm_in.org_cc_id IS NULL AND tm_out.org_cc_id IS NULL AND occ.cost_center = CAST(COALESCE(tm_in.cost_center, tm_out.cost_center) AS CHAR))
        WHERE {where_sql}
        ORDER BY clocking_date DESC, employee_code ASC
    """

    return sql_query, params



# =============================================================================
# 1. GET LIST ABSENSI
# =============================================================================
@AbsenOs_bp.route('/absensi', methods=['GET'])
def get_absensi():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 20, type=int)
        
        start_date = request.args.get('start_date', '', type=str).strip()
        end_date = request.args.get('end_date', '', type=str).strip()
        status_filter = request.args.get('status_filter', 'all_data', type=str).strip()
        shift_filter = request.args.get('shift', '', type=str).strip().upper()
        search = request.args.get('search', '', type=str).strip()
        sub_company_id = request.args.get('sub_company', '', type=str).strip()
        department_id = request.args.get('department', '', type=str).strip()
        worker_type = request.args.get('worker_type', 'all', type=str).strip()

        sql_query, params = _build_absensi_raw_sql(
            start_date=start_date, end_date=end_date, status_filter=status_filter,
            shift_filter=shift_filter, search=search, sub_company_id=sub_company_id,
            department_id=department_id, worker_type=worker_type
        )
        with db.engine.connect() as conn:
            all_rows = conn.execute(text(sql_query), params).mappings().fetchall()

        total_item = len(all_rows)
        start_idx = (page - 1) * pageSize
        end_idx = start_idx + pageSize
        paged_rows = [dict(r) for r in all_rows[start_idx:end_idx]]
        for r in paged_rows:
            eff_in = r.get('bac_clock_in') or r.get('full_clock_in') or r.get('clock_in')
            r['shift'] = determine_shift(eff_in, r.get('clocking_date'))
        return jsonify({
            "status": "success",
            "data": paged_rows,
            "total_page": (total_item + pageSize - 1) // pageSize if total_item > 0 else 1,
            "current_page": page,
            "total_item": total_item
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# =============================================================================
# 2. GET DETAIL BAC TUNGGAL (PERBAIKAN ROUTING)
# =============================================================================
@AbsenOs_bp.route('/absensi/bac//', methods=['GET'])
def get_bac(employee_id, clock_date):
    try:
        extra_info = BAC_os.query.filter_by(employee_id=employee_id, clock_date=clock_date).first()

        if not extra_info:
            return jsonify({"clock_in": "", "clock_out": "", "bac_no": "", "bac_ket": "", "evidence_photo": ""}), 200
        
        return jsonify({
            "clock_in": format_dt(extra_info.clock_in, iso=True),
            "clock_out": format_dt(extra_info.clock_out, iso=True),
            "bac_no": extra_info.bac_no or "",
            "bac_ket": extra_info.bac_ket or "",
            "evidence_photo": extra_info.evidence_photo or ""
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# =============================================================================
# 3. SAVE / UPDATE BAC TUNGGAL
# =============================================================================
@AbsenOs_bp.route('/absensi/bac', methods=['PUT', 'POST'])
def update_bac():
    try:
        data = request.form if request.form else (request.json or {})
        emp_id = str(data.get('employee_id') or '').strip()
        clock_date = data.get('clock_date')  

        if not emp_id or not clock_date:
            return jsonify({"status": "error", "message": "employee_id dan clock_date wajib diisi."}), 400
        
        evidence_path = None
        if 'evidence_photo' in request.files:
            file_storage = request.files['evidence_photo']
            if file_storage and file_storage.filename != '':
                upload_ts = datetime.now().strftime('%Y%m%d_%H%M%S')
                base_name = f"BAC_{emp_id}_{clock_date}_{upload_ts}"
                evidence_path = process_and_save_bac_evidence(
                    file_storage=file_storage, target_folder=BAC_EVIDENCE_FOLDER,
                    filename_without_ext=base_name, max_width=1000, quality=80
                )
        _, is_created = upsert_bac_record(
            employee_id=emp_id, clock_date=clock_date,
            bac_no=clean_str(data.get('bac_no')), bac_ket=clean_str(data.get('bac_ket')),
            clock_in=parse_dt(data.get('clock_in')), clock_out=parse_dt(data.get('clock_out')),
            evidence_photo=evidence_path
        )
        db.session.commit()
        msg = "BAC Absensi berhasil ditambahkan!" if is_created else "BAC Absensi berhasil diupdate!"
        return jsonify({"status": "success", "message": msg}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# =============================================================================
# 4. EXPORT EXCEL ULTRA-FAST
# =============================================================================
@AbsenOs_bp.route('/absensi/export', methods=['GET'])
def export_absensi():
    try:
        start_date = request.args.get('start_date', '', type=str).strip()
        end_date = request.args.get('end_date', '', type=str).strip()
        status_filter = request.args.get('status_filter', 'all_data', type=str).strip()
        shift_filter = request.args.get('shift', '', type=str).strip().upper()
        search = request.args.get('search', '', type=str).strip()
        sub_company_id = request.args.get('sub_company', '', type=str).strip()
        department_id = request.args.get('department', '', type=str).strip()
        worker_type = request.args.get('worker_type', 'all', type=str).strip()
        
        sql_query, params = _build_absensi_raw_sql(
            start_date=start_date, end_date=end_date, status_filter=status_filter,
            shift_filter=shift_filter, search=search, sub_company_id=sub_company_id,
            department_id=department_id, worker_type=worker_type
        )
        with db.engine.connect() as conn:
            rows = conn.execute(text(sql_query), params).mappings().fetchall()
        
        if not rows:
            return jsonify({"status": "error", "message": "Tidak ada data absensi yang sesuai untuk diekspor."}), 404
        
        df = pd.DataFrame([dict(r) for r in rows])
        df['Shift'] = df.apply(lambda r: determine_shift(r['bac_clock_in'] or r['full_clock_in'] or r['clock_in'], r['clocking_date']), axis=1)
        df.rename(columns={
            'employee_code': 'Employee ID',
            'employee_name': 'Nama Karyawan',
            'gender': 'Gender',
            'subCom': 'Sub Company',
            'card': 'Absence Card',
            'cc': 'Cost Center',
            'type': 'Type',
            'v_clocking_date': 'Clocking Date',
            'clock_in': 'Clocking In',
            'clock_out': 'Clocking Out',
            'status': 'Status',
            'bac_ket': 'Ket BAC',
            'bac_updated_by': 'Updated By',
            'bac_updated_date': 'Updated Date'
        }, inplace=True)
        selected_cols = [
            'Employee ID', 'Nama Karyawan', 'Gender', 'Sub Company', 'Absence Card',
            'Cost Center', 'Type', 'Shift', 'Clocking Date', 'Clocking In',
            'Clocking Out', 'Status', 'Ket BAC', 'Updated By', 'Updated Date'
        ]
        df = df[selected_cols]

        def _format_date_label(dt_str):
            if not dt_str:
                return "-"
            try:
                return datetime.strptime(dt_str, '%Y-%m-%d').strftime('%d-%b-%Y').upper()
            except Exception:
                return dt_str
        
        start_label = _format_date_label(start_date)
        end_label = _format_date_label(end_date)
        if worker_type == 'os':
            worker_label = "YAYASAN"
        elif worker_type == 'tetap':
            worker_label = "TETAP / KONTRAK"
        else:
            worker_label = "SEMUA KARYAWAN"
            
        header_title = f"DATA ABSENSI KARYAWAN {worker_label} Periode Tanggal: {start_label} Sampai: {end_label}"
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Absensi_Karyawan', startrow=1)            
            ws = writer.sheets['Absensi_Karyawan']
            ws['A1'] = header_title
            ws['A1'].font = Font(name='Calibri', size=11, bold=True)
        output.seek(0)
        filename = f"Export_Absensi_{worker_type.upper()}_{start_date}_to_{end_date}.xlsx" if start_date and end_date else f"Export_Absensi_{worker_type.upper()}.xlsx"
        return send_file(
            output,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# =============================================================================
# 5. SOFT DELETE / EXCLUDE ABSENSI (EXCLUSION LOG POLICY)
# =============================================================================
@AbsenOs_bp.route('/absensi/delete', methods=['POST', 'DELETE'])
def delete_absensi():
    try:
        data = request.get_json() or request.form or {}
        emp_id = str(data.get('employee_id') or '').strip()
        clock_date = str(data.get('clock_date') or '').strip()
        reason = clean_str(data.get('reason'))
        deleted_by = clean_str(data.get('deleted_by') or request.headers.get('X-User-Email') or 'Admin')
        raw_in = str(data.get('clock_in') or '').strip()
        raw_out = str(data.get('clock_out') or '').strip()        
        c_in = raw_in if raw_in not in ('', 'null', 'None', 'undefined') else None
        c_out = raw_out if raw_out not in ('', 'null', 'None', 'undefined') else None

        if not emp_id or not clock_date:
            return jsonify({"status": "error", "message": "employee_id dan clock_date wajib diisi."}), 400
            
        sql_upsert = text("""
            INSERT INTO attendance_exclusions 
                (employee_id, clocking_date, clock_in, clock_out, reason, deleted_by, deleted_at, status)
            VALUES 
                (:employee_id, :clock_date, :clock_in, :clock_out, :reason, :deleted_by, NOW(), 1)
            ON DUPLICATE KEY UPDATE 
                reason = VALUES(reason),
                deleted_by = VALUES(deleted_by),
                deleted_at = NOW(),
                status = 1
        """)
        
        with db.engine.connect() as conn:
            conn.execute(sql_upsert, {
                'employee_id': emp_id,
                'clock_date': clock_date,
                'clock_in': c_in,
                'clock_out': c_out,
                'reason': reason,
                'deleted_by': deleted_by
            })
            conn.commit()
            
        return jsonify({
            "status": "success",
            "message": f"Data absensi karyawan {emp_id} berhasil dihapus dari laporan."
        }), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

# =============================================================================
# 6. GENERATE EXCEL TEMPLATE UNTUK MASS UPDATE (DIPERBAIKI)
# =============================================================================
@AbsenOs_bp.route('/absensi/template', methods=['GET'])
def template():
    try:
        start_date_raw = request.args.get('start_date', '', type=str)
        end_date_raw = request.args.get('end_date', '', type=str)
        search = request.args.get('search', '', type=str).strip()
        sub_company_id = request.args.get('sub_company', '', type=str).strip()
        department_id = request.args.get('department', '', type=str).strip()
        shift_filter = request.args.get('shift', '', type=str).strip().upper()
        user_email = request.headers.get('X-User-Email', '')

        if not start_date_raw or not end_date_raw:
            return jsonify({"status": "error", "message": "Parameter start_date dan end_date wajib diisi."}), 400

        sql_query, params = _build_absensi_raw_sql(
            start_date=start_date_raw,
            end_date=end_date_raw,
            status_filter='template_revisi', 
            shift_filter=shift_filter,
            search=search,
            sub_company_id=sub_company_id,
            department_id=department_id,
            worker_type='os'
        )
        
        with db.engine.connect() as conn:
            query_results = conn.execute(text(sql_query), params).mappings().fetchall()
            
        enriched_results = [r for r in query_results if not r.get('bac_id')]

        if not enriched_results:
            return jsonify({"status": "error", "message": "Tidak ditemukan data absensi tidak lengkap pada filter ini."}), 404

        dynamic_data = []
        for d in enriched_results:
            emp_name = d.get('employee_name')
            if not emp_name or str(emp_name).strip() in ('', '-', 'None', 'null'):
                emp_name = '-'

            effective_in = d.get('full_clock_in') or d.get('clock_in')            
            c_date = d.get('clocking_date') 
            row_shift = determine_shift(effective_in, c_date)
            val_in = d.get('clock_in')
            val_out = d.get('clock_out')            
            excel_in = "" if (val_in == 'KOSONG') else val_in
            excel_out = "" if (val_out == 'KOSONG') else val_out

            dynamic_data.append({
                "Employee ID": str(d.get('employee_id')),
                "Nama Karyawan": emp_name,
                "Sub Company": d.get('subCom') or '-',
                "Cost Center": d.get('cc') or '-',
                "Shift": row_shift,
                "Tanggal Absen": c_date,
                "Clocking In": excel_in,
                "Clocking Out": excel_out,
                "No BAC": "",
                "Keterangan BAC": ""
            })

        df = pd.DataFrame(dynamic_data)
        num_rows = len(df) + 1

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Template_Import_Revisi')
            worksheet = writer.sheets['Template_Import_Revisi']

            list_pilihan = '"Kartu Ketinggalan,Kartu Belum Diterima,Kartu Error,Karyawan Lupa Clocking,Dipulangkan"'
            dv = DataValidation(type="list", formula1=list_pilihan, allow_blank=True)
            dv.error = 'Mohon pilih keterangan yang tersedia pada list dropdown.'
            dv.errorTitle = 'Pilihan Tidak Valid'

            worksheet.add_data_validation(dv)
            dv.add(f"J2:J{num_rows + 100}") 

        output.seek(0)
        shift_tag = f"_{shift_filter}" if shift_filter else ""
        return send_file(
            output,
            as_attachment=True,
            download_name=f"Template_Mass_Update_Absen{shift_tag}_{start_date_raw}_to_{end_date_raw}.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

# =============================================================================
# 7. UPLOAD EXCEL MASS UPDATE
# =============================================================================
@AbsenOs_bp.route('/absensi/upload', methods=['POST'])
def upload():
    file = request.files.get('file')
    if not file:
        return jsonify({'message': 'Mohon pilih file Excel terlebih dahulu.'}), 400

    try:
        df = pd.read_excel(file, dtype={
            'Employee ID': str, 
            'Tanggal Absen': str,
            'Clocking In': str, 
            'Clocking Out': str, 
            'No BAC': str,
            'Shift': str
        })

        errors = []
        success_count = 0

        for index, row in df.iterrows():
            line_number = index + 2
            emp_id_raw = clean_str(row.get('Employee ID'))
            
            try:
                with db.session.begin_nested():
                    clock_date_raw = clean_str(row.get('Tanggal Absen'))

                    if not emp_id_raw or not clock_date_raw:
                        raise ValueError("Kolom 'Employee ID' dan 'Tanggal Absen' tidak boleh kosong.")

                    c_in_raw = clean_str(row.get('Clocking In'))
                    c_out_raw = clean_str(row.get('Clocking Out'))
                    ket_bac = clean_str(row.get('Keterangan BAC'))
                    shift_val = clean_str(row.get('Shift')) or ''

                    # 1. CEK BARIS KOSONG: Jika tidak ada jam in, jam out, dan ket_bac kosong, lewati baris ini.
                    if not c_in_raw and not c_out_raw and not ket_bac:
                        continue

                    # 2. KETERANGAN BAC WAJIB DARI DROPDOWN
                    if not ket_bac:
                        raise ValueError("Kolom 'Keterangan BAC' wajib diisi.")

                    # 3. PARSING JAM IN (jika ada)
                    final_c_in = None
                    if c_in_raw:
                        combined_in = f"{clock_date_raw[:10]} {c_in_raw}"
                        final_c_in = parse_dt(combined_in)
                        if not final_c_in:
                            raise ValueError(f"Format Clocking In ({c_in_raw}) tidak valid. Gunakan format HH:MM.")

                    # 4. PARSING JAM OUT DENGAN LOGIKA SHIFT 3 (LINTAS HARI)
                    final_c_out = None
                    if c_out_raw:
                        combined_out = f"{clock_date_raw[:10]} {c_out_raw}"
                        final_c_out = parse_dt(combined_out)
                        if not final_c_out:
                            raise ValueError(f"Format Clocking Out ({c_out_raw}) tidak valid. Gunakan format HH:MM.")

                        # --- LOGIKA LINTAS HARI SHIFT 3 ---
                        if final_c_in and final_c_out < final_c_in:
                            final_c_out += timedelta(days=1)
                        elif not final_c_in and 'SHIFT 3' in shift_val.upper():
                            if final_c_out.hour <= 15:
                                final_c_out += timedelta(days=1)

                    # 5. SIMPAN/UPDATE KE TABEL BAC
                    upsert_bac_record(
                        employee_id=emp_id_raw,
                        clock_date=clock_date_raw[:10],
                        bac_no=clean_str(row.get('No BAC')),
                        bac_ket=ket_bac,
                        clock_in=final_c_in,
                        clock_out=final_c_out
                    )

                success_count += 1

            except ValueError as ve:
                errors.append(f"Baris {line_number} (ID {emp_id_raw or '-'}): {str(ve)}")
            except Exception as e:
                errors.append(f"Baris {line_number} (ID {emp_id_raw or '-'}): Gagal memproses - {str(e)}")

        db.session.commit()

        if success_count > 0:
            status = "success" if not errors else "partial_success"
            msg = f"Berhasil memproses {success_count} baris data absensi."
            return jsonify({"status": status, "message": msg, "errors": errors}), 200
        else:
            return jsonify({
                "status": "error",
                "message": "Tidak ada data yang diproses. Periksa kembali file Excel Anda.",
                "errors": errors
            }), 400

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": f"Terjadi kesalahan sistem: {str(e)}"}), 500