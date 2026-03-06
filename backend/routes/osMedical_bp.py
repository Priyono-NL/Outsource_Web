import pandas as pd
from io import BytesIO
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_
from extensions import db
from model.medical import medical
from model.osMedical import osMedical
from model.employment import OsEmployment
from model.person import OsPerson
from .auth_bp import login_required

osMedical_bp = Blueprint('osMedical_bp', __name__)

@osMedical_bp.route('/osmedical')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        query = osMedical.query
        if search:
            query = query.join(OsEmployment, osMedical.employee_id == OsEmployment.employee_id) \
                     .join(OsPerson, OsEmployment.person_id == OsPerson.person_id)                     
            query = query.filter(
                or_(
                    osMedical.employee_id.cast(db.String).ilike(f"%{search}%"),
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
        osMedical.query.filter_by(id=id).delete()
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500
    
@osMedical_bp.route('/osmedical/export', methods=['GET'])
def export():
    try:
        master = osMedical.query.all()
        data = []
        for m in master:
            d = m.to_dict()
            data.append({
                "ID Karyawan": d['employee_id'],
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
        example_data = [{
            "ID Employee": "12345",
            "Medical Name": "Medical Check Up",
            "Date": "2026-03-20",
            "Result": "SEHAT",
            "Notes": ""
        }]
        df = pd.DataFrame(example_data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Template_Import')
        output.seek(0)
        return send_file(
            output, 
            as_attachment=True, 
            download_name="Template_Import_Medical.xlsx"
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
        all_medical = medical.query.all()
        medical_map = {m.medical_name.lower(): m.medical_id for m in all_medical}
        all_employees = OsEmployment.query.with_entities(OsEmployment.employee_id).all()
        valid_employee_ids = {str(e.employee_id) for e in all_employees}
        errors = []
        to_save = []
        for index, row in df.iterrows():
            e_id = str(row['ID Employee']).strip()
            m_name = str(row['Medical Name']).lower().strip()
            m_id = medical_map.get(m_name)
            if e_id not in valid_employee_ids:
                errors.append(f"Baris {index+2}: ID Employee '{e_id}' tidak terdaftar di sistem.")
                continue
            if not m_id:
                errors.append(f"Baris {index+2}: Jenis Medical '{row['Medical Name']}' tidak ditemukan.")
                continue
            new_medical = osMedical(
                employee_id=int(e_id),
                medical_id=m_id,
                medical_date=pd.to_datetime(row['Date']),
                medical_result=row['Result'],
                medical_notes=row['Notes']
            )
            to_save.append(new_medical)
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
    
@osMedical_bp.before_request
@login_required
def before_request():
    pass