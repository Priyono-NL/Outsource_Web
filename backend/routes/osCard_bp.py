import pandas as pd
from io import BytesIO
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_
from extensions import db
from model.card import OsCard
from model.employment import OsEmployment
from model.person import OsPerson
from .auth_bp import login_required

osCard_bp = Blueprint('osCard_bp', __name__)

@osCard_bp.route('/oscard')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        query = OsCard.query
        if search:
            query = query.join(OsEmployment, OsCard.employee_id == OsEmployment.employee_id) \
                     .join(OsPerson, OsEmployment.person_id == OsPerson.person_id)                     
            query = query.filter(
                or_(
                    OsCard.employee_id.cast(db.String).ilike(f"%{search}%"),
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

@osCard_bp.route('/oscard/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form
        new_OsCard = OsCard(
            employee_id = data.get('employee_id'),
            card_number = data.get('card_number'),
            valid_from = data.get('valid_from'),
            valid_to = data.get('valid_to')
        )
        db.session.add(new_OsCard)
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

@osCard_bp.route('/oscard/<string:id>', methods=['PUT'])
def update(id):
    try:
        OsCard_data = OsCard.query.filter_by(id=id).first()
        data = request.json
        OsCard_data.employee_id = data.get('employee_id', OsCard_data.employee_id)
        OsCard_data.card_number = data.get('card_number', OsCard_data.card_number)
        OsCard_data.valid_from = data.get('valid_from', OsCard_data.valid_from)
        if 'valid_to' in data:
            new_valid_to = data.get('valid_to')
            OsCard_data.valid_to = new_valid_to if new_valid_to else None
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@osCard_bp.route('/oscard/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = OsCard.query.filter_by(id=id).first()
        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500
    
@osCard_bp.route('/oscard/export', methods=['GET'])
def export():
    try:
        master = OsCard.query.all()
        data = []
        for m in master:
            d = m.to_dict()
            data.append({
                "Employee ID": d['employee_id'],
                "Employee Name": d['employee_name'],
                "Card Number": d['medical_name'],
                "Valid From": d['v_valid_from'],
                "Valid To": d['valid_to'],
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
    
@osCard_bp.route('/oscard/template', methods=['GET'])
def template():
    try:
        example_data = [{
            "ID Employee": "12345",
            "Card Number": "12345.12345",
            "Valid From": "2026-03-20",
            "Valid To": "SEHAT",
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

@osCard_bp.route('/oscard/upload', methods=['POST'])
def upload():
    file = request.files.get('file')
    if not file:
        return jsonify({'message': 'Tidak ada file'}), 400
    try:
        df = pd.read_excel(file)
        all_employees = OsEmployment.query.with_entities(OsEmployment.employee_id).all()
        valid_employee_ids = {str(e.employee_id) for e in all_employees}
        errors = []
        to_save = []
        for index, row in df.iterrows():
            e_id = str(row['ID Employee']).strip()
            m_name = str(row['Medical Name']).lower().strip()
            if e_id not in valid_employee_ids:
                errors.append(f"Baris {index+2}: ID Employee '{e_id}' tidak terdaftar di sistem.")
                continue            
            new_medical = OsCard(
                employee_id=int(e_id),
                card_number=row['Card Number'],
                valid_from=pd.to_datetime(row['Valid From']),
                valid_to=pd.to_datetime(row['Valid To']),
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
    
@osCard_bp.before_request
@login_required
def before_request():
    pass