from flask import Blueprint, request, jsonify
from extensions import db
from model.person import OsPerson
from model.blacklist import OsBlacklist
from .auth_bp import login_required

person_bp = Blueprint('person_bp', __name__)

@person_bp.route('/person/search')
def search_person():
    query_str = request.args.get('q', '')
    if len(query_str) < 3:
        return jsonify({"status": "success", "data": []})
    persons = OsPerson.query.outerjoin(OsBlacklist, OsPerson.person_id == OsBlacklist.person_id).filter(
            OsPerson.name.ilike(f"%{query_str}%")).limit(10).all() 
    data_result = []
    for p in persons:
        blist = p.OsBlist[0] if (p.OsBlist and len(p.OsBlist) > 0) else None
        data_result.append({
            "person_id": p.person_id, 
            "name": p.name,
            "gender": p.gender,
            "religion": p.religion,
            "pob": p.pob,
            "dob": str(p.dob),
            "resident_id": p.resident_id,
            "address": p.address,

            "is_blacklist": "Blacklist" if (blist and blist.status == 1) else "No in Blacklist",
        })

    return jsonify({
        "status": "success",
        "data": data_result
    })

@person_bp.route('/person')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        pagination = OsPerson.query.paginate(page=page, per_page=pageSize, error_out=False)
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

@person_bp.route('/canteen/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form        
        
        new_canteen = OsPerson(
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

@person_bp.route('/canteen/<string:id>', methods=['PUT'])
def update(id):
    try:
        canteeens = OsPerson.query.filter_by(canteen_id=id).first()
        data = request.json
        canteeens.canteen_id = data.get('canteen_id', canteeens.canteen_id)
        canteeens.canteen_name = data.get('canteen_name', canteeens.canteen_name)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@person_bp.route('/canteen/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data_canteen = OsPerson.query.filter_by(canteen_id=id).first()        
        db.session.delete(data_canteen)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500

@person_bp.before_request
@login_required
def before_request():
    pass