from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from extensions import db

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
        query = Alokasi.query
        if search:
            query = query.join(OsEmployment, Alokasi.employee_id == OsEmployment.employee_id) \
                     .join(OsPerson, OsEmployment.person_id == OsPerson.person_id)                     
            query = query.filter(
                or_(
                    Alokasi.employee_id.cast(db.String).ilike(f"%{search}%"),
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

@alokasi_bp.route('/alokasi/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form
        employee_id = data.get('employee_id')
        canteen_id = data.get('canteen_id')
        valid_from = data.get('valid_from')
        valid_to = data.get('valid_to')        
        
        new_alokasi = Alokasi(
            employee_id=employee_id,
            canteen_id=canteen_id,
            valid_from=valid_from,
            valid_to=valid_to,
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
        alokasi.valid_to = data.get('valid_to', alokasi.valid_to)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    
@alokasi_bp.route('/alokasi/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        alokasi = Alokasi.query.filter_by(id=id).first()
        db.session.delete(alokasi)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500