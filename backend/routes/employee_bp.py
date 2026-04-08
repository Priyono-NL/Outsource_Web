import os, uuid, pandas as pd
from werkzeug.utils import secure_filename
from io import BytesIO
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_

from extensions import db
from .auth_bp import login_required
from model.employment import OsEmployment
from model.person import OsPerson
from model.subCompany import SubCompany
from model.costCenter import costCenter
from model.canteen import canteen, canteenDetail

from model.card import OsCard
from model.osCostCenter import OsCostCenter
from model.grade import OsGrade
from model.alokasi import Alokasi

employee_bp = Blueprint('employee_bp', __name__)

UPLOAD_FOLDER = 'static/uploads/photos'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def clean_str(val):
    if val is None or pd.isna(val):
        return None
    return str(val).strip()

@employee_bp.route('/employee')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)

        status = request.args.get('status', 'all', type=str)
        sub_company_id = request.args.get('sub_company', '', type=str)
        department_id = request.args.get('department', '', type=str)

        query = OsEmployment.query
        now = datetime.now()
        if search:
            query = query.join(OsPerson)
            query = query.join(OsCard)    
            query = query.filter(
                or_(
                    OsEmployment.employee_id.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),
                    OsCard.card_number.ilike(f"%{search}%")
                )
            )

        if status == 'active':
            query = query.filter((OsEmployment.valid_to >= now) | (OsEmployment.valid_to == None))
        elif status == 'inactive':
            query = query.filter(OsEmployment.valid_to < now)

        if sub_company_id:
            query = query.filter(OsEmployment.sub_company_id == sub_company_id)

        if department_id:
            query = query.join(OsCostCenter)
            query = query.filter(OsCostCenter.cc_id == department_id)
        
        pagination = query.paginate(page=page, per_page=pageSize, error_out=False)
        return jsonify({
            "status": "success",
            "data": [emp.to_dict() for emp in pagination.items],
            "total_page": pagination.pages,
            "current_page": pagination.page,
            "total_item": pagination.total
        }), 200
    except Exception as e:
        import traceback
        traceback.print_exc()    
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@employee_bp.route('/employee/search/<string:emp_id>', methods=['GET'])
def search_employee(emp_id):
    try:
        result = db.session.query(OsPerson.name) \
            .join(OsEmployment, OsPerson.person_id == OsEmployment.person_id) \
            .filter(OsEmployment.employee_id == emp_id) \
            .first()
        if result:
            return jsonify({"status": "success", "full_name": result.name}), 200
        return jsonify({"status": "error", "message": "Employee ID tidak Ada"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@employee_bp.route('/employee/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form        
        #person
        person_id = data.get('person_id')
        if not person_id or person_id == "" or person_id == "undefined":
            target_person = OsPerson(
                name = data.get('nama'),
                gender = data.get('gender'),            
                pob = data.get('pob'),
                dob = data.get('dob'),
                religion = data.get('religion'),
                resident_id = data.get('resident_id'),
                address = data.get('address')
            )
        else:
            target_person = OsPerson.query.get(person_id)
            target_person.name = data.get('nama', target_person.name)
            target_person.gender = data.get('gender', target_person.gender)
            target_person.pob = data.get('pob', target_person.pob)
            target_person.dob = data.get('dob', target_person.dob)
            target_person.religion = data.get('religion', target_person.religion)
            target_person.resident_id = data.get('resident_id', target_person.resident_id)

        if 'photo' in request.files:
            file = request.files['photo']
            if file.filename != '':
                ext = os.path.splitext(file.filename)[1].lower()
                new_filename = f"{uuid.uuid4().hex}{ext}"
                file_path = os.path.join(UPLOAD_FOLDER, new_filename)
                file.save(file_path)
                target_person.photo = f"/{UPLOAD_FOLDER}/{new_filename}"

        db.session.add(target_person)
        db.session.flush()        
        #cek data lama
        person_id = target_person.person_id
        new_start_date = datetime.strptime(data.get('valid_from'), '%Y-%m-%d').date()
        adjusted_valid_to = new_start_date - timedelta(days=1)
        current_employment = OsEmployment.query.filter(
            OsEmployment.person_id == person_id,
            (OsEmployment.valid_to >= new_start_date) | (OsEmployment.valid_to == None)
        ).first()
        active_emp_id = current_employment.employee_id if current_employment else data.get('employee_id')
        target_models = [
            {"model": OsEmployment, "filter_field": "person_id", "filter_value": person_id},
            {"model": OsCard, "filter_field": "card_number", "filter_value": data.get('card_number')},
            {"model": OsGrade, "filter_field": "employee_id", "filter_value": active_emp_id},
            {"model": OsCostCenter, "filter_field": "employee_id", "filter_value": active_emp_id},
            {"model": Alokasi, "filter_field": "employee_id", "filter_value": active_emp_id},
        ]
        for item in target_models:
            Model = item["model"]
            field = item["filter_field"]
            val = item["filter_value"]
            old_records = Model.query.filter(
                getattr(Model, field) == val,
                (Model.valid_to >= new_start_date) | (Model.valid_to == None) 
            ).all()
            if old_records:
                for rec in old_records:
                    rec.valid_to = adjusted_valid_to
                    db.session.add(rec)                        
        db.session.flush()
        #employment
        newEmployment = OsEmployment(
            employee_id = data.get('employee_id'),
            sub_company_id = data.get('sub_company_id'),
            person_id = person_id,
            valid_from = data.get('valid_from'),
            valid_to = data.get('valid_to')
        )
        db.session.add(newEmployment)
        db.session.flush()
        #card
        newCard = OsCard(
            employee_id = newEmployment.employee_id,
            card_number = data.get('card_number'),
            valid_from = data.get('c_valid_from'),
            valid_to = data.get('c_valid_to')
        )
        db.session.add(newCard)
        #grade        
        newGrade = OsGrade(
            employee_id = newEmployment.employee_id,
            grade = data.get('grade'),
            valid_from = data.get('valid_from'),
            valid_to = data.get('valid_to')
        )       
        db.session.add(newGrade)
        #org cost center
        newCC = OsCostCenter(
            employee_id = newEmployment.employee_id,
            cc_id = data.get('cc_id'),
            valid_from = data.get('valid_from'),
            valid_to = data.get('valid_to')
        )       
        db.session.add(newCC)
        #canteen
        if (data.get('cc_id')):
            cc_def = canteen.query.join(canteenDetail, canteen.canteen_id == canteenDetail.canteen_id).filter(canteenDetail.cc_id.ilike(data.get('cc_id'))).first()
            newAlokasi = Alokasi(
                employee_id = newEmployment.employee_id,
                canteen_id = cc_def.canteen_id,
                valid_from = data.get('valid_from'),
                valid_to = data.get('valid_to')
            )
            db.session.add(newAlokasi)            
        #commit all
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

@employee_bp.route('/employee/template', methods=['GET'])
def template():
    try:
        example_data = [{
            "nama": "Budi Contoh",
            "gender": "L",
            "pob": "Bandung",
            "dob": "2026-03-20",
            "religion": "Islam",
            "resident_id": "32xxxx",
            "address": "Alamat Rumah",
            "employee_id": "123456",
            "grade": "1",
            "SubCompany":"",
            "Department": "",
            "valid from": "2026-03-10",
            "valid to": "2026-03-11",
            "card number": "12345.12345",
            "card valid from": "2026-03-10",
            "card valid to": "2026-03-11"
        }]
        df = pd.DataFrame(example_data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Template_Import')
        output.seek(0)
        return send_file(
            output, 
            as_attachment=True, 
            download_name="Template_Import.xlsx"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@employee_bp.route('/employee/upload', methods=['POST'])
def upload():
    file = request.files.get('file')
    if not file:
        return jsonify({"message": 'Mohon pilih file Excel terlebih dahulu.'}), 400
    
    try:
        df = pd.read_excel(file, dtype={'card number': str, 'employee_id': str, 'grade': str})
        df = df.where(pd.notnull(df), None)
        
        required_columns = ['nama', 'resident_id', 'employee_id', 'SubCompany', 'Department']
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            return jsonify({"message": f"Format Excel salah. Kolom berikut tidak ditemukan: {', '.join(missing_cols)}"}), 400

        errors = []
        success_count = 0

        for index, row in df.iterrows():
            line_number = index + 2  # Baris di Excel (index 0 + header)
            try:
                with db.session.begin_nested():
                    nama_input = str(row['nama']).strip() if row.get('nama') else None
                    nik_input = str(row['resident_id']).strip() if row.get('resident_id') else None
                    emp_id = str(row['employee_id']).strip() if row.get('employee_id') else None

                    if not nama_input or not nik_input or not emp_id:
                        raise ValueError("Nama, NIK, dan Employee ID tidak boleh kosong.")

                    person_id = None
                    existing_person = OsPerson.query.filter(OsPerson.resident_id == nik_input).first()
                    
                    if existing_person:
                        person_id = existing_person.person_id 
                    else:
                        person_by_name = OsPerson.query.filter(OsPerson.name.ilike(nama_input)).first()
                        if person_by_name:
                            person_id = person_by_name.person_id
                            if not person_by_name.resident_id:
                                person_by_name.resident_id = nik_input
                        else:
                            newPerson = OsPerson(
                                name=nama_input,
                                gender=row.get('gender'),
                                pob=row.get('pob'),
                                dob=row.get('dob'),
                                religion=row.get('religion'),
                                resident_id=nik_input,
                                address=row.get('address')
                            )
                            db.session.add(newPerson)
                            db.session.flush()
                            person_id = newPerson.person_id

                    subCom_name = str(row['SubCompany']).strip()
                    exist_subCom = SubCompany.query.filter(SubCompany.sub_company_name.ilike(subCom_name)).first()
                    if not exist_subCom:
                        raise ValueError(f"Sub Company '{subCom_name}' tidak terdaftar di sistem.")
                    
                    #cek data lama
                    raw_start_date = row.get('valid from')
                    if isinstance(raw_start_date, str):
                        new_start_date = datetime.strptime(raw_start_date.strip(), '%Y-%m-%d').date()
                    else:
                        new_start_date = raw_start_date.date()
                    adjusted_valid_to = new_start_date - timedelta(days=1)
                    current_employment = OsEmployment.query.filter(
                        OsEmployment.person_id == person_id,
                        (OsEmployment.valid_to >= new_start_date) | (OsEmployment.valid_to == None)
                    ).first()
                    active_emp_id = current_employment.employee_id if current_employment else str(row.get('employee_id')).strip()
                    target_models = [
                        {"model": OsEmployment, "filter_field": "person_id", "filter_value": person_id},
                        {"model": OsCard, "filter_field": "card_number", "filter_value": row.get('card number')},
                        {"model": OsGrade, "filter_field": "employee_id", "filter_value": active_emp_id},
                        {"model": OsCostCenter, "filter_field": "employee_id", "filter_value": active_emp_id},
                        {"model": Alokasi, "filter_field": "employee_id", "filter_value": active_emp_id},
                    ]
                    for item in target_models:
                        Model = item["model"]
                        field = item["filter_field"]
                        val = item["filter_value"]
                        old_records = Model.query.filter(
                            getattr(Model, field) == val,
                            (Model.valid_to >= new_start_date) | (Model.valid_to == None) 
                        ).all()
                        if old_records:
                            for rec in old_records:
                                rec.valid_to = adjusted_valid_to
                                db.session.add(rec)                        
                    db.session.flush()

                    #employment
                    existing_emp = OsEmployment.query.filter(
                        OsEmployment.id == emp_id,
                        OsEmployment.valid_from < datetime.now() )
                    if existing_emp:
                        nama_lama = existing_emp.person.name if existing_emp.person else "Tidak diketahui"
                        raise Exception(f"ID '{emp_id}' sudah digunakan oleh '{nama_lama}'.")

                    newEmployment = OsEmployment(
                        employee_id=emp_id,
                        sub_company_id=exist_subCom.sub_company_id,
                        person_id=person_id,
                        valid_from=row.get('valid from'),
                        valid_to=row.get('valid to')
                    )
                    db.session.add(newEmployment)
                    db.session.flush()

                    # Card
                    db.session.add(OsCard(
                        employee_id=emp_id,
                        card_number=str(row.get('card number', '')).strip(),
                        valid_from=row.get('card valid from'),
                        valid_to=row.get('card valid to')
                    ))

                    # Grade
                    db.session.add(OsGrade(
                        employee_id=emp_id,
                        grade=str(row.get('grade', '')).strip(),
                        valid_from=row.get('valid from'),
                        valid_to=row.get('valid to')
                    ))

                    # Cost Center (Department)
                    cc_name = str(row['Department']).strip()
                    exist_cc = costCenter.query.filter(costCenter.org_name.ilike(cc_name)).first()
                    if not exist_cc:
                        raise ValueError(f"Department/CC '{cc_name}' tidak ditemukan.")

                    db.session.add(OsCostCenter(
                        employee_id=emp_id,
                        cc_id=exist_cc.cost_center,
                        valid_from=row.get('valid from'),
                        valid_to=row.get('valid to')
                    ))

                    # Canteen Allocation
                    cc_def = canteen.query.join(canteenDetail, canteen.canteen_id == canteenDetail.canteen_id)\
                                          .filter(canteenDetail.cc_id == exist_cc.cost_center).first()
                    if cc_def:
                        db.session.add(Alokasi(
                            employee_id=emp_id,
                            canteen_id=cc_def.canteen_id,
                            valid_from=row.get('valid from'),
                            valid_to=row.get('valid to')
                        ))
                
                # JIKA SAMPAI SINI TANPA ERROR
                success_count += 1

            except ValueError as ve:
                errors.append(f"Baris {line_number}: {str(ve)}")
            except Exception as e:
                errors.append(f"Baris {line_number}: {str(e)}")
                print(f"Detail Error Baris {line_number}: {str(e)}")

        db.session.commit()

        if success_count > 0:
            status = "success" if not errors else "partial_success"
            msg = f"Berhasil mengimport {success_count} data."
            return jsonify({
                "status": status,
                "message": msg,
                "errors": errors
            }), 200
        else:
            return jsonify({
                "status": "error",
                "message": "Tidak ada data yang berhasil diimport. Silakan periksa file Anda.",
                "errors": errors
            }), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Terjadi kesalahan fatal saat membaca file: {str(e)}"}), 500

@employee_bp.route('/employee/export', methods=['GET'])
def export():
    try:
        search = request.args.get('search', '', type=str)
        status = request.args.get('status', 'all', type=str)
        sub_company_id = request.args.get('sub_company', '', type=str)
        department_id = request.args.get('department', '', type=str)

        query = OsEmployment.query
        now = datetime.now()

        if search:
            query = query.join(OsPerson)
            query = query.join(OsCard)    
            query = query.filter(
                or_(
                    OsEmployment.employee_id.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),
                    OsCard.card_number.ilike(f"%{search}%")
                )
            )

        if status == 'active':
            query = query.filter((OsEmployment.valid_to >= now) | (OsEmployment.valid_to == None))
        elif status == 'inactive':
            query = query.filter(OsEmployment.valid_to < now)

        if sub_company_id:
            query = query.filter(OsEmployment.sub_company_id == sub_company_id)

        if department_id:
            query = query.join(OsCostCenter)
            query = query.filter(OsCostCenter.cc_id == department_id)
        
        filtered_employees = query.all()
        
        data = []
        for m in filtered_employees:
            d = m.to_dict()
            data.append({
                "Name": d['person_name'],
                "Gender": d['gender'],
                "Religion": d['religion'],
                "Place of Birth": d['pob'],
                "Date of Birth": d['v_dob'],                
                "Resident ID": d['resident_id'],
                "Address": d['address'],
                "Employee ID": d['employee_id'],
                "Sub Company": d['sub_con_name'],
                "Department": d['cc_name'],
                "Grade": d['grade'],
                "Valid From": d['v_valid_from'],
                "Valid To": d['valid_to'],
                "Card Number": d['card_number'],
                "Card Valid From": d['card_number_from'],
                "Card Valid To": d['card_number_to']
            })
        if not data:
            return jsonify({'status': 'error', 'message': 'tidak ada data'})
        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Data OS')        
        output.seek(0)
        return send_file(
            output, 
            as_attachment=True, 
            download_name="Export_OS.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@employee_bp.route("/employee/stats", methods=['GET'])
def get_employee_stats():
    now = datetime.now()
    total_active = OsEmployment.query.filter((OsEmployment.valid_to >= now) | (OsEmployment.valid_to == None)).count()
    total_inactive = OsEmployment.query.filter(OsEmployment.valid_to <= now).count()
    return jsonify({
        "status": "success",
        "data": {
            "total_active": total_active,
            "total_inactive": total_inactive,
        }
    }), 200

# @employee_bp.before_request
# @login_required
# def before_request():
#     pass