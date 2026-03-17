import os, uuid, pandas as pd
from werkzeug.utils import secure_filename
from io import BytesIO
from datetime import datetime
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
        filter = request.args.get('filter', '', type=str)
        query = OsEmployment.query
        now = datetime.now()
        if search:
            query = query.join(OsPerson, OsEmployment.person_id == OsPerson.person_id)                     
            query = query.filter(
                or_(
                    OsEmployment.employee_id.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),                    
                )
            )
        if filter == 'active':
            query = query.filter(OsEmployment.valid_to >= now)
        elif filter == 'inactive':
            query = query.filter(OsEmployment.valid_to < now)
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
        person_id = target_person.person_id
        
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
        return jsonify({"message": 'Tidak ada file'}), 400
    
    try:
        df = pd.read_excel(file, dtype={'card number': str, 'employee_id': str, 'grade': str,})
        df = df.where(pd.notnull(df), None)
        errors = []
        success_count = 0
        for index, row in df.iterrows():
            try:
                with db.session.begin_nested():
                    person_id = None
                    subCom_id = None                
                    # --- PROSES PERSON ---
                    nama_input = str(row['nama']).strip() if row['nama'] else ""
                    nik_input = str(row['resident_id']).strip() if row['resident_id'] else ""                
                    existing_person = OsPerson.query.filter(OsPerson.resident_id == nik_input).first()
                    if existing_person:
                        person_id = existing_person.person_id       
                    else:
                        person_by_name = OsPerson.query.filter(OsPerson.name.ilike(nama_input)).first()            
                        if person_by_name:
                            person_id = person_by_name.person_id
                            if not person_by_name.resident_id:                        
                                person_by_name.resident_id = nik_input
                                db.session.add(person_by_name)
                        else:
                            newPerson = OsPerson(
                                name=nama_input,
                                gender=row['gender'],            
                                pob=row['pob'],
                                dob=row['dob'],
                                religion=row['religion'],
                                resident_id=nik_input,
                                address=row['address']
                            )
                            db.session.add(newPerson)
                            db.session.flush()
                            person_id = newPerson.person_id
                    # --- PROSES EMPLOYMENT & DEPENDENCIES ---
                    subCom_name = str(row['SubCompany']).strip() if row['SubCompany'] else ""
                    exist_subCom = SubCompany.query.filter(SubCompany.sub_company_name.ilike(subCom_name)).first()                
                    if not exist_subCom:
                        raise Exception(f"Sub Company '{subCom_name}' tidak terdaftar.")
                    subCom_id = exist_subCom.sub_company_id
                    if person_id and subCom_id:
                        newEmployment = OsEmployment(
                            employee_id = row['employee_id'],
                            sub_company_id = subCom_id,
                            person_id = person_id,
                            valid_from = row['valid from'],
                            valid_to = row['valid to']
                        )
                        db.session.add(newEmployment)
                        db.session.flush()
                        # --- PROSES CARD, GRADE, CC (Hanya jika employment berhasil) ---
                        # Card
                        db.session.add(OsCard(
                            employee_id = newEmployment.employee_id,
                            card_number = clean_str(row['card number']),
                            valid_from = row['card valid from'],
                            valid_to = row['card valid to']
                        ))                    
                        # Grade
                        db.session.add(OsGrade(
                            employee_id = newEmployment.employee_id,
                            grade = clean_str(row['grade']),
                            valid_from = row['valid from'],
                            valid_to = row['valid to']
                        ))
                        #CC
                        cc_name = str(row['Department']).strip() if row['Department'] else ""
                        exist_cc = costCenter.query.filter(costCenter.org_name.ilike(cc_name)).first()                
                        if not exist_cc:
                            raise Exception(f"Department '{cc_name}' tidak terdaftar.")
                        subCom_id = exist_cc.cost_center
                        db.session.add(OsCostCenter(
                            employee_id = newEmployment.employee_id,
                            cc_id = exist_cc.cost_center,
                            valid_from = row['valid from'],
                            valid_to = row['valid to']
                        ))
                        #canteen if exist cc
                        #canteen
                        if exist_cc:
                            cc_def = canteen.query.join(canteenDetail, canteen.canteen_id == canteenDetail.canteen_id).filter(canteenDetail.cc_id.ilike(exist_cc.cost_center)).first()
                            newAlokasi = Alokasi(
                                employee_id = newEmployment.employee_id,
                                canteen_id = cc_def.canteen_id,
                                valid_from = row['valid from'],
                                valid_to = row['valid to']
                            )
                            db.session.add(newAlokasi)
                    else:
                        raise Exception("Data person atau company tidak lengkap.")
            except Exception as e:
                errors.append(f"Baris {index+2}: {str(e)}")
                continue
        # FINAL DECISION
        db.session.commit()
        if success_count > 0:
            msg = f"Berhasil mengimport {success_count} data."
            if errors:
                return jsonify({
                    "status": "partial_success", 
                    "message": f"{msg} Namun ada beberapa error.",
                    "errors": errors
                }), 200
            return jsonify({"status": "success", "message": msg}), 200
        else:
            return jsonify({
                "status": "error", 
                "message": "Tidak ada data yang berhasil diimport.",
                "errors": errors
            }), 400
    except Exception as e:
        return jsonify({"message": f"Fatal Error: {str(e)}"}), 500

@employee_bp.route('/employee/export', methods=['GET'])
def export():
    try:
        master = OsEmployment.query.all()
        data = []
        for m in master:
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

# @employee_bp.before_request
# @login_required
# def before_request():
#     pass