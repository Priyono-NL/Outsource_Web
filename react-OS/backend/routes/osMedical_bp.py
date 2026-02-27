from flask import Blueprint, request, jsonify
from extensions import db
from model.osMedical import osMedical

osMedical_bp = Blueprint('osMedical_bp', __name__)

@osMedical_bp.route('/osmedical')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        pagination = osMedical.query.paginate(page=page, per_page=pageSize, error_out=False)
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
        employee_id = data.get('employee_id')
        medical_id = data.get('medical_id')
        medical_date = data.get('medical_date')
        medical_result = data.get('medical_result')
        medical_notes = data.get('medical_notes')
        
        new_osMedical = osMedical(
            employee_id=employee_id,
            medical_id=medical_id,
            medical_date=medical_date,
            medical_result=medical_result,
            medical_notes=medical_notes,
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
        osMedical_data = osMedical.query.filter_by(id=id).first()
        db.session.delete(osMedical_data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500