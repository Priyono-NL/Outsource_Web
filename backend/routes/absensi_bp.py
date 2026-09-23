import os
from io import BytesIO
from datetime import datetime
import pandas as pd
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_, and_, tuple_, func, cast, String, text
from sqlalchemy.orm import selectinload
from openpyxl.worksheet.datavalidation import DataValidation
from PIL import Image, ImageOps

from extensions import db
from model.absensi_all import Absensi_all
from model.bac_os import BAC_os
from model.vw_master_os import VwMasterOsActive
from model.ob_emp import ObEmployee
from model.hr_models import User, UserSubcompanyAccess, UserCostCenterAccess

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
# REUSABLE HELPER FUNCTIONS (DRY CORE)
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

def process_and_save_bac_evidence(file_storage, target_folder, filename_without_ext, max_width=1000, quality=80):
    try:
        img = Image.open(file_storage)
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        
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
    existing = BAC_os.query.filter_by(
        employee_id=employee_id,
        clock_date=clock_date
    ).first()

    if existing:
        existing.bac_no = bac_no
        existing.bac_ket = bac_ket
        existing.clock_in = clock_in
        existing.clock_out = clock_out
        if evidence_photo:
            existing.evidence_photo = evidence_photo
        return existing, False
    else:
        new_bac = BAC_os(
            employee_id=employee_id,
            bac_no=bac_no,
            bac_ket=bac_ket,
            clock_date=clock_date,
            clock_in=clock_in,
            clock_out=clock_out,
            evidence_photo=evidence_photo,
            status=1
        )
        db.session.add(new_bac)
        return new_bac, True

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
        if 1500 <= jam <= 1900:
            return 'SHIFT 3'
        elif 1000 <= jam <= 1400:
            return 'SHIFT 2'
        else:
            return 'SHIFT 1'
    else:
        if jam >= 2000 or jam < 400:
            return 'SHIFT 3'
        elif 1300 <= jam <= 1700:
            return 'SHIFT 2'
        else:
            return 'SHIFT 1'

