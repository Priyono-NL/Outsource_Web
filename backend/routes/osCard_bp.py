import pandas as pd
from io import BytesIO
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_
from extensions import db
from model.card import OsCard
from model.employment import OsEmployment
from model.person import OsPerson


osCard_bp = Blueprint('osCard_bp', __name__)

@osCard_bp.route('/oscard')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        filter = request.args.get('filter', '', type=str)
        query = OsCard.query
        now = datetime.now()
        if search:
            query = query.join(OsEmployment, OsCard.employee_id == OsEmployment.id) \
                    .join(OsPerson, OsEmployment.person_id == OsPerson.person_id)                     
            query = query.filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),
                    OsCard.card_number.ilike(f"%{search}%"),
                )
            )
        if filter == 'active':
            query = query.filter((OsCard.valid_to >= now) | (OsCard.valid_to == None))
        elif filter == 'inactive':
            query = query.filter(OsCard.valid_to < now)
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
        previous_day = None
        new_from_date = None

        if data.get('valid_from'):
            try:
                new_from_dt = datetime.strptime(data.get('valid_from'), '%Y-%m-%d')
                new_from_date = new_from_dt.date()
                previous_day = new_from_date - timedelta(days=1)
            except ValueError:
                return jsonify({"status": "error", "message": "Format tanggal valid_from salah"}), 400

        if previous_day:
            old_records = OsCard.query.filter(
                or_(
                    OsCard.card_number == data.get('card_number'),
                    OsCard.employee_id == data.get('employee_id')
                ),
                or_(
                    OsCard.valid_to == None,
                    OsCard.valid_to >= new_from_date
                )
            ).all()
            for record in old_records:
                record.valid_to = previous_day

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