from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_
from extensions import db
from model.osType import osType
from model.employment import OsEmployment
from model.person import OsPerson
from .auth_bp import login_required

osType_bp = Blueprint('osType', __name__)

@osType_bp.route('/ostype')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        filter = request.args.get('filter', '', type=str)
        query = osType.query
        if search:
            query = query.join(OsEmployment, osType.employee_id == OsEmployment.id) \
                     .join(OsPerson, OsEmployment.person_id == OsPerson.person_id)                     
            query = query.filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),                    
                )
            )
        now = datetime.now()
        if filter == 'active':
            query = query.filter((osType.valid_to >= now) | (osType.valid_to == None))
        elif filter == 'inactive':
            query = query.filter(osType.valid_to < now)
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

@osType_bp.route('/ostype/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form

        old_type = osType.query.filter_by(employee_id=data.get('employee_id')).order_by(osType.id.desc()).first()
        if old_type and data.get('valid_from'):
            try:
                new_valid_from = datetime.strptime(data.get('valid_from'), '%Y-%m-%d')
                previous_day = new_valid_from - timedelta(days=1)
                old_type.valid_to = previous_day.date()
            except ValueError as e:
                print(f"Format tanggal salah: {e}")

        new_osType = osType(
            employee_id = data.get('employee_id'),
            type_worker = data.get('type_worker'),
            posisi = data.get('posisi'),
            valid_from = data.get('valid_from'),
            valid_to = data.get('valid_to')
        )
        db.session.add(new_osType)
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

@osType_bp.route('/ostype/<string:id>', methods=['PUT'])
def update(id):
    try:
        osType_data = osType.query.filter_by(id=id).first()
        data = request.json
        osType_data.employee_id = data.get('employee_id', osType_data.employee_id)
        osType_data.type_worker = data.get('type_worker', osType_data.type_worker)
        osType_data.posisi = data.get('posisi', osType_data.posisi)
        osType_data.valid_from = data.get('valid_from', osType_data.valid_from)
        if 'valid_to' in data:
            new_valid_to = data.get('valid_to')
            osType_data.valid_to = new_valid_to if new_valid_to else None
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@osType_bp.route('/ostype/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = osType.query.filter_by(id=id).first()
        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500

# @osType_bp.before_request
# @login_required
# def before_request():
#     pass