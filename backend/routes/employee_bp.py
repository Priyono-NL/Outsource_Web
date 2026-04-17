import os, uuid, pandas as pd
from werkzeug.utils import secure_filename
from io import BytesIO
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_

from extensions import db
from .auth_bp import login_required
from model.blacklist import OsBlacklist
from model.employment import OsEmployment
from model.person import OsPerson
from model.subCompany import SubCompany
from model.costCenter import costCenter
from model.canteen import canteen, canteenDetail
from model.osType import osType
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
                    OsEmployment.employee_code.cast(db.String).ilike(f"%{search}%"),
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
        now = datetime.now()
        result = db.session.query(OsPerson.name, OsEmployment.id) \
            .join(OsEmployment, OsPerson.person_id == OsEmployment.person_id) \
            .filter(
                OsEmployment.employee_code == emp_id,
            ) \
            .first()
        if result:
            return jsonify({"status": "success", "full_name": result.name, "emp_pk_id": result.id}), 200
        return jsonify({"status": "error", "message": "Employee ID tidak Ada"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@employee_bp.route('/employee/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form

        if not data.get('nama') or str(data.get('nama')).strip() == "":
            return jsonify({"status": "error", "message": "Nama wajib diisi!"}), 400

        if not data.get('employee_id') or str(data.get('employee_id')).strip() == "":
            return jsonify({"status": "error", "message": "ID Karyawan wajib diisi!"}), 400

        new_start_date = datetime.strptime(data.get('valid_from'), '%Y-%m-%d').date()
        adjusted_valid_to = new_start_date - timedelta(days=1)
        employee_code_input = data.get('employee_id')
        card_number_input = data.get('card_number')

        if card_number_input:
            duplicate_card = OsCard.query.filter(
                OsCard.card_number == card_number_input,
                (OsCard.valid_to >= new_start_date) | (OsCard.valid_to == None)
            ).first()

            if duplicate_card:
                raise Exception(f"Kartu nomor {card_number_input} sudah aktif digunakan oleh record lain.")
        
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
        person_id = target_person.person_id        

        existing_active_emp = OsEmployment.query.filter(
            OsEmployment.employee_code == employee_code_input,
            (OsEmployment.valid_to >= new_start_date) | (OsEmployment.valid_to == None)
        ).first()

        if existing_active_emp:
            active_emp_pk_id = existing_active_emp.id
            
            target_models = [
                {"model": OsEmployment, "field": "person_id",   "val": person_id},
                {"model": OsCard,       "field": "card_number", "val": card_number_input},
                {"model": OsGrade,      "field": "employee_id", "val": active_emp_pk_id},
                {"model": osType,      "field": "employee_id", "val": active_emp_pk_id},
                {"model": OsCostCenter, "field": "employee_id", "val": active_emp_pk_id},
                {"model": Alokasi,      "field": "employee_id", "val": active_emp_pk_id},
            ]

            for item in target_models:                
                Model = item["model"]
                field_name = item["field"]
                value = item["val"]

                if value is None:
                    continue

                old_records = Model.query.filter(
                    getattr(Model, field_name) == value,
                    (Model.valid_to >= new_start_date) | (Model.valid_to == None),
                    Model.valid_from <= adjusted_valid_to
                ).all()

                for rec in old_records:
                    rec.valid_to = adjusted_valid_to
                    db.session.add(rec)
            
        db.session.flush()
        #employment
        newEmployment = OsEmployment(
            employee_code = employee_code_input,
            sub_company_id = data.get('sub_company_id'),
            person_id = person_id,
            valid_from = data.get('valid_from'),
            valid_to = data.get('valid_to')
        )
        db.session.add(newEmployment)
        db.session.flush()
        #card
        newCard = OsCard(
            employee_id = newEmployment.id,
            card_number = data.get('card_number'),
            valid_from = data.get('c_valid_from'),
            valid_to = data.get('c_valid_to')
        )
        db.session.add(newCard)
        #grade        
        newGrade = OsGrade(
            employee_id = newEmployment.id,
            grade = data.get('grade'),
            valid_from = data.get('valid_from'),
            valid_to = data.get('valid_to')
        )       
        db.session.add(newGrade)
        #type
        newType = osType(
            employee_id = newEmployment.id,
            type_worker = data.get('type_worker'),
            posisi = data.get('posisi'),
            valid_from = data.get('valid_from'),
            valid_to = data.get('valid_to')
        )
        db.session.add(newType)
        #org cost center
        newCC = OsCostCenter(
            employee_id = newEmployment.id,
            cc_id = data.get('cc_id'),
            valid_from = data.get('valid_from'),
            valid_to = data.get('valid_to')
        )       
        db.session.add(newCC)
        #canteen
        if (data.get('cc_id')):
            cc_def = canteen.query.join(canteenDetail, canteen.canteen_id == canteenDetail.canteen_id).filter(canteenDetail.cc_id.ilike(data.get('cc_id'))).first()
            newAlokasi = Alokasi(
                employee_id = newEmployment.id,
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

from datetime import datetime
from flask import request, jsonify
import os
import uuid

@employee_bp.route('/employee/<int:id>', methods=['PUT'])
def edit(id):
    try:
        data = request.json if request.is_json else request.form

        if not data.get('nama') or str(data.get('nama')).strip() == "":
            return jsonify({"status": "error", "message": "Nama wajib diisi!"}), 400

        if not data.get('employee_id') or str(data.get('employee_id')).strip() == "":
            return jsonify({"status": "error", "message": "ID Karyawan wajib diisi!"}), 400

        employee_code_input = data.get('employee_id')
        card_number_input = data.get('card_number')
        valid_from_input = data.get('valid_from')
        new_start_date = datetime.strptime(valid_from_input, '%Y-%m-%d').date() if valid_from_input else None

        target_emp = OsEmployment.query.get(id)
        if not target_emp:
            return jsonify({"status": "error", "message": "Data Employment tidak ditemukan!"}), 404

        if card_number_input:
            duplicate_card = OsCard.query.filter(
                OsCard.card_number == card_number_input,
                OsCard.employee_id != id,
                ((OsCard.valid_to >= new_start_date) | (OsCard.valid_to == None))
            ).first()

            if duplicate_card:
                raise Exception(f"Kartu nomor {card_number_input} sudah aktif digunakan oleh karyawan lain.")

        target_person = OsPerson.query.get(target_emp.person_id)
        if target_person:
            target_person.name = data.get('nama', target_person.name)
            target_person.gender = data.get('gender', target_person.gender)
            target_person.pob = data.get('pob', target_person.pob)
            target_person.dob = data.get('dob') or target_person.dob or None
            target_person.religion = data.get('religion', target_person.religion)
            target_person.resident_id = data.get('resident_id', target_person.resident_id)
            target_person.address = data.get('address', target_person.address)

            if 'photo' in request.files:
                file = request.files['photo']
                if file.filename != '':
                    ext = os.path.splitext(file.filename)[1].lower()
                    new_filename = f"{uuid.uuid4().hex}{ext}"
                    file_path = os.path.join(UPLOAD_FOLDER, new_filename)
                    file.save(file_path)
                    target_person.photo = f"/{UPLOAD_FOLDER}/{new_filename}"
            
            db.session.add(target_person)

        target_emp.employee_code = employee_code_input
        target_emp.sub_company_id = data.get('sub_company_id')
        target_emp.valid_from = data.get('valid_from') or None
        target_emp.valid_to = data.get('valid_to') or None
        db.session.add(target_emp)

        target_card = OsCard.query.filter_by(employee_id=id).first()
        if target_card:
            target_card.card_number = card_number_input
            target_card.valid_from = data.get('c_valid_from') or None
            target_card.valid_to = data.get('c_valid_to') or None
            db.session.add(target_card)
        elif card_number_input:
            newCard = OsCard(
                employee_id=id, 
                card_number=card_number_input, 
                valid_from=data.get('c_valid_from') or None, 
                valid_to=data.get('c_valid_to') or None
            )
            db.session.add(newCard)

        target_grade = OsGrade.query.filter_by(employee_id=id).first()
        if target_grade:
            target_grade.grade = data.get('grade')
            target_grade.valid_from = data.get('valid_from') or None
            target_grade.valid_to = data.get('valid_to') or None
            db.session.add(target_grade)

        target_type = osType.query.filter_by(employee_id=id).first()
        if target_type:
            target_type.type_worker = data.get('type_worker')
            target_type.posisi = data.get('posisi')
            target_type.valid_from = data.get('valid_from') or None
            target_type.valid_to = data.get('valid_to') or None
            db.session.add(target_type)

        target_cc = OsCostCenter.query.filter_by(employee_id=id).first()
        if target_cc:
            target_cc.cc_id = data.get('cc_id')
            target_cc.valid_from = data.get('valid_from') or None
            target_cc.valid_to = data.get('valid_to') or None
            db.session.add(target_cc)
        
        if data.get('cc_id'):
            cc_def = canteen.query.join(canteenDetail, canteen.canteen_id == canteenDetail.canteen_id).filter(canteenDetail.cc_id.ilike(data.get('cc_id'))).first()
            if cc_def:
                target_alokasi = Alokasi.query.filter_by(employee_id=id).first()
                if target_alokasi:
                    target_alokasi.canteen_id = cc_def.canteen_id
                    target_alokasi.valid_from = data.get('valid_from') or None
                    target_alokasi.valid_to = data.get('valid_to') or None
                    db.session.add(target_alokasi)
                else:
                    newAlokasi = Alokasi(
                        employee_id=id, 
                        canteen_id=cc_def.canteen_id, 
                        valid_from=data.get('valid_from') or None, 
                        valid_to=data.get('valid_to') or None
                    )
                    db.session.add(newAlokasi)

        db.session.commit()

        return jsonify({
            "status": "success",
            "message": "Data berhasil diperbarui!"
        }), 200

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
            "Type Worker": "DAILYWAGE / PIECERATE",
            "Posisi": "",
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
        df = pd.read_excel(file, dtype={'card number': str, 'employee_id': str, 'grade': str, 'resident_id': str})

        def clean(val):
            if pd.isna(val) or val == 'nan' or val == 'NaN':
                return None
            return val

        required_columns = ['nama', 'resident_id', 'employee_id', 'SubCompany', 'Department', 'valid from']
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            return jsonify({"message": f"Format Excel salah. Kolom berikut tidak ditemukan: {', '.join(missing_cols)}"}), 400

        errors = []
        success_count = 0

        for index, row in df.iterrows():
            line_number = index + 2
            try:
                with db.session.begin_nested():
                    nama_input = str(row['nama']).strip() if clean(row.get('nama')) else None
                    nik_input = clean(row.get('resident_id'))
                    emp_code_input = clean(row.get('employee_id'))

                    if not nama_input or not nik_input or not emp_code_input:
                        raise ValueError("Nama, NIK, dan Employee ID tidak boleh kosong.")

                    # --- 1. PERSON LOGIC & BLACKLIST CHECK ---
                    person_id = None
                    existing_person = OsPerson.query.filter(OsPerson.resident_id == nik_input).first()
                    
                    if existing_person:
                        person_id = existing_person.person_id
                        is_blacklisted = OsBlacklist.query.filter_by(person_id=person_id).first()
                        if is_blacklisted:
                            raise ValueError(f"Karyawan '{nama_input}' (NIK: {nik_input}) masuk daftar BLACKLIST.")
                        if not existing_person.resident_id:
                            existing_person.resident_id = nik_input
                    else:
                        person_by_name = OsPerson.query.filter(OsPerson.name.ilike(nama_input)).first()
                        if person_by_name:
                            person_id = person_by_name.person_id
                            is_blacklisted = OsBlacklist.query.filter_by(person_id=person_id).first()
                            if is_blacklisted:
                                raise ValueError(f"Karyawan '{nama_input}' masuk daftar BLACKLIST via Nama.")
                            if not person_by_name.resident_id:
                                person_by_name.resident_id = nik_input
                        else:
                            newPerson = OsPerson(
                                name=nama_input,
                                gender=clean(row.get('gender')),
                                pob=clean(row.get('pob')),
                                dob=clean(row.get('dob')),
                                religion=clean(row.get('religion')),
                                resident_id=nik_input,
                                address=clean(row.get('address'))
                            )
                            db.session.add(newPerson)
                            db.session.flush()
                            person_id = newPerson.person_id

                    # --- 2. SUBCOMPANY & DEPARTMENT CHECK ---
                    subCom_name = str(row['SubCompany']).strip() if clean(row.get('SubCompany')) else ""
                    exist_subCom = SubCompany.query.filter(SubCompany.sub_company_name.ilike(subCom_name)).first()
                    if not exist_subCom:
                        raise ValueError(f"Sub Company '{subCom_name}' tidak terdaftar.")
                    
                    cc_name = str(row['Department']).strip() if clean(row.get('Department')) else ""
                    exist_cc = costCenter.query.filter(costCenter.org_name.ilike(cc_name)).first()
                    if not exist_cc:
                        raise ValueError(f"Department/CC '{cc_name}' tidak ditemukan.")

                    # --- 3. SCD LOGIC (HISTORY CLOSING) ---
                    raw_start_date = clean(row.get('valid from'))
                    if not raw_start_date:
                        raise ValueError("Tanggal 'valid from' tidak boleh kosong.")
                    
                    # Parsing Date
                    if isinstance(raw_start_date, str):
                        new_start_date = datetime.strptime(raw_start_date.strip(), '%Y-%m-%d').date()
                    else:
                        new_start_date = raw_start_date.date() if hasattr(raw_start_date, 'date') else raw_start_date
                    
                    adjusted_valid_to = new_start_date - timedelta(days=1)
                    
                    existing_active_emp = OsEmployment.query.filter(
                        OsEmployment.employee_code == emp_code_input,
                        (OsEmployment.valid_to >= new_start_date) | (OsEmployment.valid_to == None)
                    ).first()

                    active_emp_pk_id = None
                    if existing_active_emp:
                        existing_active_emp.valid_to = adjusted_valid_to
                        db.session.add(existing_active_emp)
                        active_emp_pk_id = existing_active_emp.id

                        if active_emp_pk_id:
                            for M in [OsCard, OsGrade, osType, OsCostCenter, Alokasi]:
                                field = "card_number" if M == OsCard else "employee_id"
                                val = str(row.get('card number', '')).strip() if M == OsCard else active_emp_pk_id
                                
                                old_recs = M.query.filter(
                                    getattr(M, field) == val,
                                    (M.valid_to >= new_start_date) | (M.valid_to == None),
                                    M.valid_from <= adjusted_valid_to
                                ).all()
                                for r in old_recs:
                                    r.valid_to = adjusted_valid_to
                                    db.session.add(r)
                                    
                    db.session.flush()

                    # --- 4. INSERT DATA BARU (Handling NaN untuk valid_to) ---
                    new_valid_to = clean(row.get('valid to')) # Akan jadi None jika kosong/NaN

                    newEmployment = OsEmployment(
                        employee_code=emp_code_input,
                        sub_company_id=exist_subCom.sub_company_id,
                        person_id=person_id,
                        valid_from=new_start_date,
                        valid_to=new_valid_to
                    )
                    db.session.add(newEmployment)
                    db.session.flush()

                    # Card
                    card_num = clean(row.get('card number'))
                    if card_num and str(card_num).lower() != 'none':
                        db.session.add(OsCard(
                            employee_id=newEmployment.id,
                            card_number=str(card_num).strip(),
                            valid_from=clean(row.get('card valid from')),
                            valid_to=clean(row.get('card valid to')) # SEKARANG AMAN (None)
                        ))

                    # Grade
                    grade_val = clean(row.get('grade'))
                    if grade_val:
                        db.session.add(OsGrade(
                            employee_id=newEmployment.id,
                            grade=str(grade_val).strip(),
                            valid_from=new_start_date,
                            valid_to=new_valid_to
                        ))

                    # Cost Center & Alokasi (Gunakan new_valid_to yang sudah bersih)
                    db.session.add(OsCostCenter(
                        employee_id=newEmployment.id,
                        cc_id=exist_cc.cost_center,
                        valid_from=new_start_date,
                        valid_to=new_valid_to
                    ))

                    cc_def = canteen.query.join(canteenDetail, canteen.canteen_id == canteenDetail.canteen_id)\
                                        .filter(canteenDetail.cc_id == exist_cc.cost_center).first()
                    if cc_def:
                        db.session.add(Alokasi(
                            employee_id=newEmployment.id,
                            canteen_id=cc_def.canteen_id,
                            valid_from=new_start_date,
                            valid_to=new_valid_to
                        ))
                
                success_count += 1

            except ValueError as ve:
                errors.append(f"Baris {line_number}: {str(ve)}")
            except Exception as e:
                errors.append(f"Baris {line_number}: {str(e)}")

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
        return jsonify({"message": f"Terjadi kesalahan fatal: {str(e)}"}), 500

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
                    OsEmployment.employee_code.cast(db.String).ilike(f"%{search}%"),
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
                "Employee ID": d['employee_code'],
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

@employee_bp.route('/employee/deactivate/<int:pk_id>', methods=['PUT'])
def deactivate_employee(pk_id):
    try:
        emp = OsEmployment.query.get(pk_id)
        if not emp:
            return jsonify({"status": "error", "message": "Data tidak ditemukan"}), 404

        yesterday = datetime.now().date() - timedelta(days=1)
        emp.valid_to = yesterday
        db.session.add(emp)

        target_models = [OsCard, OsGrade, OsCostCenter, Alokasi]
        for Model in target_models:
            active_records = Model.query.filter(
                Model.employee_id == pk_id,
                (Model.valid_to >= yesterday) | (Model.valid_to == None)
            ).all()            
            for rec in active_records:
                rec.valid_to = yesterday
                db.session.add(rec)
        db.session.commit()
        return jsonify({
            "status": "success", 
            "message": f"Karyawan {emp.employee_code} berhasil dinonaktifkan per tanggal {yesterday.strftime('%d %b %Y')}"
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# @employee_bp.before_request
# @login_required
# def before_request():
#     pass