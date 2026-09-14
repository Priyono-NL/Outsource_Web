import pandas as pd
from io import BytesIO
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_
from datetime import datetime
from openpyxl.worksheet.datavalidation import DataValidation

from extensions import db
from model.medical import medical
from model.osMedical import osMedical
from model.employment import OsEmployment
from model.person import OsPerson
from model.ob_emp import ObEmployee
# 1. Import Model Hak Akses SSO
from model.hr_models import User, UserSubcompanyAccess

osMedical_bp = Blueprint('osMedical_bp', __name__)

@osMedical_bp.route('/osmedical')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        req_subco = request.args.get('subcompany', '', type=str) # Tangkap parameter dari React
        
        query = osMedical.query

        # =================================================================
        # 2. LOGIKA FILTER HAK AKSES SUBCOMPANY (SSO SECURITY CHECK)
        # =================================================================
        user_email = request.headers.get('X-User-Email')
        allowed_access = []
        if user_email:
            user = User.query.filter_by(email=user_email).first()
            if user:
                access_records = UserSubcompanyAccess.query.filter_by(user_id=user.id).all()
                allowed_access = [a.sub_company_id for a in access_records]
                
                # Cegah bypass manual dari URL/Postman
                if allowed_access and req_subco and req_subco not in allowed_access:
                    return jsonify({"status": "error", "message": "Akses ditolak"}), 403

        # Tentukan batasan subcompany (apakah dari DB user atau pilihan dropdown)
        subco_filter_active = allowed_access or ([req_subco] if req_subco else None)
        subco_emp_ids = None
        
        if subco_filter_active:
            subco_matches = db.session.query(OsEmployment.id).filter(
                OsEmployment.sub_company_id.in_(subco_filter_active)
            ).all()
            subco_emp_ids = [str(row.id) for row in subco_matches]
        # =================================================================

        if search:
            search_term = f"%{search}%"
            matched_employee_ids = []

            # 1. Cari di OsEmployment dengan filter Subcompany
            os_matches_q = db.session.query(OsEmployment.id).join(
                OsPerson, OsEmployment.person_id == OsPerson.person_id
            ).filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(search_term),
                    OsPerson.name.ilike(search_term)
                )
            )
            
            if subco_filter_active:
                os_matches_q = os_matches_q.filter(OsEmployment.sub_company_id.in_(subco_filter_active))
                
            os_matches = os_matches_q.all()
            matched_employee_ids.extend([str(row.id) for row in os_matches])

            # 2. Cari di ObEmployee (hanya jika tidak terhambat filter subcompany spesifik)
            if not req_subco:
                ob_matches = db.session.query(ObEmployee.employee_id).filter(
                    or_(
                        ObEmployee.employee_id.cast(db.String).ilike(search_term),
                        ObEmployee.employee_name.ilike(search_term)
                    )
                ).all()
                matched_employee_ids.extend([str(row.employee_id) for row in ob_matches])

            if matched_employee_ids:
                query = query.filter(osMedical.employee_id.in_(matched_employee_ids))
            else:
                query = query.filter(False)
        else:
            # Jika tidak ada pencarian kata kunci, terapkan filter ID karyawan berdasarkan subcompany
            if subco_emp_ids is not None:
                query = query.filter(osMedical.employee_id.in_(subco_emp_ids))

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
            "message": "Data berhasil disimpan!"
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
        if not osMedical_data:
            return jsonify({"status": "error", "message": "Data tidak ditemukan"}), 404

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
        if not data:
            return jsonify({"status": "error", "message": "Data tidak ditemukan"}), 404

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
        req_subco = request.args.get('subcompany', '', type=str)
        
        query = osMedical.query

        # 3. FILTER AKSES HAK SUBCOMPANY SAAT EXPORT
        user_email = request.headers.get('X-User-Email')
        allowed_access = []
        if user_email:
            user = User.query.filter_by(email=user_email).first()
            if user:
                access_records = UserSubcompanyAccess.query.filter_by(user_id=user.id).all()
                allowed_access = [a.sub_company_id for a in access_records]
                if allowed_access and req_subco and req_subco not in allowed_access:
                    return jsonify({"status": "error", "message": "Akses ditolak"}), 403

        subco_filter_active = allowed_access or ([req_subco] if req_subco else None)

        if search:
            search_term = f"%{search}%"
            matched_employee_ids = []

            os_matches_q = db.session.query(OsEmployment.id).join(
                OsPerson, OsEmployment.person_id == OsPerson.person_id
            ).filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(search_term),
                    OsPerson.name.ilike(search_term)
                )
            )
            if subco_filter_active:
                os_matches_q = os_matches_q.filter(OsEmployment.sub_company_id.in_(subco_filter_active))
                
            os_matches = os_matches_q.all()
            matched_employee_ids.extend([str(row.id) for row in os_matches])

            if not req_subco:
                ob_matches = db.session.query(ObEmployee.employee_id).filter(
                    or_(
                        ObEmployee.employee_id.cast(db.String).ilike(search_term),
                        ObEmployee.employee_name.ilike(search_term)
                    )
                ).all()
                matched_employee_ids.extend([str(row.employee_id) for row in ob_matches])

            if matched_employee_ids:
                query = query.filter(osMedical.employee_id.in_(matched_employee_ids))
            else:
                query = query.filter(False)
        elif subco_filter_active:
            subco_matches = db.session.query(OsEmployment.id).filter(
                OsEmployment.sub_company_id.in_(subco_filter_active)
            ).all()
            subco_emp_ids = [str(row.id) for row in subco_matches]
            query = query.filter(osMedical.employee_id.in_(subco_emp_ids))

        master = query.all()
        data = []
        for m in master:
            d = m.to_dict()
            data.append({
                "ID Karyawan": d.get('employee_code', ''),
                "Nama Karyawan": d.get('employee_name', ''),
                "Jenis Medical": d.get('medical_name', ''),
                "Tanggal": d.get('v_medical_date', ''),
                "Hasil": d.get('medical_result', ''),
                "Catatan": d.get('medical_notes', '')
            })

        if not data:
            return jsonify({'status': 'error', 'message': 'tidak ada data untuk diexport'})
            
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
        all_medicals = medical.query.all()
        medical_names = [m.medical_name for m in all_medicals]
        
        if medical_names:
            medical_list_str = f'"{",".join(medical_names)}"'
        else:
            medical_list_str = '"Medical Check Up, Fit to Work"'

        result_list_str = '"SEHAT, TIDAK SEHAT, BEROBAT, PERLU EVALUASI"'

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
            
            worksheet = writer.sheets['Template_Import']

            worksheet.column_dimensions['A'].width = 18 
            worksheet.column_dimensions['B'].width = 28 
            worksheet.column_dimensions['C'].width = 15 
            worksheet.column_dimensions['D'].width = 20 
            worksheet.column_dimensions['E'].width = 30 

            dv_medical = DataValidation(
                type="list", 
                formula1=medical_list_str, 
                allow_blank=True
            )
            dv_medical.error = 'Silakan pilih Jenis Medical dari daftar dropdown yang tersedia!'
            dv_medical.errorTitle = 'Pilihan Tidak Valid'
            
            worksheet.add_data_validation(dv_medical)
            dv_medical.add("B2:B500")

            dv_result = DataValidation(
                type="list", 
                formula1=result_list_str, 
                allow_blank=True
            )
            dv_result.error = 'Silakan pilih Status Hasil dari daftar dropdown!'
            dv_result.errorTitle = 'Pilihan Tidak Valid'
            
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
                    e_code_raw = clean(row.get('ID Employee'))
                    if not e_code_raw:
                        raise ValueError("ID Employee (Employee Code) tidak boleh kosong.")
                    e_code = str(e_code_raw).split('.')[0].strip()

                    target_emp_id = None

                    exist_emp_os = OsEmployment.query.filter(
                        OsEmployment.employee_code == e_code,
                        OsEmployment.valid_from <= today,
                        ((OsEmployment.valid_to >= today) | (OsEmployment.valid_to == None))
                    ).first()

                    if exist_emp_os:
                        target_emp_id = exist_emp_os.id
                    else:
                        exist_emp_ob = ObEmployee.query.filter(
                            ObEmployee.employee_id == e_code
                        ).first()

                        if exist_emp_ob:
                            target_emp_id = exist_emp_ob.employee_id

                    if not target_emp_id:
                        raise ValueError(
                            f"Employee Code '{e_code}' tidak terdaftar di OS maupun SAP "
                            f"(atau status kerjanya sudah tidak aktif)."
                        )

                    m_name_raw = clean(row.get('Medical Name'))
                    if not m_name_raw:
                        raise ValueError("Medical Name tidak boleh kosong.")
                    m_name = str(m_name_raw).strip()
                    exist_medical = medical.query.filter(medical.medical_name.ilike(m_name)).first()
                    if not exist_medical:
                        raise ValueError(f"Jenis Medical '{m_name}' tidak ditemukan di master data.")
                    
                    raw_date = row.get('Date')
                    if pd.isna(raw_date):
                        raise ValueError("Tanggal (Date) tidak boleh kosong.")                    
                    
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