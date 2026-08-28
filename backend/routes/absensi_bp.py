from io import BytesIO
from datetime import datetime
import pandas as pd
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_, and_, tuple_, func, cast, String, text, collate
from openpyxl.worksheet.datavalidation import DataValidation

from extensions import db
from model.absensi_all import Absensi_all
from model.bac_os import BAC_os
from model.vw_master_os import VwMasterOsActive

AbsenOs_bp = Blueprint('AbsenOs_bp', __name__)

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

def upsert_bac_record(employee_id, clock_date, bac_no, bac_ket, clock_in, clock_out):
    existing = BAC_os.query.filter_by(
        employee_id=employee_id,
        clock_date=clock_date
    ).first()

    if existing:
        existing.bac_no = bac_no
        existing.bac_ket = bac_ket
        if clock_in is not None: 
            existing.clock_in = clock_in
        if clock_out is not None: 
            existing.clock_out = clock_out
        return existing, False
    else:
        new_bac = BAC_os(
            employee_id=employee_id,
            bac_no=bac_no,
            bac_ket=bac_ket,
            clock_date=clock_date,
            clock_in=clock_in,
            clock_out=clock_out,
            status=1
        )
        db.session.add(new_bac)
        return new_bac, True

def build_filtered_absensi_query(start_date='', end_date='', status_filter='all_data', search='', sub_company_id=''):
    query = Absensi_all.query.filter(
        func.char_length(cast(Absensi_all.employee_id, String)) < 8,
        Absensi_all.card_id != '00000.00000'
    )

    if start_date:
        query = query.filter(Absensi_all.clocking_date >= start_date)
    if end_date:
        query = query.filter(Absensi_all.clocking_date <= end_date)

    # NULL-safe Anomaly Condition
    non_anomaly = or_(Absensi_all.flag_anomaly != 1, Absensi_all.flag_anomaly.is_(None))

    if status_filter == 'lengkap':
        query = query.filter(and_(
            Absensi_all.clock_in.is_not(None),
            Absensi_all.clock_out.is_not(None),
            non_anomaly
        ))
    elif status_filter == 'anomali':
        query = query.filter(Absensi_all.flag_anomaly == 1)
    elif status_filter in ('violation_all', 'tidak_lengkap'):
        query = query.filter(and_(
            or_(Absensi_all.clock_in.is_(None), Absensi_all.clock_out.is_(None)),
            non_anomaly
        ))
    elif status_filter == 'no_in':
        query = query.filter(and_(
            Absensi_all.clock_in.is_(None),
            Absensi_all.clock_out.is_not(None)
        ))
    elif status_filter == 'no_out':
        query = query.filter(and_(
            Absensi_all.clock_in.is_not(None),
            Absensi_all.clock_out.is_(None),
        ))
    elif status_filter == 'no_both':
        query = query.filter(and_(
            Absensi_all.clock_in.is_(None),
            Absensi_all.clock_out.is_(None)
        ))

    # =====================================================================
    # UPDATE: FILTER KARYAWAN AKTIF (Selalu Dijalankan via Subquery MySQL)
    # =====================================================================
    os_query = db.session.query(collate(VwMasterOsActive.employee_code, 'utf8mb4_general_ci'))
    
    if sub_company_id:
        os_query = os_query.filter(VwMasterOsActive.sub_company_id == sub_company_id)
        
    if search:
        os_query = os_query.filter(or_(
            VwMasterOsActive.employee_code.ilike(f"%{search}%"),
            VwMasterOsActive.employee_name.ilike(f"%{search}%"),
            VwMasterOsActive.card_number.ilike(f"%{search}%")
        ))

    # Eksekusi filter IN menggunakan SubQuery (Jauh lebih cepat dari list matched_ids)
    if search:
        query = query.filter(or_(
            Absensi_all.employee_id.in_(os_query),
            Absensi_all.card_id.ilike(f"%{search}%")
        ))
    else:
        query = query.filter(Absensi_all.employee_id.in_(os_query))

    return query


