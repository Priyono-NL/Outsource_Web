import pandas as pd
from io import BytesIO
from collections import defaultdict
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import text
from datetime import datetime, timedelta
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from extensions import db
from model.subCompany import SubCompany

AbsenBreak_bp = Blueprint('AbsenBreak_bp', __name__)

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

def determine_shift(time_val, is_saturday):
    if pd.isna(time_val): 
        return 'SHIFT 1'
        
    try:
        if hasattr(time_val, 'hour'):
            jam = time_val.hour * 100 + time_val.minute
        else:
            val_str = str(time_val).strip()
            time_str = val_str.split(' ')[1] if ' ' in val_str else val_str
            time_parts = time_str.split(':')
            jam = int(time_parts[0]) * 100 + int(time_parts[1])
    except Exception:
        return 'SHIFT 1'

    if is_saturday:
        if 600 <= jam <= 1430: return 'SHIFT 1'
        elif 1431 <= jam <= 1959: return 'SHIFT 2'
        else: return 'SHIFT 3'
    else:
        if 600 <= jam <= 1430: return 'SHIFT 1'
        elif 1431 <= jam <= 2059: return 'SHIFT 2'
        else: return 'SHIFT 3'

def fmt_date(dt):
    """Helper formatting Datetime ke String dengan Proteksi NaT"""
    if pd.isna(dt):
        return '-'
    try:
        return dt.strftime('%d-%b-%Y').upper()
    except Exception:
        return '-'

def fmt_time(dt):
    """Helper formatting Datetime ke Time String dengan Proteksi NaT"""
    if pd.isna(dt):
        return '-'
    try:
        return dt.strftime('%H:%M')
    except Exception:
        return '-'

