import os
from io import BytesIO
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import text
from PIL import Image, ImageOps
from openpyxl.styles import Font
from openpyxl.worksheet.datavalidation import DataValidation

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
# REUSABLE HELPERS & VECTORIZED SHIFT DETERMINER
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

def determine_shift_vectorized(df):
    """Kalkulasi Shift secara simultan (O(1) runtime) tanpa iterasi baris"""
    if df.empty:
        return pd.Series(dtype=str)

    in_time = pd.to_datetime(df['eff_in'])
    out_time = pd.to_datetime(df['eff_out'])
    is_sat = pd.to_datetime(df['clocking_date']).dt.weekday == 5
    
    is_out_only = in_time.isna() & out_time.notna()
    source_time = in_time.fillna(out_time)
    both_null = in_time.isna() & out_time.isna()
    
    jam = source_time.dt.hour * 100 + source_time.dt.minute
    
    cond_out_sat = is_out_only & is_sat
    cond_out_week = is_out_only & (~is_sat)
    cond_in_sat = (~is_out_only) & is_sat
    cond_in_week = (~is_out_only) & (~is_sat)
    
    conditions = [
        both_null,
        # Reverse Logic (Hanya Out) - Sabtu
        cond_out_sat & (jam <= 1359),
        cond_out_sat & (jam >= 1400) & (jam <= 1859),
        cond_out_sat,
        # Reverse Logic (Hanya Out) - Hari Kerja
        cond_out_week & (jam <= 1059),
        cond_out_week & (jam >= 1100) & (jam <= 1859),
        cond_out_week,
        # Normal Logic (Berdasarkan In) - Sabtu
        cond_in_sat & (jam >= 400) & (jam <= 1059),
        cond_in_sat & (jam >= 1100) & (jam <= 1559),
        cond_in_sat,
        # Normal Logic (Berdasarkan In) - Hari Kerja
        cond_in_week & (jam >= 400) & (jam <= 1359),
        cond_in_week & (jam >= 1400) & (jam <= 2159),
        cond_in_week
    ]
    
    choices = [
        'SHIFT 1',
        'SHIFT 1', 'SHIFT 2', 'SHIFT 3',
        'SHIFT 3', 'SHIFT 1', 'SHIFT 2',
        'SHIFT 1', 'SHIFT 2', 'SHIFT 3',
        'SHIFT 1', 'SHIFT 2', 'SHIFT 3'
    ]
    return np.select(conditions, choices, default='SHIFT 1')