# =============================================================================
# HELPER: INJEKSI DINAMIS COST CENTER (NODE ID vs MASTER)
# =============================================================================
def _enrich_with_dynamic_cc(items):
    final_data = []
    cc_map = {}
    use_cc_map = {}
    master_cc_map = {}

    if not items:
        return []

    card_ids = tuple(set(str(item.card_id).strip() for item in items if item.card_id))
    dates = tuple(set(str(item.clocking_date) for item in items if item.clocking_date))
    emp_ids = tuple(set(str(item.employee_id).strip() for item in items if item.employee_id))

    # 1. Lookup Flag use_cc & Master Cost Center Name dari VwMasterOsActive
    if card_ids or emp_ids:
        os_filters = []
        if card_ids: os_filters.append(VwMasterOsActive.card_number.in_(card_ids))
        if emp_ids:  os_filters.append(VwMasterOsActive.employee_code.in_(emp_ids))
        
        os_info = db.session.query(
            VwMasterOsActive.card_number,
            VwMasterOsActive.employee_code,
            VwMasterOsActive.use_cc,
            VwMasterOsActive.cc_name
        ).filter(or_(*os_filters)).all()

        for r in os_info:
            val_use_cc = int(getattr(r, 'use_cc', 0) or 0)
            cc_master_name = getattr(r, 'cc_name', None)
            
            if r.card_number:
                card_k = str(r.card_number).strip()
                use_cc_map[card_k] = val_use_cc
                if cc_master_name: master_cc_map[card_k] = cc_master_name
            if r.employee_code:
                emp_k = str(r.employee_code).strip()
                use_cc_map[emp_k] = val_use_cc
                if cc_master_name: master_cc_map[emp_k] = cc_master_name

    # 2. Query Terminal CC dari Lokasi Tapping (TBL_TACTIVITIES)
    if card_ids and dates:
        sql_terminal_cc = """
            SELECT 
                sub.card_id, sub.clocking_date, COALESCE(occ.org_name, sub.raw_cc, 'TIDAK ADA CC') AS terminal_cc
            FROM (
                SELECT 
                    ta.card_id, ta.clocking_date, MAX(COALESCE(tm_in.cost_center, tm_out.cost_center)) AS raw_cc
                FROM `db-webapps`.TBL_ATTENDANCE ta
                LEFT JOIN `db-webapps`.TBL_TACTIVITIES tt_in ON ta.card_id = tt_in.CARD_ID AND ta.clock_in = tt_in.CLOCKING_DATE
                LEFT JOIN `db-it-andreas`.terminal_master tm_in ON tm_in.node_id COLLATE utf8mb4_general_ci = tt_in.TERMINAL_ID AND tm_in.company_id = '1111' AND tm_in.terminal_type = 'Attendance'
                LEFT JOIN `db-webapps`.TBL_TACTIVITIES tt_out ON ta.card_id = tt_out.CARD_ID AND ta.clock_out = tt_out.CLOCKING_DATE
                LEFT JOIN `db-it-andreas`.terminal_master tm_out ON tm_out.node_id COLLATE utf8mb4_general_ci = tt_out.TERMINAL_ID AND tm_out.company_id = '1111' AND tm_out.terminal_type = 'Attendance'
                WHERE ta.card_id IN :card_ids AND ta.clocking_date IN :dates
                GROUP BY ta.card_id, ta.clocking_date
            ) sub
            LEFT JOIN org_cost_center occ ON occ.cost_center COLLATE utf8mb4_general_ci = sub.raw_cc
        """
        cc_rows = db.session.execute(text(sql_terminal_cc), {'card_ids': card_ids, 'dates': dates}).mappings().fetchall()
        cc_map = {(str(row['card_id']).strip(), str(row['clocking_date'])): row['terminal_cc'] for row in cc_rows}

    # 3. Penentuan Output Berdasarkan Flag use_cc
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
        search = request.args.get('search', '', type=str).strip()
        sub_company_id = request.args.get('sub_company', '', type=str).strip()

        query = build_filtered_absensi_query(
            start_date=start_date,
            end_date=end_date,
            status_filter=status_filter,
            search=search,
            sub_company_id=sub_company_id
        )

        query = query.order_by(Absensi_all.clocking_date.desc(), Absensi_all.employee_id.asc())
        pagination = query.paginate(page=page, per_page=pageSize, error_out=False)

        # =====================================================================
        # [DEBUG LOGGER] REKONSILIASI OS DETAIL ABSENSI (TABEL)
        # =====================================================================
        print(f"\n[DEBUG - DETAIL ABSENSI (TABEL)] === PERIODE: {start_date} s/d {end_date} ===")
        print(f"-> Filter Status  : {status_filter}")
        print(f"-> Pencarian Teks : '{search}' | Sub Company: '{sub_company_id}'")
        print(f"-> Total Data OS Ditemukan: {pagination.total} records")
        print(f"==================================================================\n")

        # Suntikkan dynamic CC (Node ID vs Master CC)
        final_data = _enrich_with_dynamic_cc(pagination.items)

        return jsonify({
            "status": "success",
            "data": final_data,
            "total_page": pagination.pages,
            "current_page": pagination.page,
            "total_item": pagination.total
        }), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# =============================================================================
# 2. GET DETAIL BAC TUNGGAL
# =============================================================================
@AbsenOs_bp.route('/absensi/bac/<int:employee_id>/<string:clock_date>', methods=['GET'])
def get_bac(employee_id, clock_date):
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

# =============================================================================
# 3. SAVE / UPDATE BAC TUNGGAL (FORM MODAL REACT)
# =============================================================================
@AbsenOs_bp.route('/absensi/bac', methods=['PUT', 'POST'])
def update_bac():
    try:
        data = request.json or {}
        employee_id = data.get('employee_id')
        clock_date = data.get('clock_date')

        if not employee_id or not clock_date:
            return jsonify({"status": "error", "message": "employee_id dan clock_date wajib diisi."}), 400

        _, is_created = upsert_bac_record(
            employee_id=employee_id,
            clock_date=clock_date,
            bac_no=clean_str(data.get('bac_no')),
            bac_ket=clean_str(data.get('bac_ket')),
            clock_in=parse_dt(data.get('clock_in')),
            clock_out=parse_dt(data.get('clock_out'))
        )

        db.session.commit()
        msg = "BAC Absensi berhasil ditambahkan!" if is_created else "BAC Absensi berhasil diupdate!"
        return jsonify({"status": "success", "message": msg}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# =============================================================================
# 4. GENERATE EXCEL TEMPLATE UNTUK MASS UPDATE
# =============================================================================
@AbsenOs_bp.route('/absensi/template', methods=['GET'])
def template():
    try:
        start_date_raw = request.args.get('start_date')
        end_date_raw = request.args.get('end_date')

        if not start_date_raw or not end_date_raw:
            return jsonify({"status": "error", "message": "Parameter start_date dan end_date wajib diisi."}), 400

        already_revised_subquery = db.session.query(
            BAC_os.employee_id, 
            BAC_os.clock_date
        ).subquery()

        query_results = Absensi_all.query.filter(
            func.char_length(cast(Absensi_all.employee_id, String)) < 8,
            Absensi_all.clocking_date >= start_date_raw,
            Absensi_all.clocking_date <= end_date_raw,
            or_(Absensi_all.clock_in.is_(None), Absensi_all.clock_out.is_(None)),
            ~tuple_(Absensi_all.employee_id, Absensi_all.clocking_date).in_(already_revised_subquery)
        ).order_by(Absensi_all.clocking_date.asc(), Absensi_all.employee_id.asc()).all()

        if not query_results:
            return jsonify({"status": "error", "message": "Tidak ditemukan data absensi tidak lengkap pada periode ini."}), 404

        dynamic_data = []
        for att in query_results:
            row_dict = att.to_dict()
            dynamic_data.append({
                "Employee ID": att.employee_id,
                "Kode Karyawan": row_dict.get('employee_code'),
                "Nama Karyawan": row_dict.get('employee_name') or '-',
                "Tanggal Absen": format_dt(att.clocking_date, is_time=False),
                "Clocking In": format_dt(att.clock_in, is_time=True),
                "Clocking Out": format_dt(att.clock_out, is_time=True),
                "No BAC": "",
                "Keterangan BAC": ""
            })

        df = pd.DataFrame(dynamic_data)
        num_rows = len(df) + 1

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Template_Import_Revisi')
            worksheet = writer.sheets['Template_Import_Revisi']

            list_pilihan = '"Kartu Ketinggalan,Kartu Belum Diterima,Kartu Error,Karyawan Lupa Clocking"'
            dv = DataValidation(type="list", formula1=list_pilihan, allow_blank=True)
            dv.error = 'Mohon pilih keterangan yang tersedia pada list dropdown.'
            dv.errorTitle = 'Pilihan Tidak Valid'

            worksheet.add_data_validation(dv)
            dv.add(f"H2:H{num_rows + 100}")

        output.seek(0)
        return send_file(
            output,
            as_attachment=True,
            download_name=f"Template_Mass_Update_Absen_{start_date_raw}_to_{end_date_raw}.xlsx"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

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

                    if not c_in_raw and not c_out_raw:
                        continue

                    if not ket_bac:
                        raise ValueError("Kolom 'Keterangan BAC' wajib diisi.")

                    upsert_bac_record(
                        employee_id=int(emp_id_raw),
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

# =============================================================================
# 6. EXPORT EXCEL (FILTERED DATA)
# =============================================================================
@AbsenOs_bp.route('/absensi/export', methods=['GET'])
def export_absensi():
    try:
        start_date = request.args.get('start_date', '', type=str)
        end_date = request.args.get('end_date', '', type=str)
        status_filter = request.args.get('status_filter', 'all_data', type=str)
        search = request.args.get('search', '', type=str).strip()
        sub_company_id = request.args.get('sub_company', '', type=str).strip()

        query = build_filtered_absensi_query(
            start_date=start_date,
            end_date=end_date,
            status_filter=status_filter,
            search=search,
            sub_company_id=sub_company_id
        )

        results = query.order_by(Absensi_all.clocking_date.asc(), Absensi_all.employee_id.asc()).all()

        if not results:
            return jsonify({"status": "error", "message": "Tidak ada data absensi yang sesuai untuk diekspor."}), 404

        # Suntikkan dynamic CC ke hasil All sebelum di-loop menjadi excel rows
        enriched_results = _enrich_with_dynamic_cc(results)

        excel_data = []
        for d in enriched_results:
            is_anomaly = d.get('is_anomaly') == 1 or d.get('flag_anomaly') == 1
            bac_in = d.get('bac_clock_in')
            bac_out = d.get('bac_clock_out')
            has_bac = bool(d.get('bac_id') or d.get('bac_no') or bac_in or bac_out)

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

            # Menentukan Label Status
            if has_bac:
                status_str = "BAC Found"
            elif is_anomaly:
                status_str = "Anomali"
            elif c_in and c_out and c_in != "KOSONG" and c_out != "KOSONG":
                status_str = "Lengkap"
            else:
                status_str = "BAC Not Found"

            excel_data.append({
                "Employee ID": d.get('employee_code') or d.get('employee_id'),
                "Nama Karyawan": d.get('employee_name') or '-',
                "Gender": d.get('gender') or '-',
                "Sub Company": d.get('subCom') or d.get('sub_company_name') or '-',
                "Absence Card": d.get('card') or '-',
                "Cost Center": d.get('cc') or '-',  # Ini sekarang berisi CC yang sudah disesuaikan (Terminal vs Master)
                "Type": d.get('type') or '-',
                "Clocking Date": format_dt(d.get('v_clocking_date') or d.get('clocking_date'), is_time=False),
                "Clocking In": c_in if c_in != "KOSONG" else "No Clock In",
                "Clocking Out": c_out if c_out != "KOSONG" else "No Clock Out",
                "Status": status_str,
                "Ket BAC": d.get('bac_ket') or '-',
                "Updated By": d.get('bac_updated_by') or '-',
                "Updated Date": d.get('bac_updated_date') or '-'
            })

        # Generate File Excel via OpenPyXL
        df = pd.DataFrame(excel_data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Absensi_Outsource')
        output.seek(0)

        filename = f"Export_Absensi_OS_{start_date}_to_{end_date}.xlsx" if start_date and end_date else "Export_Absensi_OS.xlsx"

        return send_file(
            output,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500