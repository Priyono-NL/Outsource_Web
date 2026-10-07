import os
from io import BytesIO
from datetime import datetime, timedelta
import pandas as pd
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import text
from PIL import Image, ImageOps
from openpyxl.styles import Font
from openpyxl.worksheet.datavalidation import DataValidation
import numpy as np

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
def get_absensi_hybrid_data(start_date, end_date, status_filter='all_data', shift_filter='', search='', sub_company_id='', department_id='', worker_type='all'):
    
    # =========================================================================
    # PERSIAPAN PANDAS FILTER DEPARTMENT (Ambil Alias Cost Center)
    # =========================================================================
    target_dept_aliases = []
    if department_id:
        sql_cc = text("SELECT id, cost_center, org_name FROM org_cost_center WHERE id = :dept_id OR cost_center = :dept_id OR org_name = :dept_id")
        with db.engine.connect() as conn:
            cc_res = conn.execute(sql_cc, {'dept_id': department_id}).fetchone()
        if cc_res:
            target_dept_aliases = [str(cc_res[0]), str(cc_res[1]), str(cc_res[2])]
        else:
            target_dept_aliases = [str(department_id)]

    # =========================================================================
    # TAHAP 1: PRE-SELECTION (MASTER DATA KARYAWAN) - SPLIT QUERY & PANDAS CONCAT
    # =========================================================================
    master_params = {}
    where_tetap = ["employee_id IS NOT NULL", "employee_id != ''"]
    where_os = ["employee_code IS NOT NULL", "employee_code != ''"]
    
    if search:
        search_param = f"%{search}%"
        master_params['search'] = search_param
        where_tetap.append("(employee_id LIKE :search OR employee_name LIKE :search OR card_no LIKE :search)")
        where_os.append("(employee_code LIKE :search OR employee_name LIKE :search OR card_number LIKE :search)")
        
    if worker_type == 'os':
        where_tetap.append("1=0") 
        where_os.append("CHAR_LENGTH(CAST(employee_code AS CHAR)) < 8")
    elif worker_type == 'tetap':
        where_tetap.append("CHAR_LENGTH(CAST(employee_id AS CHAR)) >= 8")
        where_os.append("1=0") 

    if sub_company_id:
        if sub_company_id == 'TYPE_OS': 
            where_tetap.append("1=0")
            where_os.append("COALESCE(type_worker, 'OS') = 'OS'")
        elif sub_company_id == 'TYPE_VENDOR': 
            where_tetap.append("1=0")
            where_os.append("COALESCE(type_worker, 'OS') = 'Vendor'")
        else:
            where_tetap.append("('sub00003' = :sub_company_id OR 'CRS' = :sub_company_id)")
            where_os.append("(sub_company_id = :sub_company_id OR sub_company_name = :sub_company_id)")
            master_params['sub_company_id'] = sub_company_id

    sql_tetap = text(f"""
        SELECT 
            employee_id AS emp_code, employee_name AS emp_name, card_no AS master_card_id,
            '-' AS gender, 'sub00003' AS sub_company_id, 'CRS' AS sub_company_name,
            CAST(cost_center AS CHAR) AS dept_code, dept_name AS cc_name, 
            'TETAP/KONTRAK' AS emp_type, 1 AS use_cc
        FROM vw_master_karyawan
        WHERE {" AND ".join(where_tetap)}
    """)

    sql_os = text(f"""
        SELECT 
            employee_code AS emp_code, employee_name AS emp_name, card_number AS master_card_id,
            COALESCE(gender, '-') AS gender, sub_company_id, sub_company_name,
            CAST(cost_center_id AS CHAR) AS dept_code, cc_name, 
            COALESCE(type_worker, 'OS') AS emp_type, COALESCE(use_cc, 0) AS use_cc
        FROM vw_master_os_active
        WHERE {" AND ".join(where_os)}
    """)

    with db.engine.connect() as conn:
        rows_tetap = conn.execute(sql_tetap, master_params).mappings().fetchall()
        rows_os = conn.execute(sql_os, master_params).mappings().fetchall()
        
    df_tetap = pd.DataFrame([dict(r) for r in rows_tetap])
    df_os = pd.DataFrame([dict(r) for r in rows_os])
    df_master = pd.concat([df_tetap, df_os], ignore_index=True)

    if df_master.empty:
        return [] 
        
    df_master = df_master.drop_duplicates(subset=['emp_code'], keep='first')
    df_master['master_card_id'] = df_master['master_card_id'].astype(str).str.strip()
    df_master['emp_code'] = df_master['emp_code'].astype(str).str.strip()
    
    card_ids = tuple(df_master['master_card_id'].dropna().unique().tolist())
    emp_ids = tuple(df_master['emp_code'].dropna().unique().tolist())
    
    if not card_ids: card_ids = ('-1',)
    if not emp_ids: emp_ids = ('-1',)

    # =========================================================================
    # TAHAP 2: FETCH TRANSAKSI ABSEN (DITAMBAHKAN JOIN TERMINAL UNTUK USE_CC 0)
    # =========================================================================
    att_sql = text("""
        SELECT 
            ta.card_id, DATE(ta.clocking_date) AS clocking_date, 
            ta.clock_in AS ta_in, ta.clock_out AS ta_out, ta.flag AS ta_flag, ex.id AS is_excluded,
            COALESCE(occ_in.org_name, occ_out.org_name) AS terminal_cc_name,
            COALESCE(occ_in.cost_center, occ_out.cost_center) AS terminal_cc_code,
            COALESCE(occ_in.id, occ_out.id) AS terminal_cc_id
        FROM `db-webapps`.TBL_ATTENDANCE ta
        LEFT JOIN attendance_exclusions ex 
            ON ex.clocking_date = ta.clocking_date AND (ex.clock_in <=> ta.clock_in) AND (ex.clock_out <=> ta.clock_out) AND ex.status = 1
        
        -- Mapping Terminal Clock IN
        LEFT JOIN `db-webapps`.TBL_TACTIVITIES tt_in 
            ON ta.card_id = tt_in.CARD_ID AND ta.clock_in = tt_in.CLOCKING_DATE
        LEFT JOIN terminal_master tm_in 
            ON tm_in.node_id = tt_in.TERMINAL_ID AND tm_in.company_id = '1111'
        LEFT JOIN org_cost_center occ_in 
            ON occ_in.id = tm_in.org_cc_id
            
        -- Mapping Terminal Clock OUT
        LEFT JOIN `db-webapps`.TBL_TACTIVITIES tt_out 
            ON ta.card_id = tt_out.CARD_ID AND ta.clock_out = tt_out.CLOCKING_DATE
        LEFT JOIN terminal_master tm_out 
            ON tm_out.node_id = tt_out.TERMINAL_ID AND tm_out.company_id = '1111'
        LEFT JOIN org_cost_center occ_out 
            ON occ_out.id = tm_out.org_cc_id
            
        WHERE ta.clocking_date >= :start_date AND ta.clocking_date <= :end_date
        AND ta.card_id IN :card_ids
    """)
    
    with db.engine.connect() as conn:
        att_rows = conn.execute(att_sql, {'start_date': start_date, 'end_date': end_date, 'card_ids': card_ids}).mappings().fetchall()
        
    df_att = pd.DataFrame([dict(r) for r in att_rows])
    if not df_att.empty:
        df_att = df_att[df_att['is_excluded'].isnull()].drop(columns=['is_excluded'])
        df_att['clocking_date'] = pd.to_datetime(df_att['clocking_date']).dt.strftime('%Y-%m-%d')
        card_to_emp = dict(zip(df_master['master_card_id'], df_master['emp_code']))
        df_att['emp_code'] = df_att['card_id'].map(card_to_emp)
        df_att = df_att.dropna(subset=['emp_code'])
        
        # Agregasi untuk mencegah Double-Tap di mesin
        df_att = df_att.groupby(['emp_code', 'clocking_date'], as_index=False).agg({
            'card_id': 'first',
            'ta_in': 'min',    
            'ta_out': 'max',   
            'ta_flag': 'max',
            'terminal_cc_name': 'first',
            'terminal_cc_code': 'first',
            'terminal_cc_id': 'first'
        })

    # =========================================================================
    # TAHAP 3: FETCH DATA BAC
    # =========================================================================
    bac_sql = text("""
        SELECT 
            employee_id AS emp_code, DATE(clock_date) AS clocking_date, id AS bac_id,
            bac_no, bac_ket, clock_in AS bac_in, clock_out AS bac_out, 
            evidence_photo, created_by AS bac_updated_by, created_date AS bac_updated_date
        FROM bac_os
        WHERE status = 1 AND clock_date >= :start_date AND clock_date <= :end_date AND employee_id IN :emp_ids
        
        UNION ALL
        
        SELECT 
            nrp AS emp_code, DATE(submit_at) AS clocking_date, id AS bac_id,
            'BAC' AS bac_no, 'BAC (kiosk/backdate)' AS bac_ket,
            CASE WHEN direction = 0 THEN submit_at ELSE NULL END AS bac_in,
            CASE WHEN direction = 1 THEN submit_at ELSE NULL END AS bac_out,
            NULL AS evidence_photo, 'system' AS bac_updated_by, submit_at AS bac_updated_date
        FROM `db-webapps`.transaksi_absen
        WHERE status IN (2, 7) AND submit_at >= :start_date AND submit_at <= :end_date_2359 AND nrp IN :emp_ids
    """)
    
    with db.engine.connect() as conn:
        bac_rows = conn.execute(bac_sql, {
            'start_date': start_date, 'end_date': end_date, 
            'end_date_2359': f"{end_date} 23:59:59", 'emp_ids': emp_ids
        }).mappings().fetchall()
        
    df_bac = pd.DataFrame([dict(r) for r in bac_rows])
    if not df_bac.empty:
        df_bac['clocking_date'] = pd.to_datetime(df_bac['clocking_date']).dt.strftime('%Y-%m-%d')
        df_bac = df_bac.groupby(['emp_code', 'clocking_date'], as_index=False).agg({
            'bac_id': 'max', 'bac_no': 'max', 'bac_ket': 'max',
            'bac_in': 'max', 'bac_out': 'max', 'evidence_photo': 'max',
            'bac_updated_by': 'max', 'bac_updated_date': 'max'
        })

    # =========================================================================
    # TAHAP 4: PANDAS MERGE (CPU LEVEL) & WRANGLING
    # =========================================================================
    if not df_att.empty and not df_bac.empty:
        df_trans = pd.merge(df_att, df_bac, on=['emp_code', 'clocking_date'], how='outer')
    elif not df_att.empty:
        df_trans = df_att.copy()
        for col in ['bac_id', 'bac_no', 'bac_ket', 'bac_in', 'bac_out', 'evidence_photo', 'bac_updated_by', 'bac_updated_date']: df_trans[col] = None
    elif not df_bac.empty:
        df_trans = df_bac.copy()
        for col in ['card_id', 'ta_in', 'ta_out', 'ta_flag', 'terminal_cc_name', 'terminal_cc_code', 'terminal_cc_id']: df_trans[col] = None
    else:
        return [] 
        
    df_final = pd.merge(df_master, df_trans, on='emp_code', how='inner')
    df_final = df_final.drop_duplicates(subset=['emp_code', 'clocking_date'], keep='first')
    df_final = df_final.astype(object).replace({np.nan: None, pd.NaT: None})
    
    raw_records = df_final.to_dict('records')
    formatted_data = []

    for r in raw_records:
        b_in, b_out = r.get('bac_in'), r.get('bac_out')
        t_in, t_out = r.get('ta_in'), r.get('ta_out')
        
        eff_in = b_in if pd.notnull(b_in) else (t_in if pd.notnull(t_in) else None)
        eff_out = b_out if pd.notnull(b_out) else (t_out if pd.notnull(t_out) else None)
        
        if pd.notnull(b_in) or pd.notnull(b_out): status = 'BAC Found'
        elif r.get('ta_flag') == 1: status = 'Tidak Lengkap'
        elif pd.notnull(t_in) and pd.notnull(t_out): status = 'Lengkap'
        else: status = 'Tidak Lengkap'
        
        if status_filter == 'lengkap' and status != 'Lengkap': continue
        if status_filter in ('anomali', 'template_revisi') and status != 'Tidak Lengkap': continue
        if status_filter == 'no_in' and pd.notnull(eff_in): continue
        if status_filter == 'no_out' and pd.notnull(eff_out): continue
        if status_filter == 'no_both' and (pd.isnull(eff_in) or pd.isnull(eff_out)): continue

        # ---------------------------------------------------------------------
        # LOGIKA COST CENTER (USE_CC = 1 vs USE_CC = 0)
        # ---------------------------------------------------------------------
        use_cc = r.get('use_cc', 0)
        master_cc_name = r.get('cc_name')
        term_cc_name = r.get('terminal_cc_name')
        master_cc_code = r.get('dept_code')
        term_cc_code = r.get('terminal_cc_code')
        term_cc_id = r.get('terminal_cc_id')

        if use_cc == 1:
            final_cc_name = master_cc_name
            match_vals = [str(master_cc_code), str(master_cc_name)]
        else:
            # Jika karyawan menggunakan mesin tanpa Cost Center (contoh mesin rusak), fallback ke Master
            final_cc_name = term_cc_name if pd.notnull(term_cc_name) else master_cc_name
            if pd.notnull(term_cc_id):
                match_vals = [str(term_cc_id), str(term_cc_code), str(term_cc_name)]
            else:
                match_vals = [str(master_cc_code), str(master_cc_name)]

        # Eksekusi Filter Department 
        if department_id:
            if not any(val in target_dept_aliases for val in match_vals if pd.notnull(val)):
                continue
        # ---------------------------------------------------------------------

        c_date_obj = datetime.strptime(r['clocking_date'], '%Y-%m-%d')
        
        # Mencegah NaN merusak respons JSON React
        bac_id_val = r.get('bac_id')
        safe_bac_id = None if pd.isna(bac_id_val) else bac_id_val

        fmt = {
            'employee_id': r['emp_code'],
            'employee_code': r['emp_code'],
            'employee_name': r['emp_name'],
            'gender': r['gender'],
            'subCom': r['sub_company_name'] if pd.notnull(r['sub_company_name']) else '-',
            'card': r.get('card_id') or r['master_card_id'] or '-',
            
            # Terapkan Final Cost Center
            'cc': final_cc_name if pd.notnull(final_cc_name) else '-',
            
            'type': r['emp_type'],
            'raw_ta_in': t_in.strftime('%Y-%m-%d %H:%M:%S') if pd.notnull(t_in) else None,
            'raw_ta_out': t_out.strftime('%Y-%m-%d %H:%M:%S') if pd.notnull(t_out) else None,
            'v_clocking_date': c_date_obj.strftime('%d %b %Y'),
            'clocking_date': r['clocking_date'],
            'clock_in': eff_in.strftime('%H:%M') if eff_in else 'KOSONG',
            'clock_out': eff_out.strftime('%H:%M') if eff_out else 'KOSONG',
            'full_clock_in': eff_in.strftime('%Y-%m-%d %H:%M:%S') if eff_in else 'null',
            'full_clock_out': eff_out.strftime('%Y-%m-%d %H:%M:%S') if eff_out else 'null',
            'bac_id': safe_bac_id,
            'bac_no': r.get('bac_no') if pd.notnull(r.get('bac_no')) else '-',
            'bac_ket': r.get('bac_ket') if pd.notnull(r.get('bac_ket')) else '-',
            'bac_clock_in': b_in.strftime('%Y-%m-%dT%H:%M') if pd.notnull(b_in) else None,
            'bac_clock_out': b_out.strftime('%Y-%m-%dT%H:%M') if pd.notnull(b_out) else None,
            'evidence_photo': r.get('evidence_photo') if pd.notnull(r.get('evidence_photo')) else '',
            'bac_updated_by': r.get('bac_updated_by') if pd.notnull(r.get('bac_updated_by')) else '-',
            'bac_updated_date': r['bac_updated_date'].strftime('%d %b %Y') if pd.notnull(r.get('bac_updated_date')) else '-',
            'status': status
        }
        
        fmt['shift'] = determine_shift(eff_in, c_date_obj)
        
        if shift_filter and shift_filter != fmt['shift']: continue
            
        formatted_data.append(fmt)

    formatted_data.sort(key=lambda x: (x['clocking_date'], x['employee_code']), reverse=True)
    return formatted_data

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

        all_rows = get_absensi_hybrid_data(
            start_date=start_date, end_date=end_date, status_filter=status_filter,
            shift_filter=shift_filter, search=search, sub_company_id=sub_company_id,
            department_id=department_id, worker_type=worker_type
        )

        total_item = len(all_rows)
        start_idx = (page - 1) * pageSize
        end_idx = start_idx + pageSize        
        paged_rows = all_rows[start_idx:end_idx]
        
        return jsonify({
            "status": "success",
            "data": paged_rows,
            "total_page": (total_item + pageSize - 1) // pageSize if total_item > 0 else 1,
            "current_page": page,
            "total_item": total_item
        }), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
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
        
        # LANGSUNG TERIMA DATA MATANG
        rows = get_absensi_hybrid_data(
            start_date=start_date, end_date=end_date, status_filter=status_filter,
            shift_filter=shift_filter, search=search, sub_company_id=sub_company_id,
            department_id=department_id, worker_type=worker_type
        )
        
        if not rows:
            return jsonify({"status": "error", "message": "Tidak ada data absensi yang sesuai untuk diekspor."}), 404
        
        df = pd.DataFrame(rows)
        
        # Mapping nama kolom agar sesuai dengan format Excel
        df.rename(columns={
            'employee_code': 'Employee ID',
            'employee_name': 'Nama Karyawan',
            'gender': 'Gender',
            'subCom': 'Sub Company',
            'card': 'Absence Card',
            'cc': 'Cost Center',
            'type': 'Type',
            'shift': 'Shift',
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
            if not dt_str: return "-"
            try: return datetime.strptime(dt_str, '%Y-%m-%d').strftime('%d-%b-%Y').upper()
            except: return dt_str
        
        start_label = _format_date_label(start_date)
        end_label = _format_date_label(end_date)
        if worker_type == 'os': worker_label = "YAYASAN"
        elif worker_type == 'tetap': worker_label = "TETAP / KONTRAK"
        else: worker_label = "SEMUA KARYAWAN"
            
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
        import traceback
        traceback.print_exc()
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
        
        with db.engine.begin() as conn:
            conn.execute(sql_upsert, {
                'employee_id': emp_id,
                'clock_date': clock_date,
                'clock_in': c_in,
                'clock_out': c_out,
                'reason': reason,
                'deleted_by': deleted_by
            })
            
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

        if not start_date_raw or not end_date_raw:
            return jsonify({"status": "error", "message": "Parameter start_date dan end_date wajib diisi."}), 400

        query_results = get_absensi_hybrid_data(
            start_date=start_date_raw,
            end_date=end_date_raw,
            status_filter='template_revisi', 
            shift_filter=shift_filter,
            search=search,
            sub_company_id=sub_company_id,
            department_id=department_id,
            worker_type='os'
        )
        
        enriched_results = [r for r in query_results if not r.get('bac_id')]

        if not enriched_results:
            return jsonify({"status": "error", "message": "Tidak ditemukan data absensi tidak lengkap pada filter ini."}), 404

        dynamic_data = []
        for d in enriched_results:
            emp_name = d.get('employee_name')
            if not emp_name or str(emp_name).strip() in ('', '-', 'None', 'null'):
                emp_name = '-'
                
            excel_in = "" if (d.get('clock_in') == 'KOSONG') else d.get('clock_in')
            excel_out = "" if (d.get('clock_out') == 'KOSONG') else d.get('clock_out')

            dynamic_data.append({
                "Employee ID": str(d.get('employee_id')),
                "Nama Karyawan": emp_name,
                "Sub Company": d.get('subCom') or '-',
                "Cost Center": d.get('cc') or '-',
                "Shift": d.get('shift'),
                "Tanggal Absen": d.get('clocking_date'),
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