def _build_filters_and_params(start_date, end_date, sub_company_id, department_id, search_text=None, worker_type='all'):
    if not start_date or not end_date:
        raise ValueError("Parameter start_date dan end_date wajib diisi")

    filters = []
    params = {'start_date': start_date, 'end_date': end_date}
    
    if sub_company_id:
        if sub_company_id in ('TYPE_OS', 'TYPE_VENDOR'):
            target_type = 'OS' if sub_company_id == 'TYPE_OS' else 'Vendor'
            sql_sc = text("SELECT sub_company_id FROM sub_company WHERE type_company = :target_type")
            
            # Hit-and-Run Connection
            with db.engine.connect() as conn:
                sc_rows = conn.execute(sql_sc, {'target_type': target_type}).fetchall()
                
            sc_list = [str(r[0]).strip() for r in sc_rows if r[0]]            
            if sc_list:
                in_clause = ", ".join([f"'{sc}'" for sc in sc_list])
                filters.append(f"k.sub_company_id IN ({in_clause})")
            else:
                filters.append("1 = 0") 
        else:
            filters.append("k.sub_company_id = :sub_company_id")
            params['sub_company_id'] = sub_company_id
            
    # FILTER DEPARTMENT TERNORMALISASI
    if department_id:
        sql_cc = text("SELECT id, cost_center, org_name FROM org_cost_center WHERE id = :dept_id OR cost_center = :dept_id OR org_name = :dept_id LIMIT 1")
        with db.engine.connect() as conn:
            cc_res = conn.execute(sql_cc, {'dept_id': department_id}).fetchone()
        
        if cc_res:
            filters.append("(k.cost_center_id IN (:d_id, :d_code, :d_name) OR k.cc_name IN (:d_id, :d_code, :d_name))")
            params['d_id'] = str(cc_res[0])
            params['d_code'] = str(cc_res[1])
            params['d_name'] = str(cc_res[2])
        else:
            filters.append("(k.cost_center_id = :dept_id OR k.cc_name = :dept_id)")
            params['dept_id'] = department_id
            
    if search_text:
        filters.append("(k.emp_id LIKE :search OR k.display_name LIKE :search OR k.card_number LIKE :search)")
        params['search'] = f"%{search_text}%"

    worker_type_clean = (worker_type or 'all').strip().lower()
    if worker_type_clean == 'tetap':
        filters.append("(k.emp_id IS NOT NULL AND CHAR_LENGTH(TRIM(k.emp_id)) > 5)")
    elif worker_type_clean == 'os':
        filters.append("(k.emp_id IS NOT NULL AND TRIM(k.emp_id) != '' AND CHAR_LENGTH(TRIM(k.emp_id)) <= 5)")
        
    filter_clause = " AND " + " AND ".join(filters) if filters else ""
    return filter_clause, params

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
# SINGLE-PASS DATABASE QUERY (UNIFIED AGGREGATION)
# =============================================================================
def _get_unified_clock_data(start_date, end_date, sub_company_id, department_id, search_text=None, worker_type='all'):
    filter_clause, params = _build_filters_and_params(start_date, end_date, sub_company_id, department_id, search_text, worker_type)
    
    # 1. PERPANJANGAN WAKTU UNTUK SHIFT 3
    end_date_obj = datetime.strptime(end_date, '%Y-%m-%d')
    end_date_extended = (end_date_obj + timedelta(days=1)).strftime('%Y-%m-%d')
    
    params['start_dt'] = f"{start_date} 00:00:00"
    params['end_dt'] = f"{end_date_extended} 06:00:00"
    params['start_date_str'] = start_date
    params['end_date_extended_str'] = end_date_extended
    
    # 2. SQL QUERY 1: HANYA MASTER KARYAWAN
    sql_karyawan = f"""
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
        SELECT * FROM Karyawan k WHERE 1=1 {filter_clause}
    """

    # 3. SQL QUERY 2: DATA RAW TRANSAKSI (Bypass View, Langsung Tembak Index Range)
    sql_absen = """
        SELECT CARD_ID, CLOCKING_DATE, DIRECTION, TAGS, TERMINAL_ID 
        FROM vw_tactitives_non_attendance
        WHERE CLOCKING_DATE BETWEEN :start_dt AND :end_dt
          AND (FIND_IN_SET('access', LOWER(TAGS)) > 0 OR FIND_IN_SET('break', LOWER(TAGS)) > 0)
    """

    # 4. SQL QUERY 3: DATA RAW KANTIN
    sql_makan = """
        SELECT EMPLOYEE_ID, TANGGAL_MAKAN, JAM_MAKAN 
        FROM `db-webapps`.`KANTIN_KARYAWAN_MAKAN_TBL`
        WHERE TANGGAL_MAKAN BETWEEN :start_date_str AND :end_date_extended_str
    """

    # ZERO-ZOMBIE POLICY: Tarik Cepat, Tutup Seketika
    with db.engine.connect() as conn:
        df_k = pd.read_sql(text(sql_karyawan), conn, params=params)
        
        # Stop komputasi jika filter UI tidak menemukan karyawan satupun
        if df_k.empty:
            return []

        # Tembak Raw Data Absen & Kantin
        df_a = pd.read_sql(text(sql_absen), conn, params=params)
        df_m = pd.read_sql(text(sql_makan), conn, params=params)

    # =========================================================================
    # IN-MEMORY DATA PROCESSING PANDAS (SLA < 1 Detik)
    # =========================================================================
    
    # Normalisasi Kolom ke Lowercase
    df_k.columns = df_k.columns.str.lower()
    if not df_a.empty:
        df_a.columns = df_a.columns.str.lower()
    if not df_m.empty:
        df_m.columns = df_m.columns.str.lower()

    # Hybrid Pushdown Filter: Buang data transaksi milik karyawan luar filter
    valid_cards = set(df_k['card_number'].dropna())
    valid_emps = set(df_k['emp_id'].dropna())
    
    df_a = df_a[df_a['card_id'].isin(valid_cards)].copy()
    df_m = df_m[df_m['employee_id'].isin(valid_emps)].copy()

    if df_a.empty and df_m.empty:
        return []

    # PANDAS: LOGICAL DATE & TIME EXTRACTOR (Menggeser Waktu Shift 3 ke Hari Sebelumnya)
    if not df_a.empty:
        df_a['clocking_date'] = pd.to_datetime(df_a['clocking_date'])
        df_a['logical_date'] = (df_a['clocking_date'] - pd.Timedelta(hours=4)).dt.strftime('%Y-%m-%d')
        df_a['time_str'] = df_a['clocking_date'].dt.strftime('%H:%M:%S')
        df_a['is_sat'] = df_a['clocking_date'].dt.dayofweek == 5

        # PANDAS: TIME-WINDOW VECTORIZATION (Pengganti CASE WHEN di SQL)
        m_sat1 = (df_a['time_str'] >= '11:00:00') & (df_a['time_str'] <= '15:00:00')
        m_sat2 = (df_a['time_str'] >= '16:00:00') & (df_a['time_str'] <= '19:00:00')
        m_sat3 = (df_a['time_str'] >= '21:00:00') & (df_a['time_str'] <= '23:59:59')
        m_sat_valid = df_a['is_sat'] & (m_sat1 | m_sat2 | m_sat3)

        m_nsat1 = (df_a['time_str'] >= '10:00:00') & (df_a['time_str'] <= '14:00:00')
        m_nsat2 = (df_a['time_str'] >= '16:30:00') & (df_a['time_str'] <= '20:30:00')
        m_nsat3 = (df_a['time_str'] >= '02:00:00') & (df_a['time_str'] <= '06:00:00')
        m_nsat_valid = ~df_a['is_sat'] & (m_nsat1 | m_nsat2 | m_nsat3)

        is_valid_break_time = m_sat_valid | m_nsat_valid

        # PANDAS: DIRECTION & TAGS BOOLEAN MASK
        is_acc = df_a['tags'].str.contains('access', case=False, na=False)
        is_brk = df_a['tags'].str.contains('break', case=False, na=False) & is_valid_break_time
        is_in = df_a['direction'].isin(['IN', '0'])
        is_out = df_a['direction'].isin(['OUT', '1'])

        # Pengurutan WAJIB agar fungsi 'first' dan 'last' sesuai dengan alur waktu (Bypass MAX/MIN Error)
        df_a = df_a.sort_values(['card_id', 'clocking_date'])

        # PANDAS: AGGREGATE EXACT TIMEFRAME & NODE
        df_acc_in = df_a[is_acc & is_in].groupby(['card_id', 'logical_date']).agg(
            access_in_dt=('clocking_date', 'first'), access_node_in=('terminal_id', 'first')).reset_index()

        df_acc_out = df_a[is_acc & is_out].groupby(['card_id', 'logical_date']).agg(
            access_out_dt=('clocking_date', 'last'), access_node_out=('terminal_id', 'last')).reset_index()

        df_brk_out = df_a[is_brk & is_out].groupby(['card_id', 'logical_date']).agg(
            break_out_dt=('clocking_date', 'first'), break_node_out=('terminal_id', 'first')).reset_index()

        df_brk_in = df_a[is_brk & is_in].groupby(['card_id', 'logical_date']).agg(
            break_in_dt=('clocking_date', 'last'), break_node_in=('terminal_id', 'last')).reset_index()
    else:
        df_acc_in = df_acc_out = df_brk_out = df_brk_in = pd.DataFrame()

    # PANDAS: KANTIN PROCESSING
    if not df_m.empty:
        df_m = df_m.dropna(subset=['tanggal_makan']).copy()
        
        dt_tanggal = pd.to_datetime(df_m['tanggal_makan'], errors='coerce')
        df_m = df_m[dt_tanggal.notna()].copy()
        tanggal_str = dt_tanggal.dropna().dt.strftime('%Y-%m-%d')
        
        jam_str = df_m['jam_makan'].astype(str).str.replace(r'.*days?\s+', '', regex=True).str.split('.').str[0]
        df_m['raw_makan_dt'] = pd.to_datetime(tanggal_str + ' ' + jam_str, errors='coerce')
        
        df_m = df_m.dropna(subset=['raw_makan_dt']).copy()
        df_m['logical_date'] = (df_m['raw_makan_dt'] - pd.Timedelta(hours=4)).dt.strftime('%Y-%m-%d')
        
        df_m_agg = df_m.groupby(['employee_id', 'logical_date']).agg(
            raw_makan_dt=('raw_makan_dt', 'min')
        ).reset_index()
    else:
        df_m_agg = pd.DataFrame()

    # =========================================================================
    # PANDAS SPINE MERGE (Penyatuan Tulang Punggung Tabel)
    # =========================================================================
    
    # 1. Kumpulkan semua pasangan unik Karyawan <-> Tanggal Logis yang memiliki aktivitas
    spines = []
    if not df_acc_in.empty: spines.append(df_acc_in[['card_id', 'logical_date']])
    if not df_acc_out.empty: spines.append(df_acc_out[['card_id', 'logical_date']])
    if not df_brk_out.empty: spines.append(df_brk_out[['card_id', 'logical_date']])
    if not df_brk_in.empty: spines.append(df_brk_in[['card_id', 'logical_date']])
    
    df_spine_a = pd.concat(spines).drop_duplicates() if spines else pd.DataFrame(columns=['card_id', 'logical_date'])
    
    # Hubungkan Card_id milik Absen ke Emp_id Karyawan
    if not df_spine_a.empty:
        df_spine_a = pd.merge(df_spine_a, df_k[['card_number', 'emp_id']], left_on='card_id', right_on='card_number', how='inner')
        df_spine_a = df_spine_a[['emp_id', 'card_id', 'logical_date']]
    
    # Hubungkan Emp_id milik Kantin ke Card_id Karyawan
    if not df_m_agg.empty:
        df_spine_m = df_m_agg[['employee_id', 'logical_date']].rename(columns={'employee_id': 'emp_id'})
        df_spine_m = pd.merge(df_spine_m, df_k[['emp_id', 'card_number']], on='emp_id', how='inner')
        df_spine_m = df_spine_m.rename(columns={'card_number': 'card_id'})[['emp_id', 'card_id', 'logical_date']]
    else:
        df_spine_m = pd.DataFrame(columns=['emp_id', 'card_id', 'logical_date'])

    # Gabungkan Tulang Punggung
    df_spine = pd.concat([df_spine_a, df_spine_m]).drop_duplicates()
    
    # Filter Mutlak: Pastikan kita hanya menampilkan rentang tanggal Logical yang diminta User
    df_spine = df_spine[(df_spine['logical_date'] >= start_date) & (df_spine['logical_date'] <= end_date)]

    if df_spine.empty:
        return []

    # 2. RENDER MASTER TABLE
    # Base spine di-join (VLOOKUP) dengan Karyawan, Access, Break, dan Kantin
    df_final = pd.merge(df_spine, df_k, on=['emp_id'], how='left')
    
    if not df_acc_in.empty: df_final = pd.merge(df_final, df_acc_in, on=['card_id', 'logical_date'], how='left')
    if not df_acc_out.empty: df_final = pd.merge(df_final, df_acc_out, on=['card_id', 'logical_date'], how='left')
    if not df_brk_out.empty: df_final = pd.merge(df_final, df_brk_out, on=['card_id', 'logical_date'], how='left')
    if not df_brk_in.empty: df_final = pd.merge(df_final, df_brk_in, on=['card_id', 'logical_date'], how='left')
    if not df_m_agg.empty: df_final = pd.merge(df_final, df_m_agg, left_on=['emp_id', 'logical_date'], right_on=['employee_id', 'logical_date'], how='left')

    # =========================================================================
    # PANDAS: HYBRID NODE CLASH PROTECTOR
    # =========================================================================
    
    if 'break_in_dt' in df_final.columns and 'access_in_dt' in df_final.columns:
        mask_in_clash = df_final['break_in_dt'] == df_final['access_in_dt']
        df_final.loc[mask_in_clash, ['break_in_dt', 'break_node_in']] = [pd.NaT, None]
        
    if 'break_out_dt' in df_final.columns and 'access_out_dt' in df_final.columns:
        mask_out_clash = df_final['break_out_dt'] == df_final['access_out_dt']
        df_final.loc[mask_out_clash, ['break_out_dt', 'break_node_out']] = [pd.NaT, None]

    # Pastikan struktur Dictionary lengkap sekalipun pandas belum sempat membentuk kolom
    expected_cols = [
        'access_in_dt', 'access_out_dt', 'access_node_in', 'access_node_out',
        'break_out_dt', 'break_in_dt', 'break_node_out', 'break_node_in', 'raw_makan_dt'
    ]
    for col in expected_cols:
        if col not in df_final.columns:
            df_final[col] = None

    # Cleaning Akhir (Ubah DataFrame NaT menjadi Standard Null/None Python)
    df_final = df_final.astype(object).where(pd.notnull(df_final), None)
    df_final.rename(columns={'logical_date': 'ref_date'}, inplace=True)
    
    return df_final.to_dict(orient='records')

