import pandas as pd
from io import BytesIO
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_
from extensions import db

from model.osTraining import osTraining
from model.employment import OsEmployment
from model.person import OsPerson

osTraining_bp = Blueprint('osTraining_bp', __name__)

@osTraining_bp.route('/ostraining')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        query = osTraining.query
        if search:
            query = query.join(OsEmployment, osTraining.employee_id == OsEmployment.employee_id) \
                     .join(OsPerson, OsEmployment.person_id == OsPerson.person_id)                     
            query = query.filter(
                or_(
                    osTraining.employee_id.cast(db.String).ilike(f"%{search}%"),
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
        osTraining.query.filter_by(id=id).delete()
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500

@osTraining_bp.route('/ostraining/export', methods=['GET'])
def export():
    try:
        master = osTraining.query.all()
        data = []
        for m in master:
            d = m.to_dict()
            data.append({
                "ID Karyawan": d['employee_id'],
                "Nama Karyawan": d['employee_name'],
                "Jenis Training": d['training_name'],
                "Tanggal Mulai": d['v_training_date_from'],
                "Tanggal Selesai": d['v_training_date_to'],
                "Hasil": d['training_result'],
                "Catatan": d['training_score']
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