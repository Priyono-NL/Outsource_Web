import os
from io import BytesIO
from datetime import datetime
import pandas as pd
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import text
from PIL import Image, ImageOps

from extensions import db
from model.bac_os import BAC_os

AbsenOs_bp = Blueprint('AbsenOs_bp', __name__)

BAC_EVIDENCE_FOLDER = 'static/uploads/bac_evidence'
if not os.path.exists(BAC_EVIDENCE_FOLDER):
    os.makedirs(BAC_EVIDENCE_FOLDER)

# =============================================================================
# GARANSI PENUTUPAN KONEKSI DATABASE GLOBAL (ZERO-ZOMBIE POLICY)
# =============================================================================
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
# CORE SQL QUERY BUILDER (OPTIMIZED WITH DEPT RESOLUTION & SHIFT FILTERING)
# =============================================================================
def _build_absensi_raw_sql(start_date, end_date, status_filter='all_data', shift_filter='', search='', sub_company_id='', department_id='', worker_type='all'):
    where_clauses = ["1=1"]
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
    elif status_filter == 'anomali':
        where_clauses.append("ta.flag = 1")
    elif status_filter in ('violation_all', 'tidak_lengkap'):
        where_clauses.append("(COALESCE(b.clock_in, ta.clock_in) IS NULL OR COALESCE(b.clock_out, ta.clock_out) IS NULL)")

    # FILTER SHIFT KERJA
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
        where_clauses.append("(m.emp_code LIKE :search OR m.emp_name LIKE :search OR ta.card_id LIKE :search OR b.bac_no LIKE :search)")
        params['search'] = f"%{search}%"

    if sub_company_id:
        if sub_company_id == 'TYPE_OS': where_clauses.append("m.emp_type = 'OS'")
        elif sub_company_id == 'TYPE_VENDOR': where_clauses.append("m.emp_type = 'Vendor'")
        else:
            where_clauses.append("m.sub_company_id = :sub_company_id")
            params['sub_company_id'] = sub_company_id

    # MULTI-LAYER DEPARTMENT RESOLUTION (FIX GHOST MISSING TETAP/KONTRAK)
    if department_id:
        sql_cc = text("SELECT id, cost_center, org_name FROM org_cost_center WHERE id = :dept_id OR cost_center = :dept_id OR org_name = :dept_id")
        with db.engine.connect() as conn:
            cc_res = conn.execute(sql_cc, {'dept_id': department_id}).fetchone()

        if cc_res:
            dept_cc_id = str(cc_res[0]).strip()     # Misal '12' (org_cc_id)
            dept_cc_code = str(cc_res[1]).strip()   # Misal '10200' (cost_center code)
            dept_cc_name = str(cc_res[2]).strip() if cc_res[2] else '' # Misal 'ACCOUNTING DEPARTMENT'

            where_clauses.append("""(
                m.dept_id = :dept_cc_id 
                OR m.dept_code = :dept_cc_code 
                OR m.dept_id = :dept_cc_code 
                OR m.cc_name = :dept_cc_name 
                OR m.dept_code = :dept_cc_id
            )""")
            params.update({
                'dept_cc_id': dept_cc_id,
                'dept_cc_code': dept_cc_code,
                'dept_cc_name': dept_cc_name
            })
        else:
            where_clauses.append("(m.dept_id = :dept_id OR m.dept_code = :dept_id OR m.cc_name = :dept_id)")
            params['dept_id'] = department_id

    where_sql = " AND ".join(where_clauses)

    sql_query = f"""
        WITH MasterEmp AS (
            -- 1. Master Karyawan Tetap (vw_master_karyawan)
            SELECT 
                CONVERT(employee_id USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_code,
                CONVERT(employee_name USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_name,
                '-' AS gender,
                'sub00003' AS sub_company_id,
                'CRS' AS sub_company_name,
                CONVERT(CAST(cost_center AS CHAR) USING utf8mb4) COLLATE utf8mb4_general_ci AS dept_code,
                CONVERT(CAST(cost_center AS CHAR) USING utf8mb4) COLLATE utf8mb4_general_ci AS dept_id,
                CONVERT(dept_name USING utf8mb4) COLLATE utf8mb4_general_ci AS cc_name,
                'TETAP/KONTRAK' AS emp_type
            FROM vw_master_karyawan
            WHERE employee_id IS NOT NULL AND employee_id != ''
            
            UNION ALL
            
            -- 2. Master Karyawan Outsource (vw_master_os_active)
            SELECT 
                CONVERT(employee_code USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_code,
                CONVERT(employee_name USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_name,
                CONVERT(COALESCE(gender, '-') USING utf8mb4) COLLATE utf8mb4_general_ci AS gender,
                CONVERT(sub_company_id USING utf8mb4) COLLATE utf8mb4_general_ci AS sub_company_id,
                CONVERT(sub_company_name USING utf8mb4) COLLATE utf8mb4_general_ci AS sub_company_name,
                CONVERT(CAST(cost_center_id AS CHAR) USING utf8mb4) COLLATE utf8mb4_general_ci AS dept_code,
                CONVERT(CAST(org_cc_id AS CHAR) USING utf8mb4) COLLATE utf8mb4_general_ci AS dept_id,
                CONVERT(cc_name USING utf8mb4) COLLATE utf8mb4_general_ci AS cc_name,
                CONVERT(COALESCE(type_worker, 'OS') USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_type
            FROM vw_master_os_active
            WHERE employee_code IS NOT NULL AND employee_code != ''
        ),
        UnifiedAttendance AS (
            SELECT 
                CONVERT(employee_id USING utf8mb4) COLLATE utf8mb4_general_ci AS employee_id,
                CONVERT(card_id USING utf8mb4) COLLATE utf8mb4_general_ci AS card_id,
                clocking_date,
                clock_in,
                clock_out,
                flag
            FROM `db-webapps`.TBL_ATTENDANCE
            WHERE card_id != '00000.00000'
            
            UNION ALL
            
            SELECT 
                CONVERT(employee_id USING utf8mb4) COLLATE utf8mb4_general_ci AS employee_id,
                '' AS card_id,
                clock_date AS clocking_date,
                NULL AS clock_in,
                NULL AS clock_out,
                0 AS flag
            FROM bac_os
            WHERE status = 1
        ),
        AttendanceAgg AS (
            SELECT 
                employee_id,
                MAX(card_id) AS card_id,
                clocking_date,
                MAX(clock_in) AS clock_in,
                MAX(clock_out) AS clock_out,
                MAX(flag) AS flag
            FROM UnifiedAttendance
            GROUP BY employee_id, clocking_date
        )
        SELECT 
            m.emp_code AS employee_id,
            m.emp_code AS employee_code,
            m.emp_name AS employee_name,
            m.gender AS gender,
            COALESCE(m.sub_company_name, '-') AS subCom,
            COALESCE(ta.card_id, '-') AS card,
            COALESCE(m.cc_name, '-') AS cc,
            m.emp_type AS type,
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
            ON m.emp_code = ta.employee_id
        LEFT JOIN bac_os b 
            ON CAST(b.employee_id AS CHAR) = ta.employee_id
           AND b.clock_date = ta.clocking_date 
           AND b.status = 1
        WHERE {where_sql}
        ORDER BY ta.clocking_date DESC, m.emp_code ASC
    """
    return sql_query, params

# =============================================================================
# 1. GET LIST ABSENSI (FAST API - SLA < 1 DETIK)
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
# 2. GET DETAIL BAC TUNGGAL
# =============================================================================
@AbsenOs_bp.route('/absensi/bac/<int:employee_id>/<string:clock_date>', methods=['GET'])
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
# 4. EXPORT EXCEL ULTRA-FAST (SLA < 1 DETIK)
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
            'clocking_date': 'Clocking Date',
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

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Absensi_Karyawan')
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