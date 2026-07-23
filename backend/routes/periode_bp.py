from flask import Blueprint, request, session, jsonify
from extensions import db
from model.periode import periode
from .auth_bp import login_required

periode_bp = Blueprint('periode_bp', __name__)

@periode_bp.route('/periode')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        query = periode.query
        if search:                    
            query = query.filter(periode.periode_name.ilike(f"%{search}%"))
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

@periode_bp.route('/periode/submit', methods=['POST'])
def add():    
    try:
        data = request.json if request.is_json else request.form        
        new_periode = periode(
            periode_id = data.get('periode_id'),
            periode_name = data.get('periode_name'),
            tahun = data.get('tahun'),
            start_date = data.get('start_date'),
            end_date = data.get('end_date')
        )
        db.session.add(new_periode)
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

@periode_bp.route('/periode/<string:id>', methods=['PUT'])
def update(id):
    try:
        train = periode.query.filter_by(periode_id=id).first()
        data = request.json
        train.periode_id = data.get('periode_id', train.periode_id)
        train.periode_name = data.get('periode_name', train.periode_name)
        train.tahun = data.get('tahun', train.tahun)
        train.start_date = data.get('start_date', train.start_date)
        train.end_date = data.get('end_date', train.end_date)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@periode_bp.route('/periode/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = periode.query.filter_by(periode_id=id).first()
        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500
    
# @periode_bp.before_request
# @login_required
# def before_request():
#     pass