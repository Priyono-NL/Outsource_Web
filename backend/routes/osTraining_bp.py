import pandas as pd
from io import BytesIO
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_
from extensions import db
from model.training import training_m
from model.osTraining import osTraining
from model.employment import OsEmployment
from model.person import OsPerson
from .auth_bp import login_required

osTraining_bp = Blueprint('osTraining_bp', __name__)

@osTraining_bp.route('/ostraining')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        query = osTraining.query
        if search:
            query = query.join(OsEmployment, osTraining.employee_id == OsEmployment.id) \
                     .join(OsPerson, OsEmployment.person_id == OsPerson.person_id)                     
            query = query.filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),                    
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
            query = query.join(OsEmployment, osTraining.employee_id == OsEmployment.id) \
                     .join(OsPerson, OsEmployment.person_id == OsPerson.person_id)                     
            query = query.filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),                    
                )
            )
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
            download_name="Export_OS_Medical.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    
@osTraining_bp.route('/ostraining/template', methods=['GET'])
def template():
    try:
        example_data = [{
            "ID Employee": "12345",
            "Training Name": "Training K3L",
            "Date From": "2026-03-04",
            "Date To": "2026-03-04",
            "Result": "lulus/tidak lulus",
            "Score": "80"
        }]
        df = pd.DataFrame(example_data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Template_Import')
        output.seek(0)
        return send_file(
            output, 
            as_attachment=True, 
            download_name="Template_Import_Training.xlsx"
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
        all_medical = training_m.query.all()
        training_map = {m.training_name.lower(): m.training_id for m in all_medical}
        all_employees = OsEmployment.query.with_entities(OsEmployment.employee_id).all()
        valid_employee_ids = {str(e.employee_id) for e in all_employees}
        errors = []
        to_save = []
        for index, row in df.iterrows():
            e_id = str(row['ID Employee']).strip()
            m_name = str(row['Training Name']).lower().strip()
            m_id = training_map.get(m_name)
            if e_id not in valid_employee_ids:
                errors.append(f"Baris {index+2}: ID Employee '{e_id}' tidak terdaftar di sistem.")
                continue
            if not m_id:
                errors.append(f"Baris {index+2}: Jenis Training '{row['Training Name']}' tidak ditemukan.")
                continue
            raw_result = str(row['Result']).strip().lower()
            if raw_result == 'lulus':
                training_val = 1
            elif raw_result == 'tidak lulus':
                training_val = 0
            else:
                errors.append(f"Baris {index+2}: Kolom Result harus berisi 'Lulus' atau 'Tidak Lulus'.")
                continue
            new_training = osTraining(
                employee_id=int(e_id),
                training_id=m_id,
                training_date_from=pd.to_datetime(row['Date From']),
                training_date_to=pd.to_datetime(row['Date To']),
                training_result=training_val,
                training_score=row['Score']
            )
            to_save.append(new_training)
        if errors:
            return jsonify({
                "status": "error", 
                "message": "Import gagal karena beberapa data tidak valid.",
                "errors": errors
            }), 400
        db.session.add_all(to_save)
        db.session.commit()
        return jsonify({"status": "success", "message": f"Berhasil mengimport {len(to_save)} data."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500  
    
# @osTraining_bp.before_request
# @login_required
# def before_request():
#     pass