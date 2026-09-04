import pandas as pd
from io import BytesIO
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_
from datetime import datetime
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.styles import Font, PatternFill, Alignment

from extensions import db
from model.training import training_m
from model.osTraining import osTraining
from model.employment import OsEmployment
from model.person import OsPerson
from model.ob_emp import ObEmployee

osTraining_bp = Blueprint('osTraining_bp', __name__)

@osTraining_bp.route('/ostraining')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        query = osTraining.query

        if search:
            search_term = f"%{search}%"
            matched_employee_ids = []

            os_matches = db.session.query(OsEmployment.id).join(
                OsPerson, OsEmployment.person_id == OsPerson.person_id
            ).filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(search_term),
                    OsPerson.name.ilike(search_term)
                )
            ).all()
            matched_employee_ids.extend([str(row.id) for row in os_matches])

            ob_matches = db.session.query(ObEmployee.employee_id).filter(
                or_(
                    ObEmployee.employee_id.cast(db.String).ilike(search_term),
                    ObEmployee.employee_name.ilike(search_term)
                )
            ).all()
            matched_employee_ids.extend([str(row.employee_id) for row in ob_matches])

            if matched_employee_ids:
                query = query.filter(osTraining.employee_id.in_(matched_employee_ids))
            else:
                query = query.filter(False)

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
    