def process_and_save_bac_evidence(file_storage, target_folder, filename_without_ext, max_width=1000, quality=80):
    try:
        img = Image.open(file_storage)
        try: img = ImageOps.exif_transpose(img)
        except Exception: pass
        if img.mode in ("RGBA", "P"): img = img.convert("RGB")
        if img.width > max_width:
            ratio = max_width / float(img.width)
            new_height = int(float(img.height) * float(ratio))
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
# CORE FAST HYBRID ENGINE
# =============================================================================
def get_absensi_hybrid_data(start_date, end_date, status_filter='all_data', shift_filter='', 
                            search='', sub_company_id='', department_id='', worker_type='all',
                            page=None, pageSize=None, as_dataframe=False):
    
    # -------------------------------------------------------------------------
    # TAHAP 0: CONFIG & IN-MEMORY CACHE
    # -------------------------------------------------------------------------
    with db.engine.connect() as conn:
        fallback_rows = conn.execute(text("""
            SELECT DATE(fallback_date) as f_date, COALESCE(target_worker, 'OS') as target_worker
            FROM access_fallback_config 
            WHERE fallback_date >= :start_date AND fallback_date <= :end_date
        """), {'start_date': start_date, 'end_date': end_date}).mappings().fetchall()
        
        # Cache master terminal in-memory (menghilangkan JOIN berulang di tabel raw)
        term_rows = conn.execute(text("""
            SELECT tm.node_id, occ.org_name AS terminal_cc_name, occ.cost_center AS terminal_cc_code, occ.id AS terminal_cc_id
            FROM terminal_master tm
            LEFT JOIN org_cost_center occ ON occ.id = tm.org_cc_id
            WHERE tm.company_id = '1111'
        """)).mappings().fetchall()

    active_fallback_config = {str(row['f_date']): str(row['target_worker']).strip().upper() for row in fallback_rows}
    terminal_map_df = pd.DataFrame([dict(r) for r in term_rows])

    target_dept_aliases = []
    if department_id:
        with db.engine.connect() as conn:
            cc_res = conn.execute(text("""
                SELECT id, cost_center, org_name FROM org_cost_center 
                WHERE id = :dept_id OR cost_center = :dept_id OR org_name = :dept_id LIMIT 1
            """), {'dept_id': department_id}).fetchone()
        if cc_res:
            target_dept_aliases = [str(cc_res[0]), str(cc_res[1]), str(cc_res[2])]
        else:
            target_dept_aliases = [str(department_id)]

    # -------------------------------------------------------------------------
    # TAHAP 1: PRE-SELECTION (MASTER DATA KARYAWAN)
    # -------------------------------------------------------------------------
    master_params = {'start_date': start_date, 'end_date': end_date}
    where_os = [
        "e.employee_code IS NOT NULL", "e.employee_code != ''",
        "e.valid_from <= :end_date", "COALESCE(e.valid_to, '2099-12-31') >= :start_date"
    ]
    where_tetap = ["employee_id IS NOT NULL", "employee_id != ''"]

    if search:
        master_params['search'] = f"%{search}%"
        where_tetap.append("(employee_id LIKE :search OR employee_name LIKE :search)")
        where_os.append("(e.employee_code LIKE :search OR p.name LIKE :search)")

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
        SELECT CAST(NULL AS CHAR) AS emp_pk_id, employee_id AS emp_code, employee_name AS emp_name, 
               card_no AS master_card_id, '-' AS gender, 'sub00003' AS sub_company_id, 'CRS' AS sub_company_name,
               CAST(cost_center AS CHAR) AS dept_code, dept_name AS cc_name, 'TETAP/KONTRAK' AS emp_type, 1 AS use_cc,
               '2000-01-01' AS valid_from, '2099-12-31' AS valid_to
        FROM vw_master_karyawan WHERE {" AND ".join(where_tetap)}
    """)

    sql_os = text(f"""
        SELECT CAST(e.id AS CHAR) AS emp_pk_id, CAST(e.employee_code AS CHAR) AS emp_code, p.name AS emp_name, 
               c.card_number AS master_card_id, COALESCE(p.gender, '-') AS gender, e.sub_company_id, sc.sub_company_name,
               COALESCE(t.type_worker, 'OS') AS emp_type, COALESCE(e.use_cc, 0) AS use_cc, e.valid_from, 
               COALESCE(CASE WHEN e.valid_to > '2099-12-31' THEN '2099-12-31' ELSE e.valid_to END, '2099-12-31') AS valid_to
        FROM os_employment e
        JOIN os_person p ON p.person_id = e.person_id
        LEFT JOIN sub_company sc ON sc.sub_company_id = e.sub_company_id
        LEFT JOIN os_card c ON c.employee_id = e.id AND COALESCE(c.valid_from, '2000-01-01') <= :end_date AND COALESCE(c.valid_to, '2099-12-31') >= :start_date
        LEFT JOIN os_type t ON t.employee_id = e.id AND COALESCE(t.valid_from, '2000-01-01') <= :end_date AND COALESCE(t.valid_to, '2099-12-31') >= :start_date
        WHERE {" AND ".join(where_os)}
    """)

    sql_history_cc = text("""
        SELECT CAST(occ.employee_id AS CHAR) AS emp_pk_id, CAST(occ.cc_id AS CHAR) AS history_cc_code,
               c.org_name AS history_cc_name, occ.org_cc_id AS history_cc_id, occ.valid_from,
               COALESCE(CASE WHEN occ.valid_to > '2099-12-31' THEN '2099-12-31' ELSE occ.valid_to END, '2099-12-31') AS valid_to
        FROM os_org occ
        LEFT JOIN org_cost_center c ON c.id = occ.org_cc_id
        WHERE occ.employee_id IN (
            SELECT id FROM os_employment e WHERE e.valid_from <= :end_date AND COALESCE(e.valid_to, '2099-12-31') >= :start_date
        ) AND COALESCE(occ.valid_from, '2000-01-01') <= :end_date AND COALESCE(occ.valid_to, '2099-12-31') >= :start_date
    """)

    with db.engine.connect() as conn:
        rows_tetap = conn.execute(sql_tetap, master_params).mappings().fetchall()
        rows_os = conn.execute(sql_os, master_params).mappings().fetchall()
        hist_rows = conn.execute(sql_history_cc, {'start_date': start_date, 'end_date': end_date}).mappings().fetchall()

    df_master = pd.concat([pd.DataFrame([dict(r) for r in rows_tetap]), pd.DataFrame([dict(r) for r in rows_os])], ignore_index=True)
    if df_master.empty:
        return (pd.DataFrame(), 0) if as_dataframe else ([] if page is not None else [])

    # 📌 REINDEX SCHEMA MASTER (Mencegah KeyError 'cc_name' dan 'dept_code')
    standard_columns = [
        'emp_pk_id', 'emp_code', 'emp_name', 'master_card_id', 'gender', 
        'sub_company_id', 'sub_company_name', 'dept_code', 'cc_name', 
        'emp_type', 'use_cc', 'valid_from', 'valid_to'
    ]
    df_master = df_master.reindex(columns=standard_columns)

    df_master['emp_pk_id'] = df_master['emp_pk_id'].astype(str).str.strip().replace({'None': None, 'nan': None, '<NA>': None})
    df_master['valid_from'] = pd.to_datetime(df_master['valid_from']).dt.strftime('%Y-%m-%d')
    df_master['valid_to'] = pd.to_datetime(df_master['valid_to']).dt.strftime('%Y-%m-%d')
    df_master['master_card_id'] = df_master['master_card_id'].astype(str).str.strip()
    df_master['emp_code'] = df_master['emp_code'].astype(str).str.strip()

    card_set = set(c for c in df_master['master_card_id'].unique() if c not in ('None', 'nan', '', '-', 'null'))
    emp_set = set(e for e in df_master['emp_code'].unique() if e not in ('None', 'nan', '', '-', 'null'))

    df_history = pd.DataFrame([dict(r) for r in hist_rows])
    if not df_history.empty:
        df_history['emp_pk_id'] = df_history['emp_pk_id'].astype(str).str.strip()
        df_history['valid_from_hist'] = pd.to_datetime(df_history['valid_from']).dt.strftime('%Y-%m-%d')
        df_history['valid_to_hist'] = pd.to_datetime(df_history['valid_to']).dt.strftime('%Y-%m-%d')
        df_history = df_history.drop(columns=['valid_from', 'valid_to'])
    else:
        df_history = pd.DataFrame(columns=['emp_pk_id', 'history_cc_code', 'history_cc_name', 'history_cc_id', 'valid_from_hist', 'valid_to_hist'])

    if not card_set and not emp_set:
        return (pd.DataFrame(), 0) if as_dataframe else ([] if page is not None else [])

    # -------------------------------------------------------------------------
    # TAHAP 2: FAST BULK TEMPORARY TABLE & TRANSACTIONS (EXPLICIT COLLATION FIX)
    # -------------------------------------------------------------------------
    start_dt_obj = datetime.strptime(start_date, '%Y-%m-%d')
    end_dt_obj = datetime.strptime(end_date, '%Y-%m-%d')
    prev_day_str = (start_dt_obj - timedelta(days=1)).strftime('%Y-%m-%d')
    end_date_tac = (end_dt_obj + timedelta(days=1)).strftime('%Y-%m-%d 09:00:00')

    with db.engine.connect() as conn:
        # Collation eksplisit mencegah Error 1267
        conn.execute(text("""
            CREATE TEMPORARY TABLE IF NOT EXISTS tmp_cards_filter (
                card_id VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci PRIMARY KEY
            ) ENGINE=MEMORY
        """))
        conn.execute(text("""
            CREATE TEMPORARY TABLE IF NOT EXISTS tmp_emps_filter (
                emp_code VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci PRIMARY KEY
            ) ENGINE=MEMORY
        """))
        conn.execute(text("TRUNCATE TABLE tmp_cards_filter"))
        conn.execute(text("TRUNCATE TABLE tmp_emps_filter"))

        if card_set:
            conn.execute(text("INSERT IGNORE INTO tmp_cards_filter (card_id) VALUES (:cid)"), [{'cid': c} for c in card_set])
        if emp_set:
            conn.execute(text("INSERT IGNORE INTO tmp_emps_filter (emp_code) VALUES (:eid)"), [{'eid': e} for e in emp_set])

        att_rows = conn.execute(text("""
            SELECT ta.card_id, DATE(ta.clocking_date) AS clocking_date, ta.clock_in AS ta_in, ta.clock_out AS ta_out, ta.flag AS ta_flag
            FROM `db-webapps`.TBL_ATTENDANCE ta
            INNER JOIN tmp_cards_filter tmp ON ta.card_id = tmp.card_id
            WHERE ta.clocking_date >= :start_date AND ta.clocking_date <= :end_date
        """), {'start_date': prev_day_str, 'end_date': end_date}).mappings().fetchall()

        # Query lean tanpa JOIN lambat ke terminal_master
        raw_rows = conn.execute(text("""
            SELECT tt.CARD_ID AS card_id, tt.CLOCKING_DATE AS tap_time, tt.TERMINAL_ID AS terminal_id
            FROM `db-webapps`.TBL_TACTIVITIES tt
            INNER JOIN tmp_cards_filter tmp ON tt.CARD_ID = tmp.card_id
            WHERE tt.CLOCKING_DATE >= :start_date AND tt.CLOCKING_DATE <= :end_date
        """), {'start_date': prev_day_str, 'end_date': end_date_tac}).mappings().fetchall()

        ex_rows = conn.execute(text("""
            SELECT CAST(e.employee_id AS CHAR) AS emp_code, DATE(e.clocking_date) AS clocking_date, 
                   e.clock_in AS ex_in, e.clock_out AS ex_out, e.reason AS ex_reason, e.deleted_at AS ex_created_at
            FROM attendance_exclusions e
            INNER JOIN tmp_emps_filter tmp ON CAST(e.employee_id AS CHAR) = tmp.emp_code
            WHERE e.status = 1 AND e.clocking_date >= :start_date AND e.clocking_date <= :end_date 
        """), {'start_date': prev_day_str, 'end_date': end_date}).mappings().fetchall()

        bac_rows_os = conn.execute(text("""
            SELECT CAST(b.employee_id AS CHAR) AS emp_code, DATE(b.clock_date) AS clocking_date, b.id AS bac_id, 
                   b.bac_no, b.bac_ket, b.clock_in AS bac_in, b.clock_out AS bac_out, 
                   b.evidence_photo, b.created_by AS bac_updated_by, b.created_date AS bac_updated_date
            FROM bac_os b
            INNER JOIN tmp_emps_filter tmp ON CAST(b.employee_id AS CHAR) = tmp.emp_code
            WHERE b.status = 1 AND b.clock_date >= :start_date AND b.clock_date <= :end_date
        """), {'start_date': prev_day_str, 'end_date': end_date}).mappings().fetchall()

        bac_rows_ta = conn.execute(text("""
            SELECT CAST(t.nrp AS CHAR) AS emp_code, DATE(t.submit_at) AS clocking_date, t.id AS bac_id, 
                   'BAC' AS bac_no, 'BAC (kiosk/backdate)' AS bac_ket, 
                   CASE WHEN t.direction = 0 THEN t.submit_at ELSE NULL END AS bac_in, 
                   CASE WHEN t.direction = 1 THEN t.submit_at ELSE NULL END AS bac_out, 
                   NULL AS evidence_photo, 'system' AS bac_updated_by, t.submit_at AS bac_updated_date
            FROM `db-webapps`.transaksi_absen t
            INNER JOIN tmp_emps_filter tmp ON CAST(t.nrp AS CHAR) = tmp.emp_code
            WHERE t.status IN (2, 7) AND t.submit_at >= :start_date AND t.submit_at <= :end_date_2359
        """), {'start_date': prev_day_str, 'end_date_2359': f"{end_date} 23:59:59"}).mappings().fetchall()

        acc_rows = []
        if active_fallback_config:
            acc_rows = conn.execute(text("""
                SELECT CAST(v.card_id AS CHAR) AS card_id, v.clocking_date AS tap_time,
                       UPPER(TRIM(COALESCE(v.direction, ''))) AS direction
                FROM vw_tactitives_non_attendance v
                INNER JOIN tmp_cards_filter tmp ON v.card_id = tmp.card_id
                WHERE v.clocking_date >= :start_date AND v.clocking_date <= :end_date_2359 AND v.tags LIKE '%Access%'
            """), {'start_date': prev_day_str, 'end_date_2359': f"{end_date} 23:59:59"}).mappings().fetchall()

        conn.execute(text("DROP TEMPORARY TABLE IF EXISTS tmp_cards_filter"))
        conn.execute(text("DROP TEMPORARY TABLE IF EXISTS tmp_emps_filter"))

    bac_rows = list(bac_rows_os) + list(bac_rows_ta)

    # -------------------------------------------------------------------------
    # TAHAP 3: VECTORIZED PANDAS PROCESSING
    # -------------------------------------------------------------------------
    df_att_rekapan = pd.DataFrame([dict(r) for r in att_rows])
    df_raw_full = pd.DataFrame([dict(r) for r in raw_rows])

    # Mapping terminal cost center via memori
    if not df_raw_full.empty and not terminal_map_df.empty:
        df_raw_full = pd.merge(df_raw_full, terminal_map_df, left_on='terminal_id', right_on='node_id', how='left')
    elif not df_raw_full.empty:
        df_raw_full['terminal_cc_name'] = df_raw_full['terminal_cc_code'] = df_raw_full['terminal_cc_id'] = None

    if not df_att_rekapan.empty:
        df_att_rekapan['card_id'], df_att_rekapan['source'] = df_att_rekapan['card_id'].astype(str).str.strip(), 1
        df_att_rekapan['ta_in'] = pd.to_datetime(df_att_rekapan['ta_in'])
        df_att_rekapan['ta_out'] = pd.to_datetime(df_att_rekapan['ta_out'])
        if not df_raw_full.empty:
            df_raw_full['card_id'] = df_raw_full['card_id'].astype(str).str.strip()
            df_raw_full['tap_time'] = pd.to_datetime(df_raw_full['tap_time'])
            term_map = df_raw_full.drop_duplicates(subset=['card_id', 'tap_time'])
            df_att_rekapan = pd.merge(
                df_att_rekapan, 
                term_map[['card_id', 'tap_time', 'terminal_cc_name', 'terminal_cc_code', 'terminal_cc_id']], 
                left_on=['card_id', 'ta_in'], right_on=['card_id', 'tap_time'], how='left'
            ).drop(columns=['tap_time'])
        else:
            df_att_rekapan['terminal_cc_name'] = df_att_rekapan['terminal_cc_code'] = df_att_rekapan['terminal_cc_id'] = None

    if not df_raw_full.empty:
        df_raw_full['card_id'] = df_raw_full['card_id'].astype(str).str.strip()
        df_raw_full['tap_time'] = pd.to_datetime(df_raw_full['tap_time'])
        df_raw_full = df_raw_full.sort_values(by=['card_id', 'tap_time']).reset_index(drop=True)
        df_raw_full['prev_tap'] = df_raw_full.groupby('card_id')['tap_time'].shift(1)
        time_gap = (df_raw_full['tap_time'] - df_raw_full['prev_tap']).dt.total_seconds()

        mask_cross_1 = (df_raw_full['tap_time'].dt.hour.between(0, 11) & (df_raw_full['prev_tap'].dt.hour >= 15) & (time_gap <= 16 * 3600) & (time_gap >= 0))
        mask_cross_2 = (df_raw_full['tap_time'].dt.hour.between(0, 11)) & mask_cross_1.shift(1).fillna(False) & (df_raw_full['card_id'] == df_raw_full['card_id'].shift(1)) & (time_gap <= 8 * 3600)
        mask_cross_3 = (df_raw_full['tap_time'].dt.hour.between(0, 11)) & mask_cross_2.shift(1).fillna(False) & (df_raw_full['card_id'] == df_raw_full['card_id'].shift(1)) & (time_gap <= 8 * 3600)

        final_mask = mask_cross_1 | mask_cross_2 | mask_cross_3
        mask_isolated = (df_raw_full['tap_time'].dt.hour.between(0, 4)) & (~final_mask)

        df_raw_full['clocking_date'] = np.where(
            final_mask | mask_isolated, 
            (df_raw_full['tap_time'] - pd.Timedelta(days=1)).dt.strftime('%Y-%m-%d'), 
            df_raw_full['tap_time'].dt.strftime('%Y-%m-%d')
        )

        df_att_raw = df_raw_full.groupby(['card_id', 'clocking_date'], as_index=False).agg(
            ta_in=('tap_time', 'min'), ta_out=('tap_time', 'max'),
            terminal_cc_name=('terminal_cc_name', 'first'),
            terminal_cc_code=('terminal_cc_code', 'first'),
            terminal_cc_id=('terminal_cc_id', 'first')
        )
        df_att_raw.loc[df_att_raw['ta_in'] == df_att_raw['ta_out'], 'ta_out'] = pd.NaT
        df_att_raw['source'], df_att_raw['ta_flag'] = 2, None

        if not df_att_rekapan.empty:
            claimed_set = set(zip(df_att_rekapan['card_id'], df_att_rekapan['ta_in'])).union(
                set(zip(df_att_rekapan['card_id'], df_att_rekapan['ta_out']))
            )
            raw_in_tup = list(zip(df_att_raw['card_id'], df_att_raw['ta_in']))
            raw_out_tup = list(zip(df_att_raw['card_id'], df_att_raw['ta_out']))

            df_att_raw.loc[[t in claimed_set for t in raw_in_tup], 'ta_in'] = pd.NaT
            df_att_raw.loc[[t in claimed_set for t in raw_out_tup], 'ta_out'] = pd.NaT
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
        df_att_merged = pd.merge(df_att, master_map, left_on='card_id', right_on='master_card_id', how='inner')
        df_att_merged['is_exact'] = (df_att_merged['clocking_date'] >= df_att_merged['valid_from']) & (df_att_merged['clocking_date'] <= df_att_merged['valid_to'])
        df_att_merged = df_att_merged.sort_values(by=['emp_code', 'clocking_date', 'source', 'terminal_cc_name', 'is_exact'], ascending=[True, True, True, False, False], na_position='last')
        df_att = df_att_merged.drop(columns=['master_card_id', 'valid_from', 'valid_to', 'is_exact', 'source'])
        if not df_att.empty:
            df_att = df_att.groupby(['emp_code', 'clocking_date'], as_index=False).agg({
                'card_id': 'first', 'ta_in': 'first', 'ta_out': 'first', 'ta_flag': 'first',
                'terminal_cc_name': 'first', 'terminal_cc_code': 'first', 'terminal_cc_id': 'first'
            })
            df_att.loc[df_att['ta_in'] == df_att['ta_out'], 'ta_out'] = pd.NaT

    df_bac = pd.DataFrame([dict(r) for r in bac_rows])
    if not df_bac.empty:
        df_bac['emp_code'] = df_bac['emp_code'].astype(str).str.strip()
        df_bac['clocking_date'] = pd.to_datetime(df_bac['clocking_date']).dt.strftime('%Y-%m-%d')
        df_bac = df_bac.groupby(['emp_code', 'clocking_date'], as_index=False).agg({
            'bac_id': 'max', 'bac_no': 'max', 'bac_ket': 'max', 'bac_in': 'max', 'bac_out': 'max',
            'evidence_photo': 'max', 'bac_updated_by': 'max', 'bac_updated_date': 'max'
        })

    # Vektorisasi penentuan Access Taps (Bypass lambda loop)
    df_access = pd.DataFrame([dict(r) for r in acc_rows])
    if not df_access.empty:
        df_access['card_id'] = df_access['card_id'].astype(str).str.strip()
        df_access['tap_time'] = pd.to_datetime(df_access['tap_time'])
        df_access = df_access.sort_values(by=['card_id', 'tap_time']).reset_index(drop=True)
        df_access['prev_tap'] = df_access.groupby('card_id')['tap_time'].shift(1)
        time_gap_acc = (df_access['tap_time'] - df_access['prev_tap']).dt.total_seconds()

        mask_acc_1 = (df_access['tap_time'].dt.hour.between(0, 11) & (df_access['prev_tap'].dt.hour >= 15) & (time_gap_acc <= 16 * 3600) & (time_gap_acc >= 0))
        mask_acc_2 = (df_access['tap_time'].dt.hour.between(0, 11)) & mask_acc_1.shift(1).fillna(False) & (df_access['card_id'] == df_access['card_id'].shift(1)) & (time_gap_acc <= 8 * 3600)
        mask_acc_3 = (df_access['tap_time'].dt.hour.between(0, 11)) & mask_acc_2.shift(1).fillna(False) & (df_access['card_id'] == df_access['card_id'].shift(1)) & (time_gap_acc <= 8 * 3600)        
        final_mask_acc = mask_acc_1 | mask_acc_2 | mask_acc_3
        mask_acc_isolated = (df_access['tap_time'].dt.hour.between(0, 4)) & (~final_mask_acc)

        df_access['clocking_date'] = np.where(
            final_mask_acc | mask_acc_isolated, 
            (df_access['tap_time'] - pd.Timedelta(days=1)).dt.strftime('%Y-%m-%d'), 
            df_access['tap_time'].dt.strftime('%Y-%m-%d')
        )        
        df_access = df_access[df_access['clocking_date'].isin(tuple(active_fallback_config.keys()))]

        if not df_access.empty:
            card_to_emp = dict(zip(df_master['master_card_id'], df_master['emp_code']))
            df_access['emp_code'] = df_access['card_id'].map(card_to_emp)
            df_access = df_access.dropna(subset=['emp_code'])

            if not df_access.empty:
                acc_in = df_access[df_access['direction'] == 'IN'].groupby(['emp_code', 'clocking_date'])['tap_time'].min().rename('access_in')
                acc_out = df_access[df_access['direction'] == 'OUT'].groupby(['emp_code', 'clocking_date'])['tap_time'].max().rename('access_out')
                acc_min = df_access.groupby(['emp_code', 'clocking_date'])['tap_time'].min().rename('min_t')
                acc_max = df_access.groupby(['emp_code', 'clocking_date'])['tap_time'].max().rename('max_t')

                acc_summary = pd.concat([acc_in, acc_out, acc_min, acc_max], axis=1).reset_index()
                both_na = acc_summary['access_in'].isna() & acc_summary['access_out'].isna()
                single_tap = both_na & (acc_summary['min_t'] == acc_summary['max_t'])
                multi_tap = both_na & (acc_summary['min_t'] != acc_summary['max_t'])

                single_out = single_tap & (acc_summary['min_t'].dt.hour >= 11)
                single_in = single_tap & (acc_summary['min_t'].dt.hour < 11)

                acc_summary.loc[single_in, 'access_in'] = acc_summary.loc[single_in, 'min_t']
                acc_summary.loc[single_out, 'access_out'] = acc_summary.loc[single_out, 'min_t']
                acc_summary.loc[multi_tap, 'access_in'] = acc_summary.loc[multi_tap, 'min_t']
                acc_summary.loc[multi_tap, 'access_out'] = acc_summary.loc[multi_tap, 'max_t']

                df_access = acc_summary[['emp_code', 'clocking_date', 'access_in', 'access_out']]

    if df_att.empty and df_bac.empty and df_access.empty:
        return (pd.DataFrame(), 0) if as_dataframe else ([] if page is not None else [])

    if not df_att.empty and not df_bac.empty: 
        df_trans = pd.merge(df_att, df_bac, on=['emp_code', 'clocking_date'], how='outer')
    elif not df_att.empty:
        df_trans = df_att.copy()
        for col in ['bac_id', 'bac_no', 'bac_ket', 'bac_in', 'bac_out', 'evidence_photo', 'bac_updated_by', 'bac_updated_date']: df_trans[col] = None
    elif not df_bac.empty:
        df_trans = df_bac.copy()
        for col in ['card_id', 'ta_in', 'ta_out', 'ta_flag', 'terminal_cc_name', 'terminal_cc_code', 'terminal_cc_id']: df_trans[col] = None
    else: 
        df_trans = pd.DataFrame(columns=['emp_code', 'clocking_date'])

    if not df_access.empty: 
        df_trans = pd.merge(df_trans, df_access, on=['emp_code', 'clocking_date'], how='outer')
    else: 
        df_trans['access_in'] = df_trans['access_out'] = None

    if df_trans.empty: 
        return (pd.DataFrame(), 0) if as_dataframe else ([] if page is not None else [])

    df_final = pd.merge(df_master, df_trans, on='emp_code', how='inner')
    df_final = df_final[(df_final['valid_from'] <= df_final['clocking_date']) & 
                        (df_final['valid_to'] >= df_final['clocking_date']) & 
                        (df_final['clocking_date'] >= start_date) & 
                        (df_final['clocking_date'] <= end_date)]
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
        df_final['history_cc_name'] = df_final['history_cc_code'] = df_final['history_cc_id'] = None

    # -------------------------------------------------------------------------
    # TAHAP 4: EXCLUSIONS & RESOLUSI WAKTU EFEKTIF
    # -------------------------------------------------------------------------
    exclusion_dict = {}
    for ex in ex_rows:
        key = f"{str(ex['emp_code']).strip()}_{str(ex['clocking_date'])}"
        if key not in exclusion_dict: exclusion_dict[key] = []
        exclusion_dict[key].append({
            'is_bac_only': 'bac' in str(ex['ex_reason']).lower() if pd.notnull(ex['ex_reason']) else False,
            'ex_time': pd.to_datetime(ex['ex_created_at']) if pd.notna(ex.get('ex_created_at')) else pd.NaT
        })

    if exclusion_dict:
        emp_dates = df_final['emp_code'].astype(str) + "_" + df_final['clocking_date'].astype(str)
        matched_mask = emp_dates.isin(exclusion_dict)
        if matched_mask.any():
            for idx in df_final[matched_mask].index:
                key = emp_dates.loc[idx]
                r_bac_time = pd.to_datetime(df_final.at[idx, 'bac_updated_date']) if pd.notna(df_final.at[idx, 'bac_updated_date']) else pd.NaT
                raw_purged = False
                for ex in exclusion_dict[key]:
                    if not ex['is_bac_only']:
                        df_final.at[idx, 'ta_in'] = df_final.at[idx, 'ta_out'] = None
                        df_final.at[idx, 'access_in'] = df_final.at[idx, 'access_out'] = None
                        raw_purged = True
                    if ex['is_bac_only'] or raw_purged:
                        if pd.notna(r_bac_time) and pd.notna(ex['ex_time']):
                            if ex['ex_time'] > r_bac_time:
                                df_final.at[idx, 'bac_in'] = df_final.at[idx, 'bac_out'] = None
                        elif ex['is_bac_only']:
                            df_final.at[idx, 'bac_in'] = df_final.at[idx, 'bac_out'] = None

    df_final['eff_in'] = df_final['bac_in'].fillna(df_final['ta_in'])
    df_final['eff_out'] = df_final['bac_out'].fillna(df_final['ta_out'])

    # Fallback Access Patching
    df_final['is_patched_by_access'] = False
    if active_fallback_config:
        is_os_worker = df_final['emp_code'].astype(str).str.len() == 5
        date_target = df_final['clocking_date'].map(active_fallback_config).fillna('')
        valid_target = (date_target.isin(['ALL', 'TRUE', '1'])) | ((date_target == 'OS') & is_os_worker) | is_os_worker

        patch_in = valid_target & df_final['eff_in'].isna() & df_final['access_in'].notna()
        patch_out = valid_target & df_final['eff_out'].isna() & df_final['access_out'].notna()
        
        df_final.loc[patch_in, 'eff_in'] = df_final.loc[patch_in, 'access_in']
        df_final.loc[patch_out, 'eff_out'] = df_final.loc[patch_out, 'access_out']
        df_final.loc[patch_in | patch_out, 'is_patched_by_access'] = True

    df_final = df_final[df_final['eff_in'].notna() | df_final['eff_out'].notna()].copy()
    if df_final.empty:
        return (pd.DataFrame(), 0) if as_dataframe else ([] if page is not None else [])

    # Vektorisasi Status
    has_bac = df_final['bac_in'].notna() | df_final['bac_out'].notna()
    pure_access = df_final['is_patched_by_access'] & df_final['ta_in'].isna() & df_final['ta_out'].isna()
    is_lengkap = df_final['eff_in'].notna() & df_final['eff_out'].notna()

    df_final['status'] = np.select([has_bac, pure_access, is_lengkap], ['BAC Found', 'Data Akses', 'Lengkap'], default='Tidak Lengkap')
    df_final['shift'] = determine_shift_vectorized(df_final)

    # Resolusi Cost Center
    m_cc = df_final['history_cc_name'].fillna(df_final['cc_name']).fillna('-')
    m_code = df_final['history_cc_code'].fillna(df_final['dept_code']).fillna('-')
    m_id = df_final['history_cc_id']
    t_cc = df_final['terminal_cc_name']
    t_code = df_final['terminal_cc_code']
    t_id = df_final['terminal_cc_id']

    term_valid = t_cc.notna() & (~t_cc.astype(str).str.strip().str.lower().isin(['', '-', 'none', 'null', 'nan']))
    use_master = (df_final['use_cc'] == 1) | (~term_valid)

    df_final['final_cc_name'] = np.where(use_master, m_cc, t_cc)
    df_final['final_cc_code'] = np.where(use_master, m_code, t_code)
    df_final['final_cc_id'] = np.where(use_master, m_id, t_id)

    # -------------------------------------------------------------------------
    # TAHAP 5: FILTERING & SORTING
    # -------------------------------------------------------------------------
    if status_filter == 'lengkap': df_final = df_final[df_final['status'] == 'Lengkap']
    elif status_filter == 'bac': df_final = df_final[df_final['status'] == 'BAC Found']
    elif status_filter in ('anomali', 'template_revisi'): df_final = df_final[df_final['status'] == 'Tidak Lengkap']
    elif status_filter == 'no_in': df_final = df_final[df_final['eff_in'].isna()]
    elif status_filter == 'no_out': df_final = df_final[df_final['eff_out'].isna()]
    elif status_filter == 'no_both': df_final = df_final[df_final['eff_in'].notna() & df_final['eff_out'].notna()]

    if shift_filter:
        df_final = df_final[df_final['shift'] == shift_filter]

    if department_id and target_dept_aliases:
        alias_set = set(target_dept_aliases)
        match_mask = (
            df_final['final_cc_name'].astype(str).isin(alias_set) |
            df_final['final_cc_code'].astype(str).isin(alias_set) |
            df_final['final_cc_id'].astype(str).isin(alias_set)
        )
        df_final = df_final[match_mask]

    # Urutkan tanggal dan kode karyawan terbaru
    df_final = df_final.sort_values(by=['clocking_date', 'emp_code'], ascending=[False, False])
    total_item = len(df_final)

    if as_dataframe:
        return df_final, total_item

    df_final = df_final.astype(object).replace({np.nan: None, pd.NaT: None})

    # -------------------------------------------------------------------------
    # TAHAP 6: LAZY FORMATTING (HANYA MEMFORMAT 20 BARIS UNTUK UI)
    # -------------------------------------------------------------------------
    if page is not None and pageSize is not None:
        start_idx = (page - 1) * pageSize
        end_idx = start_idx + pageSize
        df_slice = df_final.iloc[start_idx:end_idx].copy()
    else:
        df_slice = df_final.copy()

    formatted_data = []
    for _, r in df_slice.iterrows():
        c_date_obj = datetime.strptime(str(r['clocking_date']), '%Y-%m-%d')
        eff_in, eff_out = r.get('eff_in'), r.get('eff_out')
        t_in, t_out = r.get('ta_in'), r.get('ta_out')
        b_in, b_out = r.get('bac_in'), r.get('bac_out')
        bac_id_val = r.get('bac_id')
        cc_val = r.get('final_cc_name')

        fmt = {
            'employee_id': r['emp_code'], 'employee_code': r['emp_code'], 'employee_name': r['emp_name'], 'gender': r['gender'],
            'subCom': r['sub_company_name'] if pd.notnull(r['sub_company_name']) else '-',
            'card': r.get('card_id') or r['master_card_id'] or '-',
            'cc': cc_val if pd.notnull(cc_val) and str(cc_val).strip().lower() not in ('', '-', 'none', 'null', 'nan') else '-',
            'type': r['emp_type'],
            'raw_ta_in': t_in.strftime('%Y-%m-%d %H:%M:%S') if pd.notnull(t_in) else None,
            'raw_ta_out': t_out.strftime('%Y-%m-%d %H:%M:%S') if pd.notnull(t_out) else None,
            'v_clocking_date': c_date_obj.strftime('%d %b %Y'), 'clocking_date': r['clocking_date'],
            'clock_in': eff_in.strftime('%H:%M') if pd.notnull(eff_in) else 'KOSONG',
            'clock_out': eff_out.strftime('%H:%M') if pd.notnull(eff_out) else 'KOSONG',
            'full_clock_in': eff_in.strftime('%Y-%m-%d %H:%M:%S') if pd.notnull(eff_in) else 'null',
            'full_clock_out': eff_out.strftime('%Y-%m-%d %H:%M:%S') if pd.notnull(eff_out) else 'null',
            'bac_id': None if pd.isna(bac_id_val) else int(bac_id_val),
            'bac_no': r.get('bac_no') if pd.notnull(r.get('bac_no')) else '-',
            'bac_ket': r.get('bac_ket') if pd.notnull(r.get('bac_ket')) else '-',
            'bac_clock_in': b_in.strftime('%Y-%m-%dT%H:%M') if pd.notnull(b_in) else None,
            'bac_clock_out': b_out.strftime('%Y-%m-%dT%H:%M') if pd.notnull(b_out) else None,
            'evidence_photo': r.get('evidence_photo') if pd.notnull(r.get('evidence_photo')) else '',
            'bac_updated_by': r.get('bac_updated_by') if pd.notnull(r.get('bac_updated_by')) else '-',
            'bac_updated_date': r['bac_updated_date'].strftime('%d %b %Y') if pd.notnull(r.get('bac_updated_date')) else '-',
            'status': r['status'],
            'shift': r['shift']
        }
        formatted_data.append(fmt)

    return (formatted_data, total_item) if page is not None else formatted_data

# =============================================================================
# 1. GET LIST ABSENSI (SAT-SET DENGAN LAZY FORMATTING)
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

        paged_rows, total_item = get_absensi_hybrid_data(
            start_date=start_date, end_date=end_date, status_filter=status_filter,
            shift_filter=shift_filter, search=search, sub_company_id=sub_company_id,
            department_id=department_id, worker_type=worker_type,
            page=page, pageSize=pageSize
        )

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
# 2. GET DETAIL BAC TUNGGAL
# =============================================================================
@AbsenOs_bp.route('/absensi/bac/<string:employee_id>/<string:clock_date>', methods=['GET'])
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
# 4. EXPORT EXCEL ULTRA-FAST (ENGINE OPENPYXL DENGAN LEBAR KOLOM STATIS)
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

        df_export, _ = get_absensi_hybrid_data(
            start_date=start_date, end_date=end_date, status_filter=status_filter,
            shift_filter=shift_filter, search=search, sub_company_id=sub_company_id,
            department_id=department_id, worker_type=worker_type,
            as_dataframe=True
        )

        if df_export.empty:
            return jsonify({"status": "error", "message": "Tidak ada data absensi yang sesuai untuk diekspor."}), 404

        # Vektorisasi kolom output (tanpa iterasi Python)
        df_out = pd.DataFrame()
        df_out['Employee ID'] = df_export['emp_code']
        df_out['Nama Karyawan'] = df_export['emp_name'].fillna('-')
        df_out['Gender'] = df_export['gender'].fillna('-')
        df_out['Sub Company'] = df_export['sub_company_name'].fillna('-')
        df_out['Absence Card'] = df_export['card_id'].fillna(df_export['master_card_id']).fillna('-')
        df_out['Cost Center'] = df_export['final_cc_name'].fillna('-')
        df_out['Type'] = df_export['emp_type'].fillna('-')
        df_out['Shift'] = df_export['shift'].fillna('-')
        df_out['Clocking Date'] = pd.to_datetime(df_export['clocking_date']).dt.strftime('%d %b %Y')
        df_out['Clocking In'] = pd.to_datetime(df_export['eff_in']).dt.strftime('%H:%M').fillna('KOSONG')
        df_out['Clocking Out'] = pd.to_datetime(df_export['eff_out']).dt.strftime('%H:%M').fillna('KOSONG')
        df_out['Status'] = df_export['status']
        df_out['Ket BAC'] = df_export['bac_ket'].fillna('-')
        df_out['Updated By'] = df_export['bac_updated_by'].fillna('-')
        df_out['Updated Date'] = pd.to_datetime(df_export['bac_updated_date']).dt.strftime('%d %b %Y').fillna('-')

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
            df_out.to_excel(writer, index=False, sheet_name='Absensi_Karyawan', startrow=1)
            worksheet = writer.sheets['Absensi_Karyawan']
            
            header_font = Font(name='Calibri', size=11, bold=True)
            worksheet['A1'] = header_title
            worksheet['A1'].font = header_font
            
            # Lebar kolom statis (Instant tanpa perulangan sel lambat)
            col_widths = {
                'A': 15, 'B': 26, 'C': 10, 'D': 18, 'E': 16,
                'F': 22, 'G': 15, 'H': 12, 'I': 16, 'J': 14,
                'K': 14, 'L': 15, 'M': 25, 'N': 15, 'O': 16
            }
            for col_letter, width in col_widths.items():
                worksheet.column_dimensions[col_letter].width = width

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
# 5. SOFT DELETE / EXCLUDE ABSENSI
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
# 6. GENERATE EXCEL TEMPLATE MASS UPDATE
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
        
        df['Employee ID'] = df['Employee ID'].str.strip()
        df = df.dropna(subset=['Employee ID'])
        
        excel_emp_ids = df['Employee ID'].unique().tolist()
        excel_dates = df['Tanggal Absen'].str[:10].dropna().unique().tolist()
        
        existing_bacs = BAC_os.query.filter(
            BAC_os.employee_id.in_(excel_emp_ids),
            BAC_os.clock_date.in_(excel_dates)
        ).all()
        
        bac_map = {f"{str(b.employee_id).strip()}_{str(b.clock_date)}": b for b in existing_bacs}

        errors = []
        success_count = 0
        new_records = []

        for index, row in df.iterrows():
            line_number = index + 2
            emp_id_raw = clean_str(row.get('Employee ID'))
            
            try:
                clock_date_raw = clean_str(row.get('Tanggal Absen'))
                if not emp_id_raw or not clock_date_raw:
                    raise ValueError("Kolom 'Employee ID' dan 'Tanggal Absen' tidak boleh kosong.")

                c_in_raw = clean_str(row.get('Clocking In'))
                c_out_raw = clean_str(row.get('Clocking Out'))
                ket_bac = clean_str(row.get('Keterangan BAC'))
                shift_val = clean_str(row.get('Shift')) or ''

                if not c_in_raw and not c_out_raw and not ket_bac:
                    continue

                if not ket_bac:
                    raise ValueError("Kolom 'Keterangan BAC' wajib diisi.")

                final_c_in = None
                if c_in_raw:
                    combined_in = f"{clock_date_raw[:10]} {c_in_raw}"
                    final_c_in = parse_dt(combined_in)
                    if not final_c_in: raise ValueError(f"Format Clocking In ({c_in_raw}) tidak valid.")

                final_c_out = None
                if c_out_raw:
                    combined_out = f"{clock_date_raw[:10]} {c_out_raw}"
                    final_c_out = parse_dt(combined_out)
                    if not final_c_out: raise ValueError(f"Format Clocking Out ({c_out_raw}) tidak valid.")

                    if final_c_in and final_c_out < final_c_in:
                        final_c_out += timedelta(days=1)
                    elif not final_c_in and 'SHIFT 3' in shift_val.upper():
                        if final_c_out.hour <= 15:
                            final_c_out += timedelta(days=1)

                bac_key = f"{emp_id_raw}_{clock_date_raw[:10]}"
                existing_record = bac_map.get(bac_key)
                
                if existing_record:
                    existing_record.bac_no = clean_str(row.get('No BAC'))
                    existing_record.bac_ket = ket_bac
                    existing_record.clock_in = final_c_in
                    existing_record.clock_out = final_c_out
                else:
                    new_bac = BAC_os(
                        employee_id=emp_id_raw,
                        bac_no=clean_str(row.get('No BAC')),
                        bac_ket=ket_bac,
                        clock_date=clock_date_raw[:10],
                        clock_in=final_c_in,
                        clock_out=final_c_out,
                        evidence_photo=None,
                        status=1
                    )
                    new_records.append(new_bac)
                    bac_map[bac_key] = new_bac 

                success_count += 1

            except ValueError as ve:
                errors.append(f"Baris {line_number} (ID {emp_id_raw or '-'}): {str(ve)}")
            except Exception as e:
                errors.append(f"Baris {line_number} (ID {emp_id_raw or '-'}): Gagal memproses - {str(e)}")

        if new_records:
            with db.session.begin_nested():
                db.session.bulk_save_objects(new_records)
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