# =============================================================================
# DATA PROCESSORS (MAPPING PYTHON)
# =============================================================================
def get_break_area(node_id):
    if not node_id: return "-"
    node_str = str(node_id).split('-')[-1]
    if node_str in ('161', '162'): return 'Access Loker 94'
    if node_str in ('166', '167'): return 'Access Loker Garuda'
    if node_str in ('191', '192'): return 'Access Gerbang Biru'
    if node_str in ('188', '189'): return 'Access 86'
    if node_str in ('175', '173'): return 'Access Gerbang 92'
    if node_str in ('114', '115', '215', '216'): return 'Access Bike'
    return f"Node {node_str}"

def get_access_area(node_id):
    if not node_id: return "-"
    node_str = str(node_id).split('-')[-1]
    if node_str in ('188', '189'): return 'Access 86'
    if node_str in ('173', '175'): return 'Access 92'
    if node_str in ('111', '112', '113', '114', '115', '215', '219', '116', '117', '118'): return 'Access 94'
    return f"Node {node_str}"

def _get_break_data(start_date, end_date, sub_company_id, department_id, search_text=None, status_filter='all_data', shift_filter='', worker_type='all'):
    raw_rows = _get_unified_clock_data(start_date, end_date, sub_company_id, department_id, search_text, worker_type)
    report_data = []
    seen_records = set()

    for row in raw_rows:
        if row.get('break_out_dt') is None and row.get('break_in_dt') is None and row.get('raw_makan_dt') is None:
            continue

        unique_key = f"{row['emp_id']}_{row['ref_date']}"        
        if unique_key in seen_records:
            continue

        out_dt = row.get('break_out_dt')
        in_dt = row.get('break_in_dt')
        makan_dt = row.get('raw_makan_dt')

        start_break_dt = out_dt if pd.notna(out_dt) else makan_dt
        ref_shift_dt = start_break_dt if pd.notna(start_break_dt) else row.get('access_in_dt')
        is_saturday = (datetime.strptime(str(row['ref_date']), "%Y-%m-%d").weekday() == 5)
        detected_shift = determine_shift(ref_shift_dt, is_saturday)

        if shift_filter and shift_filter not in ('ALL_DATA', 'ALL', 'SEMUA'):
            if detected_shift != shift_filter:
                continue

        def is_valid_break_window(dt, shift, is_sat):
            if pd.isna(dt): return False
            t_str = dt.strftime('%H:%M:%S')
            if is_sat:
                if shift == 'SHIFT 1' and '11:00:00' <= t_str <= '15:00:00': return True
                if shift == 'SHIFT 2' and '16:00:00' <= t_str <= '19:00:00': return True
                if shift == 'SHIFT 3' and ('21:00:00' <= t_str <= '23:59:59' or '00:00:00' <= t_str <= '01:00:00'): return True
            else:
                if shift == 'SHIFT 1' and '10:00:00' <= t_str <= '14:00:00': return True
                if shift == 'SHIFT 2' and '16:30:00' <= t_str <= '20:30:00': return True
                if shift == 'SHIFT 3' and '02:00:00' <= t_str <= '06:00:00': return True
            return False

        if pd.notna(out_dt) and not is_valid_break_window(out_dt, detected_shift, is_saturday):
            out_dt = pd.NaT
            row['break_node_out'] = None
        if pd.notna(in_dt) and not is_valid_break_window(in_dt, detected_shift, is_saturday):
            in_dt = pd.NaT
            row['break_node_in'] = None

        if pd.isna(out_dt) and pd.isna(in_dt) and pd.isna(makan_dt):
            continue

        start_break_dt = out_dt if pd.notna(out_dt) else makan_dt
        
        # 3. PERHITUNGAN STATUS & MENIT
        total_mins = 0
        status = "Lengkap (Normal)"
        
        if pd.isna(start_break_dt) and pd.isna(in_dt):
            status = "Tidak Lengkap (No Both)"
        elif pd.isna(start_break_dt):
            status = "Tidak Lengkap (No OUT)"
        elif pd.isna(in_dt):
            status = "Tidak Lengkap (No IN)"
        else:
            diff_seconds = (in_dt - start_break_dt).total_seconds()
            calculated_mins = int(diff_seconds // 60)
            
            if calculated_mins <= 0:
                status = "Tidak Lengkap (Invalid Duration)"
                total_mins = 0
            else:
                total_mins = calculated_mins
                if total_mins > 90: status = "> 90 Menit"
                elif total_mins >= 65: status = "> 65 Menit"
                elif total_mins > 60: status = "> 60 Menit"

        if status_filter != 'all_data':
            if status_filter == 'lengkap' and status != 'Lengkap (Normal)': continue
            elif status_filter == 'tidak_lengkap' and not status.startswith('Tidak Lengkap'): continue
            elif status_filter == 'over60' and total_mins <= 60: continue
            elif status_filter == 'over65' and total_mins < 65: continue
            elif status_filter == 'over90' and total_mins <= 90: continue

        seen_records.add(unique_key)
        report_data.append({
            "emp_id": row['emp_id'], 
            "display_name": row['display_name'] or '-',
            "sub_company_name": row['sub_company_name'] or '-',
            "tipe_karyawan": row['tipe_karyawan'] or '-',
            "cc_name": row['cc_name'] or '-',
            "card_number": row['card_number'] or '-', 
            "shift": detected_shift,
            "tanggal_out": fmt_date(out_dt),
            "waktu_out": fmt_time(out_dt),
            "node_out": get_break_area(row['break_node_out']),
            "tanggal_makan": fmt_date(makan_dt),
            "waktu_makan": fmt_time(makan_dt),
            "tanggal_in": fmt_date(in_dt),
            "waktu_in": fmt_time(in_dt),
            "node_in": get_break_area(row['break_node_in']),
            "total": total_mins, 
            "status": status
        })

    return report_data

def _get_access_data(start_date, end_date, sub_company_id, department_id, search_text=None, shift_filter='', worker_type='all'):
    raw_rows = _get_unified_clock_data(start_date, end_date, sub_company_id, department_id, search_text, worker_type)
    report_data = []
    seen_records = set()
    
    for row in raw_rows:
        # Abaikan jika data mutlak kosong di ranah Access (hanya ada tap Break)
        if row['access_in_dt'] is None and row['access_out_dt'] is None:
            continue

        unique_key = f"{row['emp_id']}_{row['ref_date']}"        
        if unique_key in seen_records:
            continue

        in_dt = row['access_in_dt']
        out_dt = row['access_out_dt']

        is_saturday = (datetime.strptime(str(row['ref_date']), "%Y-%m-%d").weekday() == 5)
        ref_time = in_dt if in_dt else out_dt
        detected_shift = determine_shift(ref_time, is_saturday)

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
            "shift": detected_shift,
            "tanggal_in": fmt_date(in_dt),
            "waktu_in": fmt_time(in_dt),
            "node_in": get_access_area(row['access_node_in']),
            "tanggal_out": fmt_date(out_dt),
            "waktu_out": fmt_time(out_dt),
            "node_out": get_access_area(row['access_node_out'])
        })

    return report_data