@osTraining_bp.route('/ostraining/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form
        new_osTraining = osTraining(
            employee_id = data.get('employee_id'),
            training_id = data.get('training_id'),
            training_date_from = data.get('training_date_from'),
            training_date_to = data.get('training_date_to'),
            training_result = data.get('training_result'),
            training_score = data.get('training_score'),
        )
        db.session.add(new_osTraining)
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

@osTraining_bp.route('/ostraining/<string:id>', methods=['PUT'])
def update(id):
    try:
        osTraining_data = osTraining.query.filter_by(id=id).first()
        data = request.json
        osTraining_data.employee_id = data.get('employee_id', osTraining_data.employee_id)
        osTraining_data.training_id = data.get('training_id', osTraining_data.training_id)
        osTraining_data.training_date_from = data.get('training_date_from', osTraining_data.training_date_from)
        osTraining_data.training_date_to = data.get('training_date_to', osTraining_data.training_date_to)
        osTraining_data.training_result = data.get('training_result', osTraining_data.training_result)
        osTraining_data.training_score = data.get('training_score', osTraining_data.training_score)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@osTraining_bp.route('/ostraining/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = osTraining.query.filter_by(id=id).first()
        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500

@osTraining_bp.route('/ostraining/export', methods=['GET'])
def export():
    try:
        search = request.args.get('search', '', type=str)
        query = osTraining.query
        
        if search:
            search_term = f"%{search}%"
            matched_employee_ids = []

            os_matches = db.session.query(OsEmployment.id).join(
                OsPerson, OsEmployment.person_id == OsPerson.person_id
            ).filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(search_term),
                    OsPerson.name.ilike(search_term)
                )
            ).all()
            matched_employee_ids.extend([str(row.id) for row in os_matches])

            ob_matches = db.session.query(ObEmployee.employee_id).filter(
                or_(
                    ObEmployee.employee_id.cast(db.String).ilike(search_term),
                    ObEmployee.employee_name.ilike(search_term)
                )
            ).all()
            matched_employee_ids.extend([str(row.employee_id) for row in ob_matches])

            if matched_employee_ids:
                query = query.filter(osTraining.employee_id.in_(matched_employee_ids))
            else:
                query = query.filter(False) # Tidak ada yang cocok, kembalikan kosong

        master = query.all()
        data = []
        for m in master:
            d = m.to_dict()
            data.append({
                "ID Employee": d['employee_code'],
                "Name Employee": d['employee_name'],
                "Training Name": d['training_name'],
                "Date From": d['v_training_date_from'],
                "Date To": d['v_training_date_to'],
                "Result": d['status_result'],
                "Score": d['training_score']
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
            download_name="Export_OS_Training.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    
@osTraining_bp.route('/ostraining/template', methods=['GET'])
def template():
    try:
        # 1. Ambil semua Master Training dari Database
        all_trainings = training_m.query.all()
        training_names = [t.training_name for t in all_trainings]
        
        # Format string list pilihan dropdown openpyxl
        if training_names:
            # Escape tanda petik ganda jika ada pada nama training
            clean_names = [name.replace('"', '""') for name in training_names]
            training_list_str = f'"{",".join(clean_names)}"'
        else:
            training_list_str = '"Basic Safety Training, Leadership Training"' # Fallback jika master kosong

        # Pilihan dropdown untuk Result (Sesuai dengan pembacaan fungsi upload Anda)
        result_list_str = '"Lulus, Tidak Lulus"'

        # 2. Contoh data untuk baris pertama template
        example_data = [{
            "ID Employee": "12345",
            "Training Name": training_names[0] if training_names else "Basic Safety Training",
            "Date From": "2026-03-20",
            "Date To": "2026-03-22",
            "Result": "Lulus",
            "Score": 85
        }]
        df = pd.DataFrame(example_data)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Template_Import_Training')
            
            worksheet = writer.sheets['Template_Import_Training']

            # Set Lebar Kolom agar rapi dan mudah dibaca
            worksheet.column_dimensions['A'].width = 18 # ID Employee
            worksheet.column_dimensions['B'].width = 32 # Training Name
            worksheet.column_dimensions['C'].width = 16 # Date From
            worksheet.column_dimensions['D'].width = 16 # Date To
            worksheet.column_dimensions['E'].width = 18 # Result
            worksheet.column_dimensions['F'].width = 14 # Score

            # ==========================================
            # 3. DROPDOWN TRAINING NAME (Kolom B)
            # ==========================================
            dv_training = DataValidation(
                type="list", 
                formula1=training_list_str, 
                allow_blank=True
            )
            dv_training.error = 'Silakan pilih Jenis Training dari daftar dropdown yang tersedia!'
            dv_training.errorTitle = 'Pilihan Tidak Valid'
            
            # Pasang Dropdown untuk baris B2 hingga B500
            worksheet.add_data_validation(dv_training)
            dv_training.add("B2:B500")

            # ==========================================
            # 4. DROPDOWN RESULT (Kolom E)
            # ==========================================
            dv_result = DataValidation(
                type="list", 
                formula1=result_list_str, 
                allow_blank=True
            )
            dv_result.error = 'Pilihan harus Lulus atau Tidak Lulus!'
            dv_result.errorTitle = 'Pilihan Tidak Valid'
            
            # Pasang Dropdown untuk baris E2 hingga E500
            worksheet.add_data_validation(dv_result)
            dv_result.add("E2:E500")

        output.seek(0)
        return send_file(
            output, 
            as_attachment=True, 
            download_name="Template_Import_Training.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@osTraining_bp.route('/ostraining/upload', methods=['POST'])
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
                    # --- Ambil & Validasi Employee Code (NRP) ---
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
                    # --- Ambil & Validasi Master Training ---
                    t_name_raw = clean(row.get('Training Name'))
                    if not t_name_raw:
                        raise ValueError("Training Name tidak boleh kosong.")
                    t_name = str(t_name_raw).strip()
                    
                    exist_training = training_m.query.filter(training_m.training_name.ilike(t_name)).first()
                    if not exist_training:
                        raise ValueError(f"Jenis Training '{t_name}' tidak ditemukan di master data.")

                    # --- Parsing Status Kelulusan (Result) ---
                    raw_result = clean(row.get('Result'))
                    if not raw_result:
                        raise ValueError("Kolom Result tidak boleh kosong.")
                        
                    raw_result = str(raw_result).strip().lower()
                    if raw_result == 'lulus':
                        training_val = 1
                    elif raw_result == 'tidak lulus':
                        training_val = 0
                    else:
                        raise ValueError("Kolom Result harus berisi 'Lulus' atau 'Tidak Lulus'.")

                    # --- Parsing Tanggal & Skor ---
                    raw_date_from = clean(row.get('Date From'))
                    raw_date_to = clean(row.get('Date To'))
                    raw_score = clean(row.get('Score'))
                    
                    if not raw_date_from or not raw_date_to:
                        raise ValueError("Tanggal 'Date From' dan 'Date To' tidak boleh kosong.")

                    # --- Insert Data Baru ---
                    new_training = osTraining(
                        employee_id=target_emp_id,
                        training_id=exist_training.training_id,
                        training_date_from=pd.to_datetime(raw_date_from).date(),
                        training_date_to=pd.to_datetime(raw_date_to).date(),
                        training_result=training_val,
                        training_score=raw_score
                    )
                    db.session.add(new_training)
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