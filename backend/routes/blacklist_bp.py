from datetime import datetime
from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from extensions import db
from .auth_bp import login_required
from model.blacklist import OsBlacklist
from model.person import OsPerson

blacklist_bp = Blueprint('blacklist_bp', __name__)

@blacklist_bp.route('/oslist')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 100, type=int)
        search = request.args.get('search', '', type=str)
        query = OsBlacklist.query
        if search:
            query = query.join(OsPerson, OsBlacklist.person_id == OsPerson.person_id)   
            query = query.filter(OsPerson.name.ilike(f"%{search}%"))
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

@blacklist_bp.route('/oslist/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form
        new_OsBlacklist = OsBlacklist(
            person_id = data.get('person_id'),
            status = data.get('status'),
            block_status = data.get('block_status')
        )
        db.session.add(new_OsBlacklist)
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

@blacklist_bp.route('/oslist/<string:id>', methods=['PUT'])
def update(id):
    try:
        data_OsBlacklist = OsBlacklist.query.filter_by(id=id).first()
        data = request.json
        data_OsBlacklist.person_id = data.get('person_id', OsBlacklist.person_id)
        data_OsBlacklist.status = data.get('status', OsBlacklist.status)
        data_OsBlacklist.block_status = data.get('block_status', OsBlacklist.block_status)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    
@blacklist_bp.route('/oslist/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = OsBlacklist.query.filter_by(id=id).first()
        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500
    
@blacklist_bp.before_request
@login_required
def before_request():
    pass