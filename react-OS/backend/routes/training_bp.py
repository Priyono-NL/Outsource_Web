from flask import Blueprint, request, jsonify
from extensions import db
from model.training import training_m

train_bp = Blueprint('train_bp', __name__)

@train_bp.route('/training')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        pagination = training_m.query.paginate(page=page, per_page=pageSize, error_out=False)
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

@train_bp.route('/training/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form
        training_id = data.get('training_id')
        training_name = data.get('training_name')
        organizer = data.get('organizer')
        
        new_training = training_m(
            training_id=training_id,
            training_name=training_name,
            organizer=organizer
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

@train_bp.route('/training/<string:id>', methods=['PUT'])
def update(id):
    try:
        train = training_m.query.filter_by(training_id=id).first()
        data = request.json
        train.training_id = data.get('training_id', train.training_id)
        train.training_name = data.get('training_name', train.training_name)
        train.organizer = data.get('organizer', train.organizer)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@train_bp.route('/training/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        company = training_m.query.filter_by(training_id=id).first()
        db.session.delete(company)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500