# =============================================================================
# HELPER QUERY BUILDER WITH SSO RESTRICTIONS & HYBRID CC OPTIMIZATION
# =============================================================================
def build_filtered_absensi_query(start_date='', end_date='', status_filter='all_data', shift_filter='', search='', sub_company_id='', department_id='', worker_type='all', user_email=''):

    query = db.session.query(Absensi_all).outerjoin(
        BAC_os,
        and_(
            cast(BAC_os.employee_id, String) == cast(Absensi_all.employee_id, String),
            BAC_os.clock_date == Absensi_all.clocking_date,
            BAC_os.status == 1
        )
    ).filter(Absensi_all.card_id != '00000.00000')

    # 1. Filter Tipe Pekerja
    if worker_type == 'os':
        query = query.filter(func.char_length(cast(Absensi_all.employee_id, String)) < 8)
    elif worker_type == 'tetap':
        query = query.filter(func.char_length(cast(Absensi_all.employee_id, String)) >= 8)

    # 2. Filter Rentang Tanggal
    if start_date:
        query = query.filter(Absensi_all.clocking_date >= start_date)
    if end_date:
        query = query.filter(Absensi_all.clocking_date <= end_date)

    # 3. Filter Violation Status
    non_anomaly = or_(Absensi_all.flag_anomaly != 1, Absensi_all.flag_anomaly.is_(None))
    if status_filter == 'lengkap':
        query = query.filter(and_(Absensi_all.clock_in.is_not(None), Absensi_all.clock_out.is_not(None), non_anomaly))
    elif status_filter == 'anomali':
        query = query.filter(Absensi_all.flag_anomaly == 1)
    elif status_filter in ('violation_all', 'tidak_lengkap'):
        query = query.filter(and_(or_(Absensi_all.clock_in.is_(None), Absensi_all.clock_out.is_(None)), non_anomaly))
    elif status_filter == 'no_in':
        query = query.filter(and_(Absensi_all.clock_in.is_(None), Absensi_all.clock_out.is_not(None)))
    elif status_filter == 'no_out':
        query = query.filter(and_(Absensi_all.clock_in.is_not(None), Absensi_all.clock_out.is_(None)))
    elif status_filter == 'no_both':
        query = query.filter(and_(Absensi_all.clock_in.is_(None), Absensi_all.clock_out.is_(None)))

    # 4. FILTER SHIFT KERJA DI LEVEL MYSQL SQL
    if shift_filter in ('SHIFT 1', 'SHIFT 2', 'SHIFT 3'):
        eff_in = func.coalesce(BAC_os.clock_in, Absensi_all.clock_in)
        is_sat = (func.dayofweek(Absensi_all.clocking_date) == 7)
        time_num = (func.hour(eff_in) * 100) + func.minute(eff_in)

        sat_s2 = and_(is_sat, time_num >= 1000, time_num <= 1400)
        sat_s3 = and_(is_sat, time_num >= 1500, time_num <= 1900)
        sat_s1 = and_(is_sat, ~sat_s2, ~sat_s3)

        weekday_s2 = and_(~is_sat, time_num >= 1300, time_num <= 1700)
        weekday_s3 = and_(~is_sat, or_(time_num >= 2000, time_num < 400))
        weekday_s1 = and_(~is_sat, ~weekday_s2, ~weekday_s3)

        if shift_filter == 'SHIFT 2':
            query = query.filter(eff_in.is_not(None), or_(sat_s2, weekday_s2))
        elif shift_filter == 'SHIFT 3':
            query = query.filter(eff_in.is_not(None), or_(sat_s3, weekday_s3))
        elif shift_filter == 'SHIFT 1':
            query = query.filter(or_(eff_in.is_(None), sat_s1, weekday_s1))

    # 5. Restriksi Hak Akses SSO Pengguna
    allowed_subco = []
    allowed_cc = []
    if user_email:
        user = User.query.filter_by(email=user_email).first()
        if user:
            subco_records = UserSubcompanyAccess.query.filter_by(user_id=user.id).all()
            allowed_subco = [a.sub_company_id for a in subco_records]
            cc_records = UserCostCenterAccess.query.filter_by(user_id=user.id).all()
            allowed_cc = [str(c.cost_center_id).strip() for c in cc_records]

    # Pemisahan Dept ID vs CC Codes
    target_dept_ids, target_cc_codes = [], []
    if department_id:
        sql_cc = text("SELECT id, cost_center FROM org_cost_center WHERE id = :dept_id OR cost_center = :dept_id")
        cc_res = db.session.execute(sql_cc, {'dept_id': department_id}).fetchall()
        if cc_res:
            for r in cc_res:
                target_dept_ids.append(str(r[0]).strip())
                target_cc_codes.append(str(r[1]).strip())
        else:
            target_dept_ids.append(str(department_id).strip())
            target_cc_codes.append(str(department_id).strip())

    allowed_dept_ids, allowed_cc_codes = [], []
    if allowed_cc:
        sql_acc = text("SELECT id, cost_center FROM org_cost_center WHERE id IN :acc OR cost_center IN :acc")
        acc_res = db.session.execute(sql_acc, {'acc': tuple(allowed_cc)}).fetchall()
        if acc_res:
            for r in acc_res:
                allowed_dept_ids.append(str(r[0]).strip())
                allowed_cc_codes.append(str(r[1]).strip())
        else:
            allowed_dept_ids = [str(x) for x in allowed_cc]
            allowed_cc_codes = [str(x) for x in allowed_cc]

    final_dept_ids, final_cc_codes = [], []
    if target_dept_ids and allowed_dept_ids:
        final_dept_ids = list(set(target_dept_ids) & set(allowed_dept_ids))
        final_cc_codes = list(set(target_cc_codes) & set(allowed_cc_codes))
        if not final_dept_ids and not final_cc_codes:
            final_dept_ids = ['INVALID_ACCESS']
    elif target_dept_ids:
        final_dept_ids, final_cc_codes = target_dept_ids, target_cc_codes
    elif allowed_dept_ids:
        final_dept_ids, final_cc_codes = allowed_dept_ids, allowed_cc_codes

    has_master_filter = bool(sub_company_id or final_dept_ids or search or allowed_subco or allowed_cc)

    # JIKA TIDAK ADA FILTER MASTER SPESIFIK: Langsung kembalikan kueri transaksi utama (SLA Fast-Path)
    if not has_master_filter:
        return query

    active_ids = []    
    
    if worker_type in ('all', 'os'):
        os_query = db.session.query(
            cast(VwMasterOsActive.emp_id, String),
            cast(VwMasterOsActive.employee_code, String)
        ).filter(VwMasterOsActive.employee_code.is_not(None))

        if sub_company_id == 'TYPE_OS':
            os_query = os_query.filter(VwMasterOsActive.type_company == 'OS')
            if allowed_subco: os_query = os_query.filter(VwMasterOsActive.sub_company_id.in_(allowed_subco))
        elif sub_company_id == 'TYPE_VENDOR':
            os_query = os_query.filter(VwMasterOsActive.type_company == 'Vendor')
            if allowed_subco: os_query = os_query.filter(VwMasterOsActive.sub_company_id.in_(allowed_subco))
        elif sub_company_id:
            if allowed_subco and sub_company_id not in allowed_subco:
                os_query = os_query.filter(db.false())
            else:
                os_query = os_query.filter(VwMasterOsActive.sub_company_id == sub_company_id)
        elif allowed_subco:
            os_query = os_query.filter(VwMasterOsActive.sub_company_id.in_(allowed_subco))

        if search:
            os_query = os_query.filter(or_(
                cast(VwMasterOsActive.emp_id, String).ilike(f"%{search}%"),
                cast(VwMasterOsActive.employee_code, String).ilike(f"%{search}%"),
                VwMasterOsActive.employee_name.ilike(f"%{search}%")
            ))
            
        os_res = os_query.all()
        for r in os_res:
            if r[0]: active_ids.append(str(r[0]).strip())
            if r[1]: active_ids.append(str(r[1]).strip())

    if worker_type in ('all', 'tetap'):
        if not sub_company_id or sub_company_id not in ('TYPE_OS', 'TYPE_VENDOR'):
            ob_query = db.session.query(cast(ObEmployee.employee_id, String)).filter(ObEmployee.employee_id.is_not(None))

            if search:
                ob_query = ob_query.filter(or_(
                    cast(ObEmployee.employee_id, String).ilike(f"%{search}%"),
                    ObEmployee.employee_name.ilike(f"%{search}%"),
                    ObEmployee.card_no.ilike(f"%{search}%")
                ))

            ob_res = ob_query.all()
            for r in ob_res:
                if r[0]: active_ids.append(str(r[0]).strip())

    if search:
        active_ids.append(search.strip())

    if final_dept_ids and final_dept_ids != ['INVALID_ACCESS'] and active_ids:
        group1_ids, group2_ids = [], []
        os_handled = set()

        os_info = db.session.query(
            VwMasterOsActive.employee_code, VwMasterOsActive.use_cc, 
            VwMasterOsActive.org_cc_id, VwMasterOsActive.cost_center_id
        ).filter(VwMasterOsActive.employee_code.in_(active_ids)).all()
        
        for r in os_info:
            eid = str(r.employee_code).strip()
            os_handled.add(eid)
            use_cc = int(r.use_cc or 0)
            if use_cc == 1:
                if (r.org_cc_id is not None and str(r.org_cc_id).strip() in final_dept_ids) or \
                   (r.cost_center_id is not None and str(r.cost_center_id).strip() in final_cc_codes):
                    group1_ids.append(eid)
            else:
                group2_ids.append(eid)

        ob_info = db.session.query(
            cast(ObEmployee.employee_id, String),
            cast(ObEmployee.cost_center, String)
        ).filter(cast(ObEmployee.employee_id, String).in_(active_ids)).all()

        for r in ob_info:
            eid = str(r[0]).strip()
            os_handled.add(eid)
            cc_val = str(r[1]).strip() if r[1] else ''
            
            if cc_val in final_dept_ids or cc_val in final_cc_codes:
                group1_ids.append(eid)
            else:
                group2_ids.append(eid)

        for eid in active_ids:
            if eid not in os_handled:
                group2_ids.append(eid)

        group2_tuples = []
        if group2_ids:
            sql_terminal = text("""
                SELECT DISTINCT ta.employee_id, ta.clocking_date
                FROM `db-webapps`.TBL_ATTENDANCE ta
                LEFT JOIN `db-webapps`.TBL_TACTIVITIES tt_in 
                    ON ta.card_id = tt_in.CARD_ID AND ta.clock_in = tt_in.CLOCKING_DATE
                LEFT JOIN `db-it-andreas`.terminal_master tm_in 
                    ON tm_in.node_id = tt_in.TERMINAL_ID AND tm_in.company_id = '1111'
                LEFT JOIN `db-webapps`.TBL_TACTIVITIES tt_out 
                    ON ta.card_id = tt_out.CARD_ID AND ta.clock_out = tt_out.CLOCKING_DATE
                LEFT JOIN `db-it-andreas`.terminal_master tm_out 
                    ON tm_out.node_id = tt_out.TERMINAL_ID AND tm_out.company_id = '1111'
                WHERE ta.employee_id IN :g2_ids
                  AND (:sd = '' OR ta.clocking_date >= :sd)
                  AND (:ed = '' OR ta.clocking_date <= :ed)
                  AND (
                      (tm_in.org_cc_id IS NOT NULL AND CAST(tm_in.org_cc_id AS CHAR) IN :dept_ids)
                      OR (tm_in.org_cc_id IS NULL AND tm_in.cost_center IN :cc_codes)
                      OR (tm_out.org_cc_id IS NOT NULL AND CAST(tm_out.org_cc_id AS CHAR) IN :dept_ids)
                      OR (tm_out.org_cc_id IS NULL AND tm_out.cost_center IN :cc_codes)
                  )
            """)
            res_terminal = db.session.execute(sql_terminal, {
                'g2_ids': tuple(group2_ids),
                'sd': start_date or '',
                'ed': end_date or '',
                'dept_ids': tuple(str(x) for x in final_dept_ids) if final_dept_ids else ('INVALID_ACCESS',),
                'cc_codes': tuple(str(x) for x in final_cc_codes) if final_cc_codes else ('INVALID_ACCESS',)
            }).fetchall()
            group2_tuples = [(r[0], r[1]) for r in res_terminal]

        filters = []
        if group1_ids:
            filters.append(Absensi_all.employee_id.in_(group1_ids))
        if group2_tuples:
            filters.append(tuple_(Absensi_all.employee_id, Absensi_all.clocking_date).in_(group2_tuples))
            
        if filters:
            query = query.filter(or_(*filters))
        else:
            query = query.filter(db.false()) 

    elif active_ids and final_dept_ids != ['INVALID_ACCESS']:
        filters_search = [Absensi_all.employee_id.in_(active_ids)]
        if search:
            filters_search.append(cast(Absensi_all.employee_id, String).ilike(f"%{search}%"))
            filters_search.append(Absensi_all.card_id.ilike(f"%{search}%"))
        query = query.filter(or_(*filters_search))
    else:
        query = query.filter(db.false())

    return query