def _get_summary_break_data(start_date, end_date):
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
        worker_type = request.args.get('worker_type', '').strip() or request.args.get('workerType', '').strip() or 'all'
        report_data = _get_break_data(
            request.args.get('start_date', '').strip(), 
            request.args.get('end_date', '').strip(),
            request.args.get('sub_company_id', '').strip() or request.args.get('sub_company', '').strip(),
            request.args.get('department_id', '').strip() or request.args.get('department', '').strip(),
            request.args.get('search', '').strip(),
            request.args.get('status_filter', 'all_data').strip(),
            request.args.get('shift', '').strip().upper(),
            worker_type
        )
        return jsonify(_paginate_data(report_data, int(request.args.get('page', 1)), int(request.args.get('pageSize', 10)))), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400 if isinstance(e, ValueError) else 500

@AbsenBreak_bp.route('/reportAccess')
def reportAccess():
    try:
        worker_type = request.args.get('worker_type', '').strip() or request.args.get('workerType', '').strip() or 'all'
        report_data = _get_access_data(
            request.args.get('start_date', '').strip(), 
            request.args.get('end_date', '').strip(),
            request.args.get('sub_company_id', '').strip() or request.args.get('sub_company', '').strip(),
            request.args.get('department_id', '').strip() or request.args.get('department', '').strip(),
            request.args.get('search', '').strip(),
            request.args.get('shift', '').strip().upper(),
            worker_type
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
        shift_filter = request.args.get('shift', '').strip().upper()
        worker_type = request.args.get('worker_type', '').strip() or request.args.get('workerType', '').strip() or 'all'

        report_data = _get_break_data(start, end, sub_comp, dept, search, status_filter, shift_filter, worker_type)

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
                    if len(val_str) > max_len: max_len = len(val_str)
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
        shift_filter = request.args.get('shift', '').strip().upper()
        worker_type = request.args.get('worker_type', '').strip() or request.args.get('workerType', '').strip() or 'all'
        
        report_data = _get_access_data(start, end, sub_comp, dept, search, shift_filter, worker_type)

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
                    if len(val_str) > max_len: max_len = len(val_str)
                ws.column_dimensions[col_letter].width = max(max_len + 4, 13)

        output.seek(0)
        file_name = f"Access_Clocking_Report_{start}.xlsx" if start == end else f"Access_Clocking_Report_{start}_to_{end}.xlsx"
        return send_file(output, as_attachment=True, download_name=file_name)
    except Exception as e: 
        return jsonify({"status": "error", "message": str(e)}), 500

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
            
            # TABLE 1: REVIEW BY TOTAL EMPLOYEES
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
            
            # TABLE 2: REVIEW BY TOTAL DAYS
            current_row = 5 + len(df_emp_rows) + 3
            
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
                
            for col in ws.columns:
                ws.column_dimensions[col[0].column_letter].width = 18
                
        output.seek(0)
        file_name = f"Summary_Break_Report_{start}_to_{end}.xlsx"
        return send_file(output, as_attachment=True, download_name=file_name)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500