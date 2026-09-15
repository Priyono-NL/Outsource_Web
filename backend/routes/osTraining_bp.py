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
from model.osCostCenter import OsCostCenter
# Import Model Hak Akses SSO (Subcompany & Cost Center)
from model.hr_models import User, UserSubcompanyAccess, UserCostCenterAccess

osTraining_bp = Blueprint('osTraining_bp', __name__)

@osTraining_bp.route('/ostraining', methods=['GET'])
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        req_subco = request.args.get('subcompany', '', type=str)
        req_dept = request.args.get('department', '', type=str)
        
        query = osTraining.query

        # =================================================================
        # LOGIKA FILTER HAK AKSES SSO (SUBCOMPANY & COST CENTER)
        # =================================================================
        user_email = request.headers.get('X-User-Email')
        allowed_subco = []
        allowed_cc = []

        if user_email:
            user = User.query.filter_by(email=user_email).first()
            if user:
                # 1. Access Subcompany Check
                subco_records = UserSubcompanyAccess.query.filter_by(user_id=user.id).all()
                allowed_subco = [a.sub_company_id for a in subco_records]
                if allowed_subco and req_subco and req_subco not in allowed_subco:
                    return jsonify({"status": "error", "message": "Akses Subcompany ditolak"}), 403

                # 2. Access Cost Center / Department Check
                cc_records = UserCostCenterAccess.query.filter_by(user_id=user.id).all()
                allowed_cc = [c.cost_center_id for c in cc_records]
                if allowed_cc and req_dept:
                    try:
                        if int(req_dept) not in allowed_cc:
                            return jsonify({"status": "error", "message": "Akses Departemen ditolak"}), 403
                    except ValueError:
                        pass

        # Penentuan Filter Aktif
        subco_filter_active = allowed_subco or ([req_subco] if req_subco else None)
        cc_filter_active = allowed_cc or ([int(req_dept)] if req_dept and req_dept.isdigit() else None)

        subco_emp_ids = None
        if subco_filter_active or cc_filter_active:
            emp_query = db.session.query(OsEmployment.id)
            
            if subco_filter_active:
                emp_query = emp_query.filter(OsEmployment.sub_company_id.in_(subco_filter_active))
            
            if cc_filter_active:
                emp_query = emp_query.join(OsCostCenter, OsEmployment.id == OsCostCenter.employee_id)\
                                     .filter(OsCostCenter.org_cc_id.in_(cc_filter_active))
            
            subco_matches = emp_query.all()
            subco_emp_ids = [str(row.id) for row in subco_matches]

        # =================================================================
        # PROCESS SEARCH / FILTER QUERY
        # =================================================================
        if search:
            search_term = f"%{search}%"
            matched_employee_ids = []

            # Search pada Karyawan Outsource
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
            if cc_filter_active:
                os_matches_q = os_matches_q.join(OsCostCenter, OsEmployment.id == OsCostCenter.employee_id)\
                                           .filter(OsCostCenter.org_cc_id.in_(cc_filter_active))

            os_matches = os_matches_q.all()
            matched_employee_ids.extend([str(row.id) for row in os_matches])

            # Search pada ObEmployee (Hanya jika tidak ada batasan subcompany / department spesifik)
            if not req_subco and not req_dept and not allowed_subco and not allowed_cc:
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
        else:
            if subco_emp_ids is not None:
                query = query.filter(osTraining.employee_id.in_(subco_emp_ids))

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
            training_score = data.get('training_score') if data.get('training_score') else None,
        )
        db.session.add(new_osTraining)
        db.session.commit()

        return jsonify({
            "status": "success",
            "message": "Data training berhasil disimpan!"
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
        if not osTraining_data:
            return jsonify({"status": "error", "message": "Data tidak ditemukan"}), 404
            
        data = request.json
        osTraining_data.employee_id = data.get('employee_id', osTraining_data.employee_id)
        osTraining_data.training_id = data.get('training_id', osTraining_data.training_id)
        osTraining_data.training_date_from = data.get('training_date_from', osTraining_data.training_date_from)
        osTraining_data.training_date_to = data.get('training_date_to', osTraining_data.training_date_to)
        osTraining_data.training_result = data.get('training_result', osTraining_data.training_result)
        osTraining_data.training_score = data.get('training_score', osTraining_data.training_score)
        
        db.session.commit()
        return jsonify({"status": "success", "message": "Data training berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@osTraining_bp.route('/ostraining/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = osTraining.query.filter_by(id=id).first()
        if not data:
            return jsonify({"status": "error", "message": "Data tidak ditemukan"}), 404
            
        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data training berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500


@osTraining_bp.route('/ostraining/export', methods=['GET'])
def export():
    try:
        search = request.args.get('search', '', type=str)
        req_subco = request.args.get('subcompany', '', type=str)
        req_dept = request.args.get('department', '', type=str)
        
        query = osTraining.query

        # SSO Security Filter Check
        user_email = request.headers.get('X-User-Email')
        allowed_subco = []
        allowed_cc = []

        if user_email:
            user = User.query.filter_by(email=user_email).first()
            if user:
                subco_records = UserSubcompanyAccess.query.filter_by(user_id=user.id).all()
                allowed_subco = [a.sub_company_id for a in subco_records]
                if allowed_subco and req_subco and req_subco not in allowed_subco:
                    return jsonify({"status": "error", "message": "Akses ditolak"}), 403

                cc_records = UserCostCenterAccess.query.filter_by(user_id=user.id).all()
                allowed_cc = [c.cost_center_id for c in cc_records]
                if allowed_cc and req_dept:
                    try:
                        if int(req_dept) not in allowed_cc:
                            return jsonify({"status": "error", "message": "Akses Departemen ditolak"}), 403
                    except ValueError:
                        pass

        subco_filter_active = allowed_subco or ([req_subco] if req_subco else None)
        cc_filter_active = allowed_cc or ([int(req_dept)] if req_dept and req_dept.isdigit() else None)

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
            if cc_filter_active:
                os_matches_q = os_matches_q.join(OsCostCenter, OsEmployment.id == OsCostCenter.employee_id)\
                                           .filter(OsCostCenter.org_cc_id.in_(cc_filter_active))

            os_matches = os_matches_q.all()
            matched_employee_ids.extend([str(row.id) for row in os_matches])

            if not req_subco and not req_dept and not allowed_subco and not allowed_cc:
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
        elif subco_filter_active or cc_filter_active:
            emp_query = db.session.query(OsEmployment.id)
            if subco_filter_active:
                emp_query = emp_query.filter(OsEmployment.sub_company_id.in_(subco_filter_active))
            if cc_filter_active:
                emp_query = emp_query.join(OsCostCenter, OsEmployment.id == OsCostCenter.employee_id)\
                                     .filter(OsCostCenter.org_cc_id.in_(cc_filter_active))
            
            subco_matches = emp_query.all()
            subco_emp_ids = [str(row.id) for row in subco_matches]
            query = query.filter(osTraining.employee_id.in_(subco_emp_ids))

        master = query.all()
        data = []
        for m in master:
            d = m.to_dict()
            data.append({
                "ID Employee": d.get('employee_code', ''),
                "Name Employee": d.get('employee_name', ''),
                "Training Name": d.get('training_name', ''),
                "Date From": d.get('v_training_date_from', ''),
                "Date To": d.get('v_training_date_to', ''),
                "Result": d.get('status_result', ''),
                "Score": d.get('training_score', '')
            })
            
        if not data:
            return jsonify({'status': 'error', 'message': 'Tidak ada data untuk diexport'}), 400
            
        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Data OS Training')        
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
        all_trainings = training_m.query.all()
        training_names = [t.training_name for t in all_trainings]
        
        if training_names:
            clean_names = [name.replace('"', '""') for name in training_names]
            training_list_str = f'"{",".join(clean_names)}"'
        else:
            training_list_str = '"Basic Safety Training, Leadership Training"'
            
        result_list_str = '"Lulus, Tidak Lulus"'

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
            
            worksheet.column_dimensions['A'].width = 18 
            worksheet.column_dimensions['B'].width = 32 
            worksheet.column_dimensions['C'].width = 16 
            worksheet.column_dimensions['D'].width = 16 
            worksheet.column_dimensions['E'].width = 18 
            worksheet.column_dimensions['F'].width = 14 

            dv_training = DataValidation(
                type="list", 
                formula1=training_list_str, 
                allow_blank=True
            )
            dv_training.error = 'Silakan pilih Jenis Training dari daftar dropdown yang tersedia!'
            dv_training.errorTitle = 'Pilihan Tidak Valid'
            worksheet.add_data_validation(dv_training)
            dv_training.add("B2:B500")

            dv_result = DataValidation(
                type="list", 
                formula1=result_list_str, 
                allow_blank=True
            )
            dv_result.error = 'Pilihan harus Lulus atau Tidak Lulus!'
            dv_result.errorTitle = 'Pilihan Tidak Valid'
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
                        
                    t_name_raw = clean(row.get('Training Name'))
                    if not t_name_raw:
                        raise ValueError("Training Name tidak boleh kosong.")
                    t_name = str(t_name_raw).strip()
                    
                    exist_training = training_m.query.filter(training_m.training_name.ilike(t_name)).first()
                    if not exist_training:
                        raise ValueError(f"Jenis Training '{t_name}' tidak ditemukan di master data.")

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

                    raw_date_from = clean(row.get('Date From'))
                    raw_date_to = clean(row.get('Date To'))
                    raw_score = clean(row.get('Score'))
                    
                    if not raw_date_from or not raw_date_to:
                        raise ValueError("Tanggal 'Date From' dan 'Date To' tidak boleh kosong.")

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