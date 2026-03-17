from datetime import datetime
from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from extensions import db
from .auth_bp import login_required
from model.alokasi import Alokasi
from model.employment import OsEmployment
from model.person import OsPerson

alokasi_bp = Blueprint('alokasi_bp', __name__)

@alokasi_bp.route('/alokasi')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 100, type=int)
        search = request.args.get('search', '', type=str)
        filter = request.args.get('filter', '', type=str)
        query = Alokasi.query
        now = datetime.now()
        if search:
            query = query.join(OsEmployment, Alokasi.employee_id == OsEmployment.employee_id) \
                     .join(OsPerson, OsEmployment.person_id == OsPerson.person_id)                     
            query = query.filter(
                or_(
                    Alokasi.employee_id.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),                    
                )
            )
        if filter == 'active':
            query = query.filter(Alokasi.valid_to >= now)
        elif filter == 'inactive':
            query = query.filter(Alokasi.valid_to < now)
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

@alokasi_bp.route('/alokasi/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form
        
        new_alokasi = Alokasi(
            employee_id = data.get('employee_id'),
            canteen_id = data.get('canteen_id'),
            valid_from = data.get('valid_from'),
            valid_to = data.get('valid_to')
        )
        db.session.add(new_alokasi)
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

@alokasi_bp.route('/alokasi/<string:id>', methods=['PUT'])
def update(id):
    try:
        alokasi = Alokasi.query.filter_by(id=id).first()
        data = request.json
        alokasi.employee_id = data.get('employee_id', alokasi.employee_id)
        alokasi.canteen_id = data.get('canteen_id', alokasi.canteen_id)
        alokasi.valid_from = data.get('valid_from', alokasi.valid_from)
        if 'valid_to' in data:
            new_valid_to = data.get('valid_to')
            alokasi.valid_to = new_valid_to if new_valid_to else None
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    
@alokasi_bp.route('/alokasi/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = Alokasi.query.filter_by(id=id).first()
        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500
    
# @alokasi_bp.before_request
# @login_required
# def before_request():
#     pass