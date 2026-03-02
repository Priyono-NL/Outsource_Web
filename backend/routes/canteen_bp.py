from flask import Blueprint, request, jsonify
from extensions import db
from model.canteen import canteen

canteen_bp = Blueprint('canteen_bp', __name__)

@canteen_bp.route('/canteen')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        pagination = canteen.query.paginate(page=page, per_page=pageSize, error_out=False)
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

@canteen_bp.route('/canteen/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form        
        
        new_canteen = canteen(
            canteen_id = data.get('canteen_id'),
            canteen_name = data.get('canteen_name')
        )
        db.session.add(new_canteen)
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

@canteen_bp.route('/canteen/<string:id>', methods=['PUT'])
def update(id):
    try:
        train = canteen.query.filter_by(canteen_id=id).first()
        data = request.json
        train.canteen_id = data.get('canteen_id', train.canteen_id)
        train.canteen_name = data.get('canteen_name', train.canteen_name)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@canteen_bp.route('/canteen/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        company = canteen.query.filter_by(canteen_id=id).first()
        db.session.delete(company)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500