# =============================================================================
# HELPER: INJEKSI DINAMIS COST CENTER (OPTIMIZED TERENRICHMENT PERLINDUNGAN SLA)
# =============================================================================
def _enrich_with_dynamic_cc(items):
    final_data = []
    cc_map = {}
    use_cc_map = {}
    master_cc_map = {}
    type_map = {} 
    sub_com_map = {}
    name_map = {}

    if not items:
        return []

    card_ids = tuple(set(str(item.card_id).strip() for item in items if item.card_id))
    dates = tuple(set(str(item.clocking_date) for item in items if item.clocking_date))
    emp_ids = tuple(set(str(item.employee_id).strip() for item in items if item.employee_id))

    if card_ids or emp_ids:
        os_filters = []
        if card_ids: os_filters.append(VwMasterOsActive.card_number.in_(card_ids))
        if emp_ids:  os_filters.append(VwMasterOsActive.employee_code.in_(emp_ids))
        
        os_info = db.session.query(
            VwMasterOsActive.card_number,
            VwMasterOsActive.employee_code,
            VwMasterOsActive.employee_name,
            VwMasterOsActive.use_cc,
            VwMasterOsActive.cc_name,
            VwMasterOsActive.type_worker,
            VwMasterOsActive.sub_company_name
        ).filter(or_(*os_filters)).all()

        for r in os_info:
            val_use_cc = int(getattr(r, 'use_cc', 0) or 0)
            cc_master_name = getattr(r, 'cc_name', None)
            emp_type = getattr(r, 'type_worker', None)
            sub_com = getattr(r, 'sub_company_name', '-')
            emp_name = getattr(r, 'employee_name', None)
            
            if r.card_number:
                card_k = str(r.card_number).strip()
                use_cc_map[card_k] = val_use_cc
                if cc_master_name: master_cc_map[card_k] = cc_master_name
                if emp_type: type_map[card_k] = emp_type
                if emp_name: name_map[card_k] = emp_name
                sub_com_map[card_k] = sub_com
                
            if r.employee_code:
                emp_k = str(r.employee_code).strip()
                use_cc_map[emp_k] = val_use_cc
                if cc_master_name: master_cc_map[emp_k] = cc_master_name
                if emp_type: type_map[emp_k] = emp_type
                if emp_name: name_map[emp_k] = emp_name
                sub_com_map[emp_k] = sub_com

    # Karyawan Tetap (ObEmployee) Selalu Menggunakan Master Cost Center (use_cc = 1)
    if emp_ids:
        ob_info = ObEmployee.query.filter(ObEmployee.employee_id.in_(emp_ids)).all()
        for ob in ob_info:
            emp_k = str(ob.employee_id).strip()
            use_cc_map[emp_k] = 1 
            
            cc_name = ob.cc_master.org_name if ob.cc_master else str(ob.cost_center)
            if cc_name: master_cc_map[emp_k] = cc_name
            if ob.employee_name: name_map[emp_k] = ob.employee_name
            
            type_map[emp_k] = 'Tetap / Kontrak'
            sub_com_map[emp_k] = '-'
            
            if ob.card_no:
                card_k = str(ob.card_no).strip()
                use_cc_map[card_k] = 1 
                if cc_name: master_cc_map[card_k] = cc_name
                if ob.employee_name: name_map[card_k] = ob.employee_name
                type_map[card_k] = 'Tetap / Kontrak'
                sub_com_map[card_k] = '-'

    # PERBAIKAN TIMEOUT: HANYA QUERY TERMINAL UNTUK KARTU YANG use_cc == 0
    needed_card_ids = tuple(set(
        card_k for card_k in card_ids 
        if use_cc_map.get(card_k, 0) == 0
    ))

    if needed_card_ids and dates:
        sql_terminal_cc = """
            SELECT 
                sub.card_id, 
                sub.clocking_date, 
                COALESCE(occ.org_name, sub.raw_cc, 'TIDAK ADA CC') AS terminal_cc
            FROM (
                SELECT 
                    ta.card_id, 
                    ta.clocking_date, 
                    MAX(COALESCE(tm_in.org_cc_id, tm_out.org_cc_id)) AS raw_org_cc_id,
                    MAX(COALESCE(tm_in.cost_center, tm_out.cost_center)) AS raw_cc
                FROM `db-webapps`.TBL_ATTENDANCE ta
                LEFT JOIN `db-webapps`.TBL_TACTIVITIES tt_in ON ta.card_id = tt_in.CARD_ID AND ta.clock_in = tt_in.CLOCKING_DATE
                LEFT JOIN `db-it-andreas`.terminal_master tm_in ON tm_in.node_id = tt_in.TERMINAL_ID AND tm_in.company_id = '1111' AND tm_in.terminal_type = 'Attendance'
                LEFT JOIN `db-webapps`.TBL_TACTIVITIES tt_out ON ta.card_id = tt_out.CARD_ID AND ta.clock_out = tt_out.CLOCKING_DATE
                LEFT JOIN `db-it-andreas`.terminal_master tm_out ON tm_out.node_id = tt_out.TERMINAL_ID AND tm_out.company_id = '1111' AND tm_out.terminal_type = 'Attendance'
                WHERE ta.card_id IN :card_ids AND ta.clocking_date IN :dates
                GROUP BY ta.card_id, ta.clocking_date
            ) sub
            LEFT JOIN org_cost_center occ ON occ.id = sub.raw_org_cc_id OR (sub.raw_org_cc_id IS NULL AND occ.cost_center = sub.raw_cc)
        """
        cc_rows = db.session.execute(text(sql_terminal_cc), {'card_ids': needed_card_ids, 'dates': dates}).mappings().fetchall()
        cc_map = {(str(row['card_id']).strip(), str(row['clocking_date'])): row['terminal_cc'] for row in cc_rows}

    for emp in items:
        emp_dict = emp.to_dict() if hasattr(emp, 'to_dict') else emp.__dict__
        
        card_key = str(getattr(emp, 'card_id', '')).strip()
        emp_key = str(getattr(emp, 'employee_id', '')).strip()
        date_key = str(getattr(emp, 'clocking_date', ''))

        flag_use_cc = use_cc_map.get(card_key, use_cc_map.get(emp_key, 0))
        fallback_master = master_cc_map.get(card_key, master_cc_map.get(emp_key, emp_dict.get('cc', 'TIDAK ADA CC')))

        if flag_use_cc == 1:
            emp_dict['cc'] = fallback_master
            emp_dict['cost_center'] = fallback_master
        else:
            terminal_val = cc_map.get((card_key, date_key))
            if terminal_val and terminal_val != 'TIDAK ADA CC':
                emp_dict['cc'] = terminal_val
                emp_dict['cost_center'] = terminal_val
            else:
                emp_dict['cc'] = fallback_master
                emp_dict['cost_center'] = fallback_master

        emp_dict['employee_name'] = name_map.get(card_key, name_map.get(emp_key, emp_dict.get('employee_name', '-')))
        emp_dict['type'] = type_map.get(card_key, type_map.get(emp_key, emp_dict.get('type', '-')))
        emp_dict['subCom'] = sub_com_map.get(card_key, sub_com_map.get(emp_key, '-'))

        final_data.append(emp_dict)
        
    return final_data

