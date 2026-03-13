from flask import Blueprint, request, jsonify
from extensions import db
from model.medical import medical
from .auth_bp import login_required

medical_bp = Blueprint('medical_bp', __name__)

@medical_bp.route('/medical')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        query = medical.query
        if search:                    
            query = query.filter(medical.medical_name.ilike(f"%{search}%"))
        pagination = query.paginate(page=page, per_page=pageSize, error_out=False)
        return jsonify({
            "status": "success",
            "data": [train.to_dict() for train in pagination.items],
            "total_page": pagination.pages,
            "current_page": pagination.page,
            "total_item": pagination.total
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@medical_bp.route('/medical/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form        
        
        new_training = medical(
            medical_id = data.get('medical_id'),
            medical_name = data.get('medical_name'),
            faskes = data.get('faskes')
        )
        db.session.add(new_training)
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

@medical_bp.route('/medical/<string:id>', methods=['PUT'])
def update(id):
    try:
        med = medical.query.filter_by(medical_id=id).first()
        data = request.json
        med.medical_id = data.get('medical_id', med.medical_id)
        med.medical_name = data.get('medical_name', med.medical_name)
        med.faskes = data.get('faskes', med.faskes)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@medical_bp.route('/medical/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = medical.query.filter_by(medical_id=id).first()
        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500

@medical_bp.before_request
@login_required
def before_request():
    pass