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

def determine_shift(clock_in_val, is_saturday, clock_out_val=None):
    # Flag penanda apakah kita menggunakan jam pulang sebagai patokan
    is_out_only = False
    
    # 1. Tentukan sumber waktu (Prioritas 1: Clock IN -> Prioritas 2: Clock OUT)
    time_source = clock_in_val
    if pd.isnull(time_source) or not time_source:
        if pd.isnull(clock_out_val) or not clock_out_val:
            return 'SHIFT 1' # Fallback absolut jika kedua jam kosong
        time_source = clock_out_val
        is_out_only = True

    # 2. Ekstraksi Angka Jam ke format integer HHMM (Contoh: 07:30 jadi 730)
    try:
        if isinstance(time_source, datetime): 
            jam = time_source.hour * 100 + time_source.minute
        else:
            val_str = str(time_source).strip()
            time_str = val_str.split(' ')[1] if ' ' in val_str else val_str
            time_parts = time_str.split(':')
            jam = int(time_parts[0]) * 100 + int(time_parts[1])
    except Exception: 
        return 'SHIFT 1'

    # =========================================================================
    # REVERSE BOUNDARY LOGIC (Jika Karyawan Lupa Tap Masuk, Hanya Ada Tap Pulang)
    # =========================================================================
    if is_out_only:
        if is_saturday:
            # Pulang siang (00:00 s/d 13:59) -> Pasti dari Shift 1 (Jadwal pulang 12:00)
            if 0 <= jam <= 1359: return 'SHIFT 1'
            # Pulang sore/malam (14:00 s/d 18:59) -> Pasti dari Shift 2 (Jadwal pulang 17:00)
            elif 1400 <= jam <= 1859: return 'SHIFT 2'
            # Pulang larut malam -> Pasti dari Shift 3 (Jadwal pulang 22:00)
            else: return 'SHIFT 3'
        else:
            # Pulang pagi (00:00 s/d 10:59) -> Pasti dari Shift 3 malam sebelumnya (Jadwal pulang 07:00)
            if 0 <= jam <= 1059: return 'SHIFT 3'
            # Pulang sore (11:00 s/d 18:59) -> Pasti dari Shift 1 / Non-Shift (Jadwal pulang 15:00)
            elif 1100 <= jam <= 1859: return 'SHIFT 1'
            # Pulang malam (19:00 s/d 23:59) -> Pasti dari Shift 2 (Jadwal pulang 23:00)
            else: return 'SHIFT 2'

    # =========================================================================
    # NORMAL BOUNDARY LOGIC (Berdasarkan Jam Kedatangan / Tap IN)
    # =========================================================================
    else:
        if is_saturday:
            # Shift 1 (07:00 - 12:00): Batas kedatangan 04:00 s/d 10:59
            if 400 <= jam <= 1059: return 'SHIFT 1'
            # Shift 2 (12:00 - 17:00): Batas kedatangan 11:00 s/d 15:59
            elif 1100 <= jam <= 1559: return 'SHIFT 2'
            # Shift 3 (17:00 - 22:00): Batas kedatangan 16:00 s/d 03:59
            else: return 'SHIFT 3'
        else:
            # Shift 1 & Non-Shift (07:00/08:00 - 15:00): Batas kedatangan 04:00 s/d 13:59
            if 400 <= jam <= 1359: return 'SHIFT 1'
            # Shift 2 (15:00 - 23:00): Batas kedatangan 14:00 s/d 21:59
            elif 1400 <= jam <= 2159: return 'SHIFT 2'
            # Shift 3 (23:00 - 07:00): Batas kedatangan 22:00 s/d 03:59 (Cross Midnight)
            else: return 'SHIFT 3'

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
    # TAHAP 0: DATE-DRIVEN & TARGET-DRIVEN FEATURE TOGGLING
    # =========================================================================
    fallback_sql = text("""
        SELECT 
            DATE(fallback_date) as f_date, 
            COALESCE(target_worker, 'OS') as target_worker
        FROM access_fallback_config 
        WHERE fallback_date >= :start_date AND fallback_date <= :end_date
    """)
    with db.engine.connect() as conn:
        fallback_rows = conn.execute(fallback_sql, {'start_date': start_date, 'end_date': end_date}).mappings().fetchall()
    
    active_fallback_config = {str(row['f_date']): str(row['target_worker']).strip().upper() for row in fallback_rows}

    # =========================================================================
    # [ATURAN 4b] PUSHDOWN PREDICATE: PERSIAPAN ALIAS DEPARTMENT
    # =========================================================================
    target_dept_aliases = []
    if department_id:
        sql_cc = text("SELECT id, cost_center, org_name FROM org_cost_center WHERE id = :dept_id OR cost_center = :dept_id OR org_name = :dept_id LIMIT 1")
        with db.engine.connect() as conn:
            cc_res = conn.execute(sql_cc, {'dept_id': department_id}).fetchone()
        if cc_res:
            target_dept_aliases = [str(cc_res[0]), str(cc_res[1]), str(cc_res[2])]
        else:
            target_dept_aliases = [str(department_id)]

    # =========================================================================
    # TAHAP 1: PRE-SELECTION (MASTER DATA KARYAWAN & HISTORY CC)
    # =========================================================================
    master_params = {'start_date': start_date, 'end_date': end_date}
    where_os = [
        "e.employee_code IS NOT NULL", 
        "e.employee_code != ''",
        "e.valid_from <= :end_date",
        "COALESCE(e.valid_to, '2099-12-31') >= :start_date"
    ]
    where_tetap = ["employee_id IS NOT NULL", "employee_id != ''"]

    if search:
        search_param = f"%{search}%"
        master_params['search'] = search_param
        where_tetap.append("(employee_id LIKE :search OR employee_name LIKE :search OR card_no LIKE :search)")
        where_os.append("(e.employee_code LIKE :search OR p.name LIKE :search OR c.card_number LIKE :search)")
        
    # =========================================================================
    # FIX: LOGIKA OS VS TETAP BERDASARKAN PANJANG NIK (5 DIGIT = OS)
    # =========================================================================
    worker_type_clean = (worker_type or 'all').strip().lower()
    if worker_type_clean == 'os':
        where_tetap.append("CHAR_LENGTH(TRIM(employee_id)) = 5") 
        where_os.append("CHAR_LENGTH(TRIM(e.employee_code)) = 5") 
    elif worker_type_clean == 'tetap':
        where_tetap.append("CHAR_LENGTH(TRIM(employee_id)) > 5") 
        where_os.append("CHAR_LENGTH(TRIM(e.employee_code)) > 5") 

    if sub_company_id:
        if sub_company_id == 'TYPE_OS': 
            where_tetap.append("1=0")
            where_os.append("sc.type_company = 'OS'")
        elif sub_company_id == 'TYPE_VENDOR': 
            where_tetap.append("1=0")
            where_os.append("sc.type_company = 'Vendor'")
        else:
            where_tetap.append("('sub00003' = :sub_company_id OR 'CRS' = :sub_company_id)")
            where_os.append("e.sub_company_id = :sub_company_id")
            master_params['sub_company_id'] = sub_company_id

    sql_tetap = text(f"""
        SELECT 
            CAST(NULL AS CHAR) AS emp_pk_id,
            employee_id AS emp_code, employee_name AS emp_name, card_no AS master_card_id,
            '-' AS gender, 'sub00003' AS sub_company_id, 'CRS' AS sub_company_name,
            CAST(cost_center AS CHAR) AS dept_code, dept_name AS cc_name, 
            'TETAP/KONTRAK' AS emp_type, 1 AS use_cc,
            '2000-01-01' AS valid_from, '2099-12-31' AS valid_to
        FROM vw_master_karyawan
        WHERE {" AND ".join(where_tetap)}
    """)

    sql_os = text(f"""
        SELECT 
            CAST(e.id AS CHAR) AS emp_pk_id,
            CAST(e.employee_code AS CHAR) AS emp_code, 
            p.name AS emp_name, 
            c.card_number AS master_card_id,
            COALESCE(p.gender, '-') AS gender, 
            e.sub_company_id, 
            sc.sub_company_name,
            COALESCE(t.type_worker, 'OS') AS emp_type, 
            COALESCE(e.use_cc, 0) AS use_cc,
            e.valid_from, 
            COALESCE(CASE WHEN e.valid_to > '2099-12-31' THEN '2099-12-31' ELSE e.valid_to END, '2099-12-31') AS valid_to
        FROM os_employment e
        JOIN os_person p ON p.person_id = e.person_id
        LEFT JOIN sub_company sc ON sc.sub_company_id = e.sub_company_id
        LEFT JOIN os_card c ON c.employee_id = e.id 
            AND COALESCE(c.valid_from, '2000-01-01') <= :end_date 
            AND COALESCE(c.valid_to, '2099-12-31') >= :start_date
        LEFT JOIN os_type t ON t.employee_id = e.id 
            AND COALESCE(t.valid_from, '2000-01-01') <= :end_date 
            AND COALESCE(t.valid_to, '2099-12-31') >= :start_date
        WHERE {" AND ".join(where_os)}
    """)
    
    sql_history_cc = text("""
        SELECT 
            CAST(occ.employee_id AS CHAR) AS emp_pk_id,
            CAST(occ.cc_id AS CHAR) AS history_cc_code,
            c.org_name AS history_cc_name,
            occ.org_cc_id AS history_cc_id,
            occ.valid_from,
            COALESCE(CASE WHEN occ.valid_to > '2099-12-31' THEN '2099-12-31' ELSE occ.valid_to END, '2099-12-31') AS valid_to
        FROM os_org occ
        LEFT JOIN org_cost_center c ON c.id = occ.org_cc_id
        WHERE occ.employee_id IN (
            SELECT id FROM os_employment e WHERE e.valid_from <= :end_date AND COALESCE(e.valid_to, '2099-12-31') >= :start_date
        )
        AND COALESCE(occ.valid_from, '2000-01-01') <= :end_date 
        AND COALESCE(occ.valid_to, '2099-12-31') >= :start_date
    """)

    with db.engine.connect() as conn:
        rows_tetap = conn.execute(sql_tetap, master_params).mappings().fetchall()
        rows_os = conn.execute(sql_os, master_params).mappings().fetchall()
        hist_rows = conn.execute(sql_history_cc, {'start_date': start_date, 'end_date': end_date}).mappings().fetchall()
        
    df_master = pd.concat([pd.DataFrame([dict(r) for r in rows_tetap]), pd.DataFrame([dict(r) for r in rows_os])], ignore_index=True)
        
    if df_master.empty:
        return []

    df_master['emp_pk_id'] = df_master['emp_pk_id'].astype(str).str.strip().replace({'None': None, 'nan': None, '<NA>': None})
    df_master['valid_from'] = pd.to_datetime(df_master['valid_from']).dt.strftime('%Y-%m-%d')
    df_master['valid_to'] = pd.to_datetime(df_master['valid_to']).dt.strftime('%Y-%m-%d')
    df_master['master_card_id'] = df_master['master_card_id'].astype(str).str.strip()
    df_master['emp_code'] = df_master['emp_code'].astype(str).str.strip()
    
    card_list = [c for c in df_master['master_card_id'].unique() if c not in ('None', 'nan', '', '-', 'null')]
    card_ids = tuple(card_list) if card_list else ('-1',)
    emp_ids = tuple(df_master['emp_code'].unique()) if not df_master.empty else ('-1',)
    
    df_history = pd.DataFrame([dict(r) for r in hist_rows])
    if not df_history.empty:
        df_history['emp_pk_id'] = df_history['emp_pk_id'].astype(str).str.strip()
        df_history['valid_from_hist'] = pd.to_datetime(df_history['valid_from']).dt.strftime('%Y-%m-%d')
        df_history['valid_to_hist'] = pd.to_datetime(df_history['valid_to']).dt.strftime('%Y-%m-%d')
        df_history = df_history.drop(columns=['valid_from', 'valid_to'])
    else:
        df_history = pd.DataFrame(columns=['emp_pk_id', 'history_cc_code', 'history_cc_name', 'history_cc_id', 'valid_from_hist', 'valid_to_hist'])

    # =========================================================================
    # TAHAP 2: FETCH TRANSAKSI ABSEN
    # =========================================================================
    start_dt_obj = datetime.strptime(start_date, '%Y-%m-%d')
    prev_day_str = (start_dt_obj - timedelta(days=1)).strftime('%Y-%m-%d')
    
    att_sql = text("""
        SELECT 
            ta.card_id, DATE(ta.clocking_date) AS clocking_date, 
            ta.clock_in AS ta_in, ta.clock_out AS ta_out, ta.flag AS ta_flag
        FROM `db-webapps`.TBL_ATTENDANCE ta
        WHERE ta.clocking_date >= :start_date AND ta.clocking_date <= :end_date
        AND ta.card_id IN :card_ids
    """)

    raw_sql = text("""
        SELECT 
            tt.CARD_ID AS card_id, 
            tt.CLOCKING_DATE AS tap_time,
            occ.org_name AS terminal_cc_name,
            occ.cost_center AS terminal_cc_code,
            occ.id AS terminal_cc_id
        FROM `db-webapps`.TBL_TACTIVITIES tt
        LEFT JOIN terminal_master tm ON tm.node_id = tt.TERMINAL_ID AND tm.company_id = '1111'
        LEFT JOIN org_cost_center occ ON occ.id = tm.org_cc_id
        WHERE tt.CLOCKING_DATE >= :start_date AND tt.CLOCKING_DATE <= :end_date_2359
        AND tt.CARD_ID IN :card_ids
    """)
    
    ex_sql = text("""
        SELECT CAST(employee_id AS CHAR) AS emp_code, DATE(clocking_date) AS clocking_date, 
               clock_in AS ex_in, clock_out AS ex_out, reason AS ex_reason
        FROM attendance_exclusions 
        WHERE status = 1 
        AND clocking_date >= :start_date AND clocking_date <= :end_date 
        AND employee_id IN :emp_ids
    """)

    with db.engine.connect() as conn:
        att_rows = conn.execute(att_sql, {'start_date': prev_day_str, 'end_date': end_date, 'card_ids': card_ids}).mappings().fetchall()
        raw_rows = conn.execute(raw_sql, {'start_date': prev_day_str, 'end_date_2359': f"{end_date} 23:59:59", 'card_ids': card_ids}).mappings().fetchall()
        ex_rows = conn.execute(ex_sql, {'start_date': prev_day_str, 'end_date': end_date, 'emp_ids': emp_ids}).mappings().fetchall()

    exclusion_dict = {}
    for ex in ex_rows:
        emp = str(ex['emp_code']).strip()
        cdate = str(ex['clocking_date']) 
        key = f"{emp}_{cdate}"
        if key not in exclusion_dict:
            exclusion_dict[key] = []
            
        val_in = pd.to_datetime(ex['ex_in']).strftime('%Y-%m-%d %H:%M:%S') if pd.notna(ex['ex_in']) else None
        val_out = pd.to_datetime(ex['ex_out']).strftime('%Y-%m-%d %H:%M:%S') if pd.notna(ex['ex_out']) else None
        
        reason_str = str(ex['ex_reason']).lower() if pd.notnull(ex['ex_reason']) else ""
        is_bac_only = 'bac' in reason_str
        
        exclusion_dict[key].append({
            'in': val_in, 
            'out': val_out,
            'is_bac_only': is_bac_only
        })

    df_att_rekapan = pd.DataFrame([dict(r) for r in att_rows])
    df_raw_full = pd.DataFrame([dict(r) for r in raw_rows])

    if not df_att_rekapan.empty:
        df_att_rekapan['source'] = 1
        
        if not df_raw_full.empty:
            term_map = df_raw_full.copy()
            term_map['ta_in_str'] = pd.to_datetime(term_map['tap_time']).dt.strftime('%Y-%m-%d %H:%M:%S')
            term_map['card_id'] = term_map['card_id'].astype(str).str.strip()
            term_map = term_map.drop_duplicates(subset=['card_id', 'ta_in_str'])
            
            df_att_rekapan['ta_in_str'] = pd.to_datetime(df_att_rekapan['ta_in']).dt.strftime('%Y-%m-%d %H:%M:%S')
            df_att_rekapan['card_id'] = df_att_rekapan['card_id'].astype(str).str.strip()
            
            df_att_rekapan = pd.merge(
                df_att_rekapan, 
                term_map[['card_id', 'ta_in_str', 'terminal_cc_name', 'terminal_cc_code', 'terminal_cc_id']], 
                on=['card_id', 'ta_in_str'], 
                how='left'
            )
            df_att_rekapan = df_att_rekapan.drop(columns=['ta_in_str'])
        else:
            df_att_rekapan['terminal_cc_name'] = None
            df_att_rekapan['terminal_cc_code'] = None
            df_att_rekapan['terminal_cc_id'] = None

    if not df_raw_full.empty:
        df_raw_full['clocking_date'] = pd.to_datetime(df_raw_full['tap_time']).dt.strftime('%Y-%m-%d')
        df_raw_full = df_raw_full.sort_values(by=['card_id', 'tap_time'])
        
        df_att_raw = df_raw_full.groupby(['card_id', 'clocking_date'], as_index=False).agg(
            ta_in=('tap_time', 'min'),
            ta_out=('tap_time', 'max'),
            terminal_cc_name=('terminal_cc_name', 'first'),
            terminal_cc_code=('terminal_cc_code', 'first'),
            terminal_cc_id=('terminal_cc_id', 'first')
        )
        
        df_att_raw.loc[df_att_raw['ta_in'] == df_att_raw['ta_out'], 'ta_out'] = pd.NaT
        df_att_raw['source'] = 2
        df_att_raw['ta_flag'] = None
        
        if not df_att_rekapan.empty:
            claimed_in = pd.to_datetime(df_att_rekapan['ta_in']).dt.strftime('%Y-%m-%d %H:%M:%S')
            claimed_out = pd.to_datetime(df_att_rekapan['ta_out']).dt.strftime('%Y-%m-%d %H:%M:%S')
            claimed_taps = pd.concat([claimed_in, claimed_out]).dropna().unique()
            
            raw_in_str = pd.to_datetime(df_att_raw['ta_in']).dt.strftime('%Y-%m-%d %H:%M:%S')
            raw_out_str = pd.to_datetime(df_att_raw['ta_out']).dt.strftime('%Y-%m-%d %H:%M:%S')
            
            df_att_raw.loc[raw_in_str.isin(claimed_taps), 'ta_in'] = pd.NaT
            df_att_raw.loc[raw_out_str.isin(claimed_taps), 'ta_out'] = pd.NaT

            df_att_raw = df_att_raw.dropna(subset=['ta_in', 'ta_out'], how='all')

            if not df_att_raw.empty:
                mask_only_out = df_att_raw['ta_in'].isna() & df_att_raw['ta_out'].notna()
                df_att_raw.loc[mask_only_out, 'ta_in'] = df_att_raw.loc[mask_only_out, 'ta_out']
                df_att_raw.loc[mask_only_out, 'ta_out'] = pd.NaT
    else:
        df_att_raw = pd.DataFrame()

    df_att = pd.concat([df_att_rekapan, df_att_raw], ignore_index=True)

    if not df_att.empty:
        df_att['clocking_date'] = pd.to_datetime(df_att['clocking_date']).dt.strftime('%Y-%m-%d')
        df_att['card_id'] = df_att['card_id'].astype(str).str.strip()
        
        master_map = df_master[['master_card_id', 'emp_code', 'valid_from', 'valid_to']].dropna(subset=['master_card_id'])
        df_att_merged = pd.merge(df_att, master_map, left_on='card_id', right_on='master_card_id', how='left')
        
        df_att_merged['is_exact'] = (df_att_merged['clocking_date'] >= df_att_merged['valid_from']) & (df_att_merged['clocking_date'] <= df_att_merged['valid_to'])
        
        df_att_merged = df_att_merged.sort_values(
            by=['emp_code', 'clocking_date', 'source', 'terminal_cc_name', 'is_exact'], 
            ascending=[True, True, True, False, False], 
            na_position='last'
        )
        
        df_att = df_att_merged.dropna(subset=['emp_code']).drop(columns=['master_card_id', 'valid_from', 'valid_to', 'is_exact', 'source'])
        
        if not df_att.empty:
            df_att = df_att.groupby(['emp_code', 'clocking_date'], as_index=False).agg({
                'card_id': 'first',
                'ta_in': 'first',    
                'ta_out': 'first',   
                'ta_flag': 'first',
                'terminal_cc_name': 'first',
                'terminal_cc_code': 'first',
                'terminal_cc_id': 'first'
            })
            df_att.loc[df_att['ta_in'] == df_att['ta_out'], 'ta_out'] = None

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
            'start_date': prev_day_str, 'end_date': end_date, 
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
    # TAHAP 3.5: CONFIG-DRIVEN ACCESS DOOR FALLBACK (VIRTUAL STAGING)
    # =========================================================================
    df_access = pd.DataFrame()
    if active_fallback_config and card_ids != ('-1',):
        fallback_dates_tuple = tuple(active_fallback_config.keys())
        
        acc_sql = text("""
            SELECT 
                card_id, 
                DATE(clocking_date) AS clocking_date,
                MIN(clocking_date) AS access_in,
                MAX(clocking_date) AS access_out
            FROM vw_tactitives_non_attendance 
            WHERE DATE(clocking_date) IN :fallback_dates
            AND card_id IN :card_ids
            AND tags LIKE '%Access%'
            GROUP BY card_id, DATE(clocking_date)
        """)
        
        with db.engine.connect() as conn:
            acc_rows = conn.execute(acc_sql, {
                'fallback_dates': fallback_dates_tuple, 
                'card_ids': card_ids
            }).mappings().fetchall()
            
        df_access = pd.DataFrame([dict(r) for r in acc_rows])
        if not df_access.empty:
            card_to_emp = dict(zip(df_master['master_card_id'], df_master['emp_code']))
            df_access['emp_code'] = df_access['card_id'].astype(str).str.strip().map(card_to_emp)
            df_access = df_access.dropna(subset=['emp_code'])
            
            if not df_access.empty:
                df_access['clocking_date'] = pd.to_datetime(df_access['clocking_date']).dt.strftime('%Y-%m-%d')
                df_access.loc[df_access['access_in'] == df_access['access_out'], 'access_out'] = pd.NaT
                df_access = df_access.groupby(['emp_code', 'clocking_date'], as_index=False).agg({
                    'access_in': 'min',
                    'access_out': 'max'
                })

    if df_att.empty and df_bac.empty and df_access.empty:
        return []

    # =========================================================================
    # TAHAP 4: PANDAS SPINE MERGE & HISTORY ALIGNMENT
    # =========================================================================
    if not df_att.empty and not df_bac.empty:
        df_trans = pd.merge(df_att, df_bac, on=['emp_code', 'clocking_date'], how='outer')
    elif not df_att.empty:
        df_trans = df_att.copy()
        for col in ['bac_id', 'bac_no', 'bac_ket', 'bac_in', 'bac_out', 'evidence_photo', 'bac_updated_by', 'bac_updated_date']: 
            df_trans[col] = None
    elif not df_bac.empty:
        df_trans = df_bac.copy()
        for col in ['card_id', 'ta_in', 'ta_out', 'ta_flag', 'terminal_cc_name', 'terminal_cc_code', 'terminal_cc_id']: 
            df_trans[col] = None
    else:
        df_trans = pd.DataFrame(columns=['emp_code', 'clocking_date'])

    if not df_access.empty:
        df_trans = pd.merge(df_trans, df_access, on=['emp_code', 'clocking_date'], how='outer')
    else:
        df_trans['access_in'] = None
        df_trans['access_out'] = None

    if df_trans.empty:
        return []

    df_final = pd.merge(df_master, df_trans, on='emp_code', how='inner')
    
    df_final = df_final[
        (df_final['valid_from'] <= df_final['clocking_date']) & 
        (df_final['valid_to'] >= df_final['clocking_date']) &
        (df_final['clocking_date'] >= start_date) & 
        (df_final['clocking_date'] <= end_date)
    ]
    df_final = df_final.drop_duplicates(subset=['emp_code', 'clocking_date'], keep='first')

    has_os_data = df_final['emp_pk_id'].notnull().any() if not df_final.empty else False

    if not df_history.empty and not df_final.empty and has_os_data:
        df_final['emp_pk_id_merge'] = df_final['emp_pk_id'].astype(str).str.strip().replace({'None': '', 'nan': '', '<NA>': ''})
        df_history_clean = df_history.copy()
        df_history_clean['emp_pk_id_merge'] = df_history_clean['emp_pk_id'].astype(str).str.strip()

        df_final = pd.merge(df_final, df_history_clean, on='emp_pk_id_merge', how='left')
        
        df_final['hist_valid'] = (df_final['clocking_date'] >= df_final['valid_from_hist']) & (df_final['clocking_date'] <= df_final['valid_to_hist'])
        
        df_final = df_final.sort_values(['emp_code', 'clocking_date', 'hist_valid'], ascending=[True, True, False])
        df_final = df_final.drop_duplicates(subset=['emp_code', 'clocking_date'], keep='first')
        
        df_final.loc[~df_final['hist_valid'], ['history_cc_name', 'history_cc_code', 'history_cc_id']] = None
        df_final = df_final.drop(columns=['emp_pk_id_merge', 'valid_from_hist', 'valid_to_hist', 'hist_valid'], errors='ignore')
    else:
        df_final['history_cc_name'] = None
        df_final['history_cc_code'] = None
        df_final['history_cc_id'] = None

    df_final = df_final.astype(object).replace({np.nan: None, pd.NaT: None})
    raw_records = df_final.to_dict('records')
    formatted_data = []

    for r in raw_records:
        b_in, b_out = r.get('bac_in'), r.get('bac_out')
        t_in, t_out = r.get('ta_in'), r.get('ta_out')
        a_in, a_out = r.get('access_in'), r.get('access_out')
        bac_id_val = r.get('bac_id')
        
        # =====================================================================
        # LATE-EXCLUSION PURGE & BLIND BAC WIPE-OUT
        # =====================================================================
        ex_key = f"{r['emp_code']}_{r['clocking_date']}"
        raw_purged = False 
        
        if ex_key in exclusion_dict:
            for ex in exclusion_dict[ex_key]:
                ex_in_val = ex['in']
                ex_out_val = ex['out']
                is_bac_only = ex['is_bac_only']
                
                if is_bac_only:
                    b_in = None
                    b_out = None
                
                if ex_in_val is None and ex_out_val is None:
                    if not is_bac_only:
                        t_in = None; t_out = None
                        raw_purged = True
                    
                if ex_in_val is not None and not is_bac_only:
                    if pd.notnull(t_in) and pd.to_datetime(t_in).strftime('%Y-%m-%d %H:%M:%S') == ex_in_val: 
                        t_in = None
                        raw_purged = True
                        
                if ex_out_val is not None and not is_bac_only:
                    if pd.notnull(t_out) and pd.to_datetime(t_out).strftime('%Y-%m-%d %H:%M:%S') == ex_out_val: 
                        t_out = None
                        raw_purged = True

        if raw_purged and pd.isnull(t_in) and pd.isnull(t_out):
            b_in = None
            b_out = None

        if pd.isnull(b_in) and pd.isnull(b_out):
            bac_id_val = None
            r['bac_no'] = None
            r['bac_ket'] = None
            r['evidence_photo'] = None
            r['bac_updated_by'] = None
            r['bac_updated_date'] = None
        else:
            bac_id_val = r.get('bac_id')

        # =====================================================================
        # FIX: TARGET-DRIVEN ACCESS DOOR PATCHING DENGAN VALIDASI NIK
        # Mengandalkan Panjang String (5 Karakter) untuk menentukan Pekerja OS
        # =====================================================================
        eff_in = b_in if pd.notnull(b_in) else (t_in if pd.notnull(t_in) else None)
        eff_out = b_out if pd.notnull(b_out) else (t_out if pd.notnull(t_out) else None)
        
        is_patched_by_access = False
        
        if r['clocking_date'] in active_fallback_config:
            target_worker_rule = active_fallback_config[r['clocking_date']]
            
            emp_code_str = str(r['emp_code']).strip()
            emp_is_os = len(emp_code_str) == 5 
            
            use_access_for_this_employee = False
            
            if target_worker_rule == 'ALL':
                use_access_for_this_employee = True
            elif target_worker_rule == 'OS' and emp_is_os:
                use_access_for_this_employee = True
                
            if use_access_for_this_employee:
                if pd.isnull(eff_in) and pd.notnull(a_in):
                    eff_in = a_in
                    is_patched_by_access = True
                if pd.isnull(eff_out) and pd.notnull(a_out):
                    eff_out = a_out
                    is_patched_by_access = True
        
        if pd.isnull(eff_in) and pd.isnull(eff_out):
            continue

        if pd.notnull(b_in) or pd.notnull(b_out): status = 'BAC Found'
        elif is_patched_by_access and pd.isnull(t_in) and pd.isnull(t_out): status = 'Data Akses' 
        elif pd.notnull(eff_in) and pd.notnull(eff_out): status = 'Lengkap'
        else: status = 'Tidak Lengkap'
        
        if status_filter == 'lengkap' and status != 'Lengkap': continue
        if status_filter == 'bac' and status != 'BAC Found': continue
        if status_filter in ('anomali', 'template_revisi') and status != 'Tidak Lengkap': continue
        if status_filter == 'no_in' and pd.notnull(eff_in): continue
        if status_filter == 'no_out' and pd.notnull(eff_out): continue
        if status_filter == 'no_both' and (pd.isnull(eff_in) or pd.isnull(eff_out)): continue

        # =====================================================================
        # STRICT TERMINAL FALLBACK VALIDATOR
        # =====================================================================
        master_cc_name = r.get('history_cc_name') or r.get('cc_name')
        master_cc_code = r.get('history_cc_code') or r.get('dept_code')
        master_cc_id = r.get('history_cc_id')
        use_cc = r.get('use_cc', 0)
        
        term_cc_name = r.get('terminal_cc_name')
        term_cc_code = r.get('terminal_cc_code')
        term_cc_id = r.get('terminal_cc_id')
        
        term_is_valid = pd.notnull(term_cc_name) and str(term_cc_name).strip().lower() not in ('', '-', 'none', 'null', 'nan')

        if use_cc == 1:
            final_cc_name = master_cc_name
            match_vals = [str(master_cc_id), str(master_cc_code), str(master_cc_name)]
        else:
            if term_is_valid:
                final_cc_name = term_cc_name
                match_vals = [str(term_cc_id), str(term_cc_code), str(term_cc_name)]
            else:
                final_cc_name = master_cc_name
                match_vals = [str(master_cc_id), str(master_cc_code), str(master_cc_name)]

        if department_id:
            if not any(val in target_dept_aliases for val in match_vals if pd.notnull(val)):
                continue

        c_date_obj = datetime.strptime(r['clocking_date'], '%Y-%m-%d')
        fmt = {
            'employee_id': r['emp_code'],
            'employee_code': r['emp_code'],
            'employee_name': r['emp_name'],
            'gender': r['gender'],
            'subCom': r['sub_company_name'] if pd.notnull(r['sub_company_name']) else '-',
            'card': r.get('card_id') or r['master_card_id'] or '-',
            'cc': final_cc_name if pd.notnull(final_cc_name) and str(final_cc_name).strip().lower() not in ('', '-', 'none', 'null', 'nan') else '-',
            
            # Text emp_type dikembalikan UTUH ke frontend secara kosmetik sesuai request Anda
            'type': r['emp_type'],
            
            'raw_ta_in': t_in.strftime('%Y-%m-%d %H:%M:%S') if pd.notnull(t_in) else None,
            'raw_ta_out': t_out.strftime('%Y-%m-%d %H:%M:%S') if pd.notnull(t_out) else None,
            'v_clocking_date': c_date_obj.strftime('%d %b %Y'),
            'clocking_date': r['clocking_date'],
            'clock_in': eff_in.strftime('%H:%M') if eff_in else 'KOSONG',
            'clock_out': eff_out.strftime('%H:%M') if eff_out else 'KOSONG',
            'full_clock_in': eff_in.strftime('%Y-%m-%d %H:%M:%S') if eff_in else 'null',
            'full_clock_out': eff_out.strftime('%Y-%m-%d %H:%M:%S') if eff_out else 'null',
            'bac_id': None if pd.isna(bac_id_val) else bac_id_val,
            'bac_no': r.get('bac_no') if pd.notnull(r.get('bac_no')) else '-',
            'bac_ket': r.get('bac_ket') if pd.notnull(r.get('bac_ket')) else '-',
            'bac_clock_in': b_in.strftime('%Y-%m-%dT%H:%M') if pd.notnull(b_in) else None,
            'bac_clock_out': b_out.strftime('%Y-%m-%dT%H:%M') if pd.notnull(b_out) else None,
            'evidence_photo': r.get('evidence_photo') if pd.notnull(r.get('evidence_photo')) else '',
            'bac_updated_by': r.get('bac_updated_by') if pd.notnull(r.get('bac_updated_by')) else '-',
            'bac_updated_date': r['bac_updated_date'].strftime('%d %b %Y') if pd.notnull(r.get('bac_updated_date')) else '-',
            'status': status
        }
        
        is_saturday_val = c_date_obj.weekday() == 5 
        fmt['shift'] = determine_shift(eff_in, is_saturday_val, eff_out)
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