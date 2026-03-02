from flask import Blueprint, request, jsonify
from extensions import db
from model.canteen import canteen, canteenDetail


canteen_bp = Blueprint('canteen_bp', __name__)

@canteen_bp.route('/canteen')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        pagination = canteen.query.paginate(page=page, per_page=pageSize, error_out=False)
        return jsonify({
            "status": "success",
            "data": [canteeens.to_dict() for canteeens in pagination.items],
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
        db.session.flush()
        #add cc in detail       
        for cc_id in data.get('cc_ids', []):
            if not cc_id:
                continue
            newDetail = canteenDetail(
                canteen_id = new_canteen.canteen_id,
                cc_id = cc_id
            )
            db.session.add(newDetail)
        #commit all
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
        canteeens = canteen.query.filter_by(canteen_id=id).first()
        data = request.json
        canteeens.canteen_id = data.get('canteen_id', canteeens.canteen_id)
        canteeens.canteen_name = data.get('canteen_name', canteeens.canteen_name)
        #detail
        canteenDetail.query.filter_by(canteen_id=id).delete()
        for cc_id in data.get('cc_ids', []):
            if not cc_id:
                continue
            newDetail = canteenDetail(
                canteen_id = canteeens.canteen_id,
                cc_id = cc_id
            )
            db.session.add(newDetail)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@canteen_bp.route('/canteen/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        canteen = canteen.query.filter_by(canteen_id=id).first()
        db.session.delete(canteen)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500