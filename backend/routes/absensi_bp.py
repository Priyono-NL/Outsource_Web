import pandas as pd
from io import BytesIO
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_, and_
from datetime import datetime

from extensions import db
from model.absensi import Absensi, BAC_os
from model.employment import OsEmployment
from model.person import OsPerson
from openpyxl.worksheet.datavalidation import DataValidation

AbsenOs_bp = Blueprint('AbsenOs_bp', __name__)

@AbsenOs_bp.route('/absensi')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        sub_company_id = request.args.get('sub_company', '', type=str)
        start_date = request.args.get('start_date', '', type=str)
        end_date = request.args.get('end_date', '', type=str)
        status_filter = request.args.get('status_filter', 'all_data', type=str)

        query = Absensi.query

        if status_filter == 'violation_all':
            query = query.filter(or_(Absensi.clocking_in.is_(None), Absensi.clocking_out.is_(None)))
        elif status_filter == 'no_in':
            query = query.filter(and_(Absensi.clocking_in.is_(None), Absensi.clocking_out.is_not(None)))
        elif status_filter == 'no_out':
            query = query.filter(and_(Absensi.clocking_in.is_not(None), Absensi.clocking_out.is_(None)))
        elif status_filter == 'no_both':
            query = query.filter(and_(Absensi.clocking_in.is_(None), Absensi.clocking_out.is_(None)))
        
        needs_employment_join = bool(search or sub_company_id)
        if needs_employment_join:
            query = query.join(OsEmployment, Absensi.employee_id == OsEmployment.id)

        if search:
            query = query.join(OsPerson, OsEmployment.person_id == OsPerson.person_id)                     
            query = query.filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),                    
                )
            )
            
        if sub_company_id:
            query = query.filter(OsEmployment.sub_company_id == sub_company_id)

        if start_date:
            query = query.filter(Absensi.date_clocking >= start_date)
        if end_date:
            query = query.filter(Absensi.date_clocking <= end_date)

        pagination = query.paginate(page=page, per_page=pageSize, error_out=False)
        return jsonify({
            "status": "success",
            "data": [emp.to_dict() for emp in pagination.items],
            "total_page": pagination.pages,
            "current_page": pagination.page,
            "total_item": pagination.total
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@AbsenOs_bp.route('/absensi/bac/<string:absenId>', methods=['GET'])
def get_bac(absenId):
    extra_info = db.session.query(BAC_os).filter(BAC_os.absensi_id == absenId).first()
    
    if not extra_info:
        return {"clock_in": "", "clock_out": "", "bac_no": "", "bac_ket": ""}
        
    return {
        "clock_in": extra_info.clock_in.isoformat() if extra_info.clock_in else "",
        "clock_out": extra_info.clock_out.isoformat() if extra_info.clock_out else "",
        "bac_no": extra_info.bac_no or "",
        "bac_ket": extra_info.bac_ket or ""
    }

@AbsenOs_bp.route('/absensi/<string:id>', methods=['PUT'])
def update(id):
    try:
        data = request.json
        
        if not data:
            return jsonify({"status": "error", "message": "Tidak ada data yang diterima"}), 400

        clock_in = data.get('clock_in') if data.get('clock_in') != '' else None
        clock_out = data.get('clock_out') if data.get('clock_out') != '' else None

        existing_bac = BAC_os.query.filter_by(absensi_id=id).first()

        if existing_bac:
            existing_bac.employee_id = data.get('employee_id')
            existing_bac.bac_no = data.get('bac_no')
            existing_bac.bac_ket = data.get('bac_ket')
            existing_bac.clock_date = data.get('clock_date')
            existing_bac.clock_in = clock_in
            existing_bac.clock_out = clock_out
            
            message = "BAC Absensi berhasil diupdate!"
            
        else:
            new_bac_os = BAC_os(
                absensi_id = id,
                employee_id = data.get('employee_id'),
                bac_no = data.get('bac_no'),
                bac_ket = data.get('bac_ket'),
                clock_date = data.get('clock_date'),
                clock_in = clock_in,
                clock_out = clock_out
            )
            db.session.add(new_bac_os)
            message = "BAC Absensi berhasil ditambahkan!"

        db.session.commit()

        return jsonify({
            "status": "success", 
            "message": message
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@AbsenOs_bp.route('/absensi/template', methods=['GET'])
def template():
    try:
        start_date_raw = request.args.get('start_date')
        end_date_raw = request.args.get('end_date')

        if not start_date_raw or not end_date_raw:
            return jsonify({"status": "error", "message": "Parameter start_date dan end_date wajib diisi."}), 400
        
        already_revised_subquery = db.session.query(BAC_os.absensi_id) \
            .filter(BAC_os.absensi_id == Absensi.id).subquery()

        query_results = db.session.query(Absensi, OsEmployment, OsPerson) \
            .join(OsEmployment, Absensi.employee_id == OsEmployment.id) \
            .join(OsPerson, OsEmployment.person_id == OsPerson.person_id) \
            .filter(
                Absensi.date_clocking >= start_date_raw,
                Absensi.date_clocking <= end_date_raw,
                ((Absensi.clocking_in == None) | (Absensi.clocking_out == None)),
                ~Absensi.id.in_(already_revised_subquery)
            ).order_by(Absensi.date_clocking.asc(), OsEmployment.employee_code.asc()).all()

        if not query_results:
            return jsonify({"status": "error", "message": "Tidak ditemukan data absensi bolong pada periode ini."}), 444

        dynamic_data = []
        for att, emp, person in query_results:
            dynamic_data.append({
                "Log ID": att.id,
                "ID Employee": emp.employee_code,
                "Nama Karyawan": person.name,
                "No BAC": "",
                "Clocking Date": att.date_clocking.strftime('%Y-%m-%d') if att.date_clocking else "",
                "Clocking In": att.clocking_in.strftime('%Y-%m-%d %H:%M') if att.clocking_in else "KOSONG",
                "Clocking Out": att.clocking_out.strftime('%Y-%m-%d %H:%M') if att.clocking_out else "KOSONG",
                "Keterangan BAC": ""
            })

        df = pd.DataFrame(dynamic_data)
        num_rows = len(df) + 1

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Template_Import_Revisi')
            workbook = writer.book
            worksheet = writer.sheets['Template_Import_Revisi']
            list_pilihan = '"Kartu Ketinggalan,Kartu Belum Diterima,Kartu Error,Karyawan Lupa Clocking"'
            
            dv = DataValidation(type="list", formula1=list_pilihan, allow_blank=True)
            dv.error = 'Mohon pilih keterangan yang tersedia pada list dropdown.'
            dv.errorTitle = 'Pilihan Tidak Valid'
            worksheet.add_data_validation(dv)
            
            range_kolom_h = f"H2:H{num_rows + 100}"
            dv.add(range_kolom_h)
        output.seek(0)
        
        return send_file(
            output, 
            as_attachment=True, 
            download_name=f"Template_Mass_Update_Absen_{start_date_raw}_to_{end_date_raw}.xlsx"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@AbsenOs_bp.route('/absensi/upload', methods=['POST'])
def upload():
    file = request.files.get('file')
    if not file:
        return jsonify({'message': 'Mohon pilih file Excel terlebih dahulu.'}), 400
        
    try:
        df = pd.read_excel(file, dtype={'Log ID': str, 'Clocking In': str, 'Clocking Out': str, 'No BAC': str})

        def clean(val):
            if pd.isna(val) or str(val).strip() in ('nan', 'NaN', ''):
                return None
            return str(val).strip()

        def parse_datetime(datetime_str):
            if not datetime_str or datetime_str.lower() == 'kosong':
                return None
            dt_clean = datetime_str.split('.')[0].strip()
            for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%d/%m/%Y %H:%M', '%Y-%m-%d %H.%M'):
                try:
                    return datetime.strptime(dt_clean, fmt)
                except ValueError:
                    continue
            raise ValueError(f"Format waktu '{datetime_str}' keliru. Gunakan format YYYY-MM-DD HH:MM")

        errors = []
        notes = []
        success_count = 0

        for index, row in df.iterrows():
            line_number = index + 2
            try:
                with db.session.begin_nested():
                    log_id_raw = clean(row.get('Log ID'))
                    if not log_id_raw:
                        raise ValueError("Kolom 'Log ID' tidak boleh kosong.")

                    # 1. Ambil data dari TABEL UTAMA berdasarkan ID Log
                    main_attendance = Absensi.query.get(int(log_id_raw))
                    if not main_attendance:
                        raise ValueError(f"Log ID '{log_id_raw}' tidak ditemukan di tabel utama.")

                    c_in_raw = clean(row.get('Clocking In'))
                    c_out_raw = clean(row.get('Clocking Out'))
                    no_bac = clean(row.get('No BAC'))
                    ket_bac = clean(row.get('Keterangan BAC'))

                    # Jika kolom jam tidak diubah (tetap KOSONG), lewati baris ini
                    if (not c_in_raw or c_in_raw.lower() == 'kosong') and (not c_out_raw or c_out_raw.lower() == 'kosong'):
                        continue

                    if not ket_bac:
                        raise ValueError("Kolom 'Keterangan BAC' wajib diisi sebagai bukti audit revisi.")

                    # Ambil jam baru atau pertahankan jam lama jika tidak direvisi
                    final_clock_in = parse_datetime(c_in_raw) if (c_in_raw and c_in_raw.lower() != 'kosong') else main_attendance.clocking_in
                    final_clock_out = parse_datetime(c_out_raw) if (c_out_raw and c_out_raw.lower() != 'kosong') else main_attendance.clocking_out

                    # --- INSERT DATA BARU KE TABEL REVISI ---
                    new_revision = BAC_os(
                        absensi_id=main_attendance.id,
                        employee_id=main_attendance.employee_id,
                        bac_no=no_bac,
                        bac_ket=ket_bac,
                        clock_date=main_attendance.date_clocking,
                        clock_in=final_clock_in,
                        clock_out=final_clock_out,
                    )
                    db.session.add(new_revision)
                
                success_count += 1

            except ValueError as ve:
                errors.append(f"Baris {line_number}: {str(ve)}")
            except Exception as e:
                errors.append(f"Baris {line_number}: Gagal memproses data - {str(e)}")

        db.session.commit()

        if success_count > 0:
            status = "success" if not errors else "partial_success"
            msg = f"Berhasil merevisi {success_count} data absensi dan menyimpan log BAC."
            return jsonify({"status": status, "message": msg, "errors": errors, "notes": notes}), 200
        else:
            return jsonify({
                "status": "error", 
                "message": "Tidak ada data absensi yang diperbarui. Periksa kembali file Excel Anda.",
                "errors": errors,
                "notes": notes
            }), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Terjadi kesalahan fatal pada server: {str(e)}"}), 500
    