# =============================================================================
# 1. GET LIST ABSENSI
# =============================================================================
@AbsenOs_bp.route('/absensi', methods=['GET'])
def get_absensi():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 20, type=int)

        start_date = request.args.get('start_date', '', type=str)
        end_date = request.args.get('end_date', '', type=str)
        status_filter = request.args.get('status_filter', 'all_data', type=str)
        shift_filter = request.args.get('shift', '', type=str).strip().upper()
        search = request.args.get('search', '', type=str).strip()
        sub_company_id = request.args.get('sub_company', '', type=str).strip()
        department_id = request.args.get('department', '', type=str).strip()
        worker_type = request.args.get('worker_type', 'all', type=str).strip()

        user_email = request.headers.get('X-User-Email', '')

        query = build_filtered_absensi_query(
            start_date=start_date,
            end_date=end_date,
            status_filter=status_filter,
            shift_filter=shift_filter,
            search=search,
            sub_company_id=sub_company_id,
            department_id=department_id,
            worker_type=worker_type,
            user_email=user_email
        )

        query = query.order_by(Absensi_all.clocking_date.desc(), Absensi_all.employee_id.asc())
        pagination = query.paginate(page=page, per_page=pageSize, error_out=False)

        final_data = _enrich_with_dynamic_cc(pagination.items)

        # Merge Data BAC
        existing_keys = set()
        for item in final_data:
            emp_code_val = str(item.get('employee_code') or item.get('employee_id') or '').strip()
            date_val = str(item.get('v_clocking_date') or item.get('clocking_date') or '').strip()
            existing_keys.add((emp_code_val, date_val))
            existing_keys.add((str(item.get('employee_id') or '').strip(), date_val))

        bac_query = BAC_os.query.filter(BAC_os.status == 1)
        if start_date:
            bac_query = bac_query.filter(BAC_os.clock_date >= start_date)
        if end_date:
            bac_query = bac_query.filter(BAC_os.clock_date <= end_date)

        if search:
            matching_os = db.session.query(
                cast(VwMasterOsActive.emp_id, String),
                cast(VwMasterOsActive.employee_code, String)
            ).filter(
                or_(
                    cast(VwMasterOsActive.emp_id, String).ilike(f"%{search}%"),
                    cast(VwMasterOsActive.employee_code, String).ilike(f"%{search}%"),
                    VwMasterOsActive.employee_name.ilike(f"%{search}%")
                )
            ).all()

            search_ids = {search.strip()}
            for m_id, m_code in matching_os:
                if m_id: search_ids.add(str(m_id).strip())
                if m_code: search_ids.add(str(m_code).strip())

            bac_query = bac_query.filter(
                or_(
                    cast(BAC_os.employee_id, String).in_(list(search_ids)),
                    cast(BAC_os.employee_id, String).ilike(f"%{search}%"),
                    BAC_os.bac_no.ilike(f"%{search}%")
                )
            )

        all_bacs = bac_query.all()
        bac_map = {(str(b.employee_id).strip(), str(b.clock_date).strip()): b for b in all_bacs}

        for item in final_data:
            e_id = str(item.get('employee_id') or '').strip()
            e_code = str(item.get('employee_code') or '').strip()
            c_date = str(item.get('v_clocking_date') or item.get('clocking_date') or '').strip()

            matched_bac = bac_map.get((e_id, c_date)) or bac_map.get((e_code, c_date))
            if matched_bac:
                item['bac_id'] = matched_bac.id
                item['bac_no'] = matched_bac.bac_no or '-'
                item['bac_ket'] = matched_bac.bac_ket or '-'
                item['bac_clock_in'] = format_dt(matched_bac.clock_in, iso=True) if matched_bac.clock_in else None
                item['bac_clock_out'] = format_dt(matched_bac.clock_out, iso=True) if matched_bac.clock_out else None
                item['bac_updated_by'] = getattr(matched_bac, 'modified_by', None) or getattr(matched_bac, 'updated_by', None) or '-'
                item['bac_updated_date'] = format_dt(getattr(matched_bac, 'modified_date', None) or getattr(matched_bac, 'updated_date', None))

        for item in final_data:
            effective_in = item.get('bac_clock_in') or item.get('full_clock_in') or item.get('clock_in')
            c_date = item.get('v_clocking_date') or item.get('clocking_date')
            item['shift'] = determine_shift(effective_in, c_date)

        return jsonify({
            "status": "success",
            "data": final_data,
            "total_page": pagination.pages,
            "current_page": page,
            "total_item": pagination.total
        }), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.session.close()

# =============================================================================
# 2. GET DETAIL BAC TUNGGAL
# =============================================================================
@AbsenOs_bp.route('/absensi/bac/<int:employee_id>/<string:clock_date>', methods=['GET'])
def get_bac(employee_id, clock_date):
    try:
        extra_info = BAC_os.query.filter_by(
            employee_id=employee_id,
            clock_date=clock_date
        ).first()

        if not extra_info:
            return jsonify({"clock_in": "", "clock_out": "", "bac_no": "", "bac_ket": ""}), 200

        return jsonify({
            "clock_in": format_dt(extra_info.clock_in, iso=True),
            "clock_out": format_dt(extra_info.clock_out, iso=True),
            "bac_no": extra_info.bac_no or "",
            "bac_ket": extra_info.bac_ket or ""
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.session.close()

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
                    file_storage=file_storage,
                    target_folder=BAC_EVIDENCE_FOLDER,
                    filename_without_ext=base_name,
                    max_width=1000,
                    quality=80
                )

        _, is_created = upsert_bac_record(
            employee_id=emp_id,
            clock_date=clock_date,
            bac_no=clean_str(data.get('bac_no')),
            bac_ket=clean_str(data.get('bac_ket')),
            clock_in=parse_dt(data.get('clock_in')),
            clock_out=parse_dt(data.get('clock_out')),
            evidence_photo=evidence_path
        )

        db.session.commit()
        msg = "BAC Absensi berhasil ditambahkan!" if is_created else "BAC Absensi berhasil diupdate!"
        return jsonify({"status": "success", "message": msg}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.session.close()

# =============================================================================
# 4. GENERATE EXCEL TEMPLATE UNTUK MASS UPDATE
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
        worker_type = request.args.get('worker_type', 'all', type=str).strip()
        user_email = request.headers.get('X-User-Email', '')

        if not start_date_raw or not end_date_raw:
            return jsonify({"status": "error", "message": "Parameter start_date dan end_date wajib diisi."}), 400

        query = build_filtered_absensi_query(
            start_date=start_date_raw,
            end_date=end_date_raw,
            status_filter='template_revisi', 
            shift_filter=shift_filter,
            search=search,
            sub_company_id=sub_company_id,
            department_id=department_id,
            worker_type=worker_type,
            user_email=user_email
        )

        already_revised_subquery = db.session.query(
            BAC_os.employee_id, 
            BAC_os.clock_date
        ).filter(
            BAC_os.employee_id.is_not(None),
            BAC_os.clock_date.is_not(None)
        ).subquery()

        query = query.filter(
            ~tuple_(Absensi_all.employee_id, Absensi_all.clocking_date).in_(already_revised_subquery)
        )

        query_results = query.order_by(Absensi_all.clocking_date.asc(), Absensi_all.employee_id.asc()).all()

        if not query_results:
            return jsonify({"status": "error", "message": "Tidak ditemukan data absensi tidak lengkap pada filter ini."}), 404

        enriched_results = _enrich_with_dynamic_cc(query_results)

        dynamic_data = []
        for d in enriched_results:
            emp_name = d.get('employee_name')
            if not emp_name or str(emp_name).strip() in ('', '-', 'None', 'null'):
                emp_name = d.get('name') or '-'

            effective_in = d.get('full_clock_in') or d.get('clock_in')
            c_date = d.get('v_clocking_date') or d.get('clocking_date')
            row_shift = determine_shift(effective_in, c_date)

            dynamic_data.append({
                "Employee ID": str(d.get('employee_id')),
                "Kode Karyawan": d.get('employee_code') or d.get('employee_id'),
                "Nama Karyawan": emp_name,
                "Sub Company": d.get('subCom') or d.get('sub_company_name') or '-',
                "Cost Center": d.get('cc') or '-',
                "Shift": row_shift,
                "Tanggal Absen": format_dt(c_date, is_time=False),
                "Clocking In": format_dt(d.get('clock_in'), is_time=True) if d.get('clock_in') else 'KOSONG',
                "Clocking Out": format_dt(d.get('clock_out'), is_time=True) if d.get('clock_out') else 'KOSONG',
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
            dv.add(f"K2:K{num_rows + 100}") 

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
    finally:
        db.session.close()

# =============================================================================
# 5. UPLOAD EXCEL MASS UPDATE
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
            'No BAC': str
        })

        errors = []
        success_count = 0

        for index, row in df.iterrows():
            line_number = index + 2
            try:
                with db.session.begin_nested():
                    emp_id_raw = clean_str(row.get('Employee ID'))
                    clock_date_raw = clean_str(row.get('Tanggal Absen'))

                    if not emp_id_raw or not clock_date_raw:
                        raise ValueError("Kolom 'Employee ID' dan 'Tanggal Absen' tidak boleh kosong.")

                    c_in_raw = clean_str(row.get('Clocking In'))
                    c_out_raw = clean_str(row.get('Clocking Out'))
                    ket_bac = clean_str(row.get('Keterangan BAC'))

                    if not c_in_raw and not c_out_raw and not ket_bac:
                        continue

                    if not ket_bac:
                        raise ValueError("Kolom 'Keterangan BAC' wajib diisi.")

                    upsert_bac_record(
                        employee_id=int(emp_id_raw) if emp_id_raw.isdigit() else emp_id_raw,
                        clock_date=clock_date_raw,
                        bac_no=clean_str(row.get('No BAC')),
                        bac_ket=ket_bac,
                        clock_in=parse_dt(c_in_raw),
                        clock_out=parse_dt(c_out_raw)
                    )

                success_count += 1

            except ValueError as ve:
                errors.append(f"Baris {line_number}: {str(ve)}")
            except Exception as e:
                errors.append(f"Baris {line_number}: Gagal memproses data - {str(e)}")

        db.session.commit()

        if success_count > 0:
            status = "success" if not errors else "partial_success"
            msg = f"Berhasil merevisi {success_count} data absensi ke log BAC."
            return jsonify({"status": status, "message": msg, "errors": errors}), 200
        else:
            return jsonify({
                "status": "error",
                "message": "Tidak ada data absensi yang diperbarui. Periksa kembali file Excel Anda.",
                "errors": errors
            }), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Terjadi kesalahan fatal pada server: {str(e)}"}), 500
    finally:
        db.session.close()

# =============================================================================
# 6. EXPORT EXCEL (TERINTEGRASI IN-MEMORY BAC MERGER & FAST ENRICHMENT)
# =============================================================================
@AbsenOs_bp.route('/absensi/export', methods=['GET'])
def export_absensi():
    try:
        start_date = request.args.get('start_date', '', type=str)
        end_date = request.args.get('end_date', '', type=str)
        status_filter = request.args.get('status_filter', 'all_data', type=str)
        shift_filter = request.args.get('shift', '', type=str).strip().upper()
        search = request.args.get('search', '', type=str).strip()
        sub_company_id = request.args.get('sub_company', '', type=str).strip()
        department_id = request.args.get('department', '', type=str).strip()
        worker_type = request.args.get('worker_type', 'all', type=str).strip()
        user_email = request.headers.get('X-User-Email', '')

        # 1. Kueri Transaksi Utama Tanpa Heavy Eager Loading
        query = build_filtered_absensi_query(
            start_date=start_date,
            end_date=end_date,
            status_filter=status_filter,
            shift_filter=shift_filter,
            search=search,
            sub_company_id=sub_company_id,
            department_id=department_id,
            worker_type=worker_type,
            user_email=user_email
        )

        results = query.order_by(Absensi_all.clocking_date.asc(), Absensi_all.employee_id.asc()).all()

        if not results:
            return jsonify({"status": "error", "message": "Tidak ada data absensi yang sesuai untuk diekspor."}), 404

        # 2. Batch Fetch Data BAC secara In-Memory
        bac_query = BAC_os.query.filter(BAC_os.status == 1)
        if start_date:
            bac_query = bac_query.filter(BAC_os.clock_date >= start_date)
        if end_date:
            bac_query = bac_query.filter(BAC_os.clock_date <= end_date)
        
        all_bacs = bac_query.all()
        bac_map = {(str(b.employee_id).strip(), str(b.clock_date).strip()): b for b in all_bacs}

        # 3. Batch Enrichment Per-Chunk
        CHUNK_SIZE = 1000
        enriched_results = []
        for i in range(0, len(results), CHUNK_SIZE):
            chunk = results[i : i + CHUNK_SIZE]
            enriched_chunk = _enrich_with_dynamic_cc(chunk)
            enriched_results.extend(enriched_chunk)

        # 4. Susun Format Data Excel & Merge BAC Data
        excel_data = []
        for d in enriched_results:
            e_id = str(d.get('employee_id') or '').strip()
            e_code = str(d.get('employee_code') or '').strip()
            c_date = str(d.get('v_clocking_date') or d.get('clocking_date') or '').strip()

            matched_bac = bac_map.get((e_id, c_date)) or bac_map.get((e_code, c_date))
            
            bac_in = format_dt(matched_bac.clock_in, iso=True) if (matched_bac and matched_bac.clock_in) else None
            bac_out = format_dt(matched_bac.clock_out, iso=True) if (matched_bac and matched_bac.clock_out) else None
            bac_ket = matched_bac.bac_ket if matched_bac else None
            bac_by = (getattr(matched_bac, 'modified_by', None) or getattr(matched_bac, 'updated_by', None)) if matched_bac else None
            bac_dt = format_dt(getattr(matched_bac, 'modified_date', None) or getattr(matched_bac, 'updated_date', None)) if matched_bac else None

            is_anomaly = d.get('is_anomaly') == 1 or d.get('flag_anomaly') == 1
            has_bac = bool(matched_bac or bac_in or bac_out)

            if bac_in:
                c_in = format_dt(bac_in, is_time=True)
            elif is_anomaly and d.get('full_clock_in') and str(d.get('full_clock_in')).lower() != 'null':
                c_in = format_dt(d.get('full_clock_in'), is_time=True)
            else:
                c_in = format_dt(d.get('clock_in'), is_time=True)

            if bac_out:
                c_out = format_dt(bac_out, is_time=True)
            elif is_anomaly and d.get('full_clock_out') and str(d.get('full_clock_out')).lower() != 'null':
                c_out = format_dt(d.get('full_clock_out'), is_time=True)
            else:
                c_out = format_dt(d.get('clock_out'), is_time=True)

            if has_bac:
                status_str = "BAC Found"
            elif is_anomaly:
                status_str = "Tidak Lengkap"
            elif c_in and c_out and c_in != "KOSONG" and c_out != "KOSONG":
                status_str = "Lengkap"
            else:
                status_str = "BAC Not Found"

            effective_in = bac_in or d.get('full_clock_in') or d.get('clock_in')
            row_shift = determine_shift(effective_in, c_date)

            excel_data.append({
                "Employee ID": d.get('employee_code') or d.get('employee_id'),
                "Nama Karyawan": d.get('employee_name') or '-',
                "Gender": d.get('gender') or '-',
                "Sub Company": d.get('subCom') or d.get('sub_company_name') or '-',
                "Absence Card": d.get('card') or '-',
                "Cost Center": d.get('cc') or '-',  
                "Type": d.get('type') or '-',
                "Shift": row_shift,
                "Clocking Date": format_dt(c_date, is_time=False),
                "Clocking In": c_in if c_in != "KOSONG" else "No Clock In",
                "Clocking Out": c_out if c_out != "KOSONG" else "No Clock Out",
                "Status": status_str,
                "Ket BAC": bac_ket or '-',
                "Updated By": bac_by or '-',
                "Updated Date": bac_dt or '-'
            })

        df = pd.DataFrame(excel_data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Absensi_Karyawan')
        output.seek(0)

        filename_shift_tag = f"_{shift_filter}" if shift_filter else ""
        filename = f"Export_Absensi_{worker_type.upper()}{filename_shift_tag}_{start_date}_to_{end_date}.xlsx" if start_date and end_date else f"Export_Absensi_{worker_type.upper()}{filename_shift_tag}.xlsx"

        return send_file(
            output,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.session.close()