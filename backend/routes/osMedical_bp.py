import pandas as pd
from io import BytesIO
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_
from datetime import datetime
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.styles import Font, PatternFill, Alignment

from extensions import db
from model.medical import medical
from model.osMedical import osMedical
from model.employment import OsEmployment
from model.person import OsPerson
from model.ob_emp import ObEmployee

osMedical_bp = Blueprint('osMedical_bp', __name__)

@osMedical_bp.route('/osmedical')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        query = osMedical.query
        if search:
            query = query.outerjoin(OsEmployment, osMedical.employee_id == OsEmployment.id) \
                         .outerjoin(OsPerson, OsEmployment.person_id == OsPerson.person_id) \
                         .outerjoin(ObEmployee, osMedical.employee_id == ObEmployee.employee_id)            
            query = query.filter(
                or_(
                    # Pencarian untuk data OS
                    OsEmployment.employee_code.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),                    
                    # Pencarian untuk data OB
                    ObEmployee.employee_id.cast(db.String).ilike(f"%{search}%"),
                    ObEmployee.employee_name.ilike(f"%{search}%")
                )
            )
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

@osMedical_bp.route('/osmedical/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form
        new_osMedical = osMedical(
            employee_id = data.get('employee_id'),
            medical_id = data.get('medical_id'),
            medical_date = data.get('medical_date'),
            medical_result = data.get('medical_result'),
            medical_notes = data.get('medical_notes')
        )
        db.session.add(new_osMedical)
        db.session.commit()
        return jsonify({
            "status": "success",
            "message": f"Data berhasil disimpan!"
        }), 201     
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": "Terjadi kesalahan pada server: " + str(e)
        }), 500

@osMedical_bp.route('/osmedical/<string:id>', methods=['PUT'])
def update(id):
    try:
        osMedical_data = osMedical.query.filter_by(id=id).first()
        data = request.json
        osMedical_data.employee_id = data.get('employee_id', osMedical_data.employee_id)
        osMedical_data.medical_id = data.get('medical_id', osMedical_data.medical_id)
        osMedical_data.medical_date = data.get('medical_date', osMedical_data.medical_date)
        osMedical_data.medical_result = data.get('medical_result', osMedical_data.medical_result)
        osMedical_data.medical_notes = data.get('medical_notes', osMedical_data.medical_notes)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@osMedical_bp.route('/osmedical/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = osMedical.query.filter_by(id=id).first()
        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500
    
@osMedical_bp.route('/osmedical/export', methods=['GET'])
def export():
    try:
        search = request.args.get('search', '', type=str)
        query = osMedical.query
        if search:
            # DIUBAH KE OUTERJOIN AGAR DATA OS & OB IKUT TER-EXPORT
            query = query.outerjoin(OsEmployment, osMedical.employee_id == OsEmployment.id) \
                         .outerjoin(OsPerson, OsEmployment.person_id == OsPerson.person_id) \
                         .outerjoin(ObEmployee, osMedical.employee_id == ObEmployee.employee_id)            
            query = query.filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),                    
                    ObEmployee.employee_id.cast(db.String).ilike(f"%{search}%"),
                    ObEmployee.employee_name.ilike(f"%{search}%")
                )
            )

        master = query.all()
        data = []
        for m in master:
            d = m.to_dict()
            data.append({
                "ID Karyawan": d['employee_code'],
                "Nama Karyawan": d['employee_name'],
                "Jenis Medical": d['medical_name'],
                "Tanggal": d['v_medical_date'],
                "Hasil": d['medical_result'],
                "Catatan": d['medical_notes']
            })
        if not data:
            return jsonify({'status': 'error', 'message': 'tidak ada data'})
        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Data OS Medical')        
        output.seek(0)
        return send_file(
            output, 
            as_attachment=True, 
            download_name="Export_OS_Medical.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    
@osMedical_bp.route('/osmedical/template', methods=['GET'])
def template():
    try:
        # 1. Ambil semua list Jenis Medical dari Database Master
        all_medicals = medical.query.all()
        medical_names = [m.medical_name for m in all_medicals]
        
        # Buat string pilihan dropdown untuk openpyxl, contoh: '"MCU, Fit to Work, PCR"'
        if medical_names:
            medical_list_str = f'"{",".join(medical_names)}"'
        else:
            medical_list_str = '"Medical Check Up, Fit to Work"' # Fallback jika master kosong

        # Pilihan dropdown standar untuk Hasil Medical
        result_list_str = '"SEHAT, TIDAK SEHAT, BEROBAT, PERLU EVALUASI"'

        # 2. Buat DataFrame Template
        example_data = [{
            "ID Employee": "12345",
            "Medical Name": medical_names[0] if medical_names else "Medical Check Up",
            "Date": "2026-03-20",
            "Result": "SEHAT",
            "Notes": "Catatan opsional"
        }]
        df = pd.DataFrame(example_data)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Template_Import')
            
            # Akses workbook dan sheet openpyxl untuk menambahkan Dropdown
            workbook = writer.book
            worksheet = writer.sheets['Template_Import']

            # Set Lebar Kolom agar Rapi
            worksheet.column_dimensions['A'].width = 18 # ID Employee
            worksheet.column_dimensions['B'].width = 28 # Medical Name
            worksheet.column_dimensions['C'].width = 15 # Date
            worksheet.column_dimensions['D'].width = 20 # Result
            worksheet.column_dimensions['E'].width = 30 # Notes

            # ==========================================
            # 3. BUAT DROPDOWN UNTUK MEDICAL NAME (Kolom B)
            # ==========================================
            dv_medical = DataValidation(
                type="list", 
                formula1=medical_list_str, 
                allow_blank=True
            )
            dv_medical.error = 'Silakan pilih Jenis Medical dari daftar dropdown yang tersedia!'
            dv_medical.errorTitle = 'Pilihan Tidak Valid'
            
            # Pasang Dropdown untuk 500 baris pertama di Kolom B (Medical Name)
            worksheet.add_data_validation(dv_medical)
            dv_medical.add("B2:B500")

            # ==========================================
            # 4. BUAT DROPDOWN UNTUK RESULT (Kolom D)
            # ==========================================
            dv_result = DataValidation(
                type="list", 
                formula1=result_list_str, 
                allow_blank=True
            )
            dv_result.error = 'Silakan pilih Status Hasil dari daftar dropdown!'
            dv_result.errorTitle = 'Pilihan Tidak Valid'
            
            # Pasang Dropdown untuk 500 baris pertama di Kolom D (Result)
            worksheet.add_data_validation(dv_result)
            dv_result.add("D2:D500")

        output.seek(0)
        return send_file(
            output, 
            as_attachment=True, 
            download_name="Template_Import_Medical.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@osMedical_bp.route('/osmedical/upload', methods=['POST'])
def upload():
    file = request.files.get('file')
    if not file:
        return jsonify({'message': 'Tidak ada file'}), 400
        
    try:
        df = pd.read_excel(file)

        def clean(val):
            if pd.isna(val) or val == 'nan' or val == 'NaN':
                return None
            return val
                
        errors = []
        notes = []
        success_count = 0
        
        today = datetime.now().date()
        for index, row in df.iterrows():
            line_number = index + 2
            try:
                with db.session.begin_nested():
                    # cek nrp exist
                    e_code_raw = clean(row.get('ID Employee'))
                    if not e_code_raw:
                        raise ValueError("ID Employee (Employee Code) tidak boleh kosong.")
                    e_code = str(e_code_raw).split('.')[0].strip()

                    target_emp_id = None

                    # 1. CEK KE OS EMPLOYMENT PERTAMA
                    exist_emp_os = OsEmployment.query.filter(
                        OsEmployment.employee_code == e_code,
                        OsEmployment.valid_from <= today,
                        ((OsEmployment.valid_to >= today) | (OsEmployment.valid_to == None))
                    ).first()

                    if exist_emp_os:
                        target_emp_id = exist_emp_os.id
                    else:
                        # 2. CEK KE OB EMPLOYEE JIKA TIDAK ADA DI OS
                        exist_emp_ob = ObEmployee.query.filter(
                            ObEmployee.employee_id == e_code
                        ).first()

                        if exist_emp_ob:
                            target_emp_id = exist_emp_ob.employee_id

                    # JIKA KEDUANYA TIDAK DITEMUKAN
                    if not target_emp_id:
                        raise ValueError(
                            f"Employee Code '{e_code}' tidak terdaftar di OS maupun SAP "
                            f"(atau status kerjanya sudah tidak aktif)."
                        )

                    # cek medical exist in db
                    m_name_raw = clean(row.get('Medical Name'))
                    if not m_name_raw:
                        raise ValueError("Medical Name tidak boleh kosong.")
                    m_name = str(m_name_raw).strip()
                    exist_medical = medical.query.filter(medical.medical_name.ilike(m_name)).first()
                    if not exist_medical:
                        raise ValueError(f"Jenis Medical '{m_name}' tidak ditemukan di master data.")
                    
                    # cek tanggal
                    raw_date = row.get('Date')
                    if pd.isna(raw_date):
                        raise ValueError("Tanggal (Date) tidak boleh kosong.")                    
                    
                    # Insert Data
                    new_medical = osMedical(
                        employee_id=target_emp_id,
                        medical_id=exist_medical.medical_id,
                        medical_date=pd.to_datetime(raw_date).date(),
                        medical_result=str(row.get('Result', '')).strip() if pd.notna(row.get('Result')) else None,
                        medical_notes=str(row.get('Notes', '')).strip() if pd.notna(row.get('Notes')) else None
                    )
                    db.session.add(new_medical)
                
                success_count += 1
                
            except ValueError as ve:
                errors.append(f"Baris {line_number}: {str(ve)}")
            except Exception as e:
                errors.append(f"Baris {line_number}: Gagal memproses data - {str(e)}")

        db.session.commit()

        if success_count > 0:
            status = "success" if not errors else "partial_success"
            msg = f"Berhasil mengimport {success_count} data."
            return jsonify({
                "status": status, 
                "message": msg,
                "errors": errors,
                "notes": notes
            }), 200
        else:
            return jsonify({
                "status": "error", 
                "message": "Tidak ada data yang berhasil diimport. Silakan periksa file Anda.",
                "errors": errors,
                "notes": notes
            }), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Terjadi kesalahan fatal: {str(e)}"}), 500