from flask import Blueprint, request, jsonify
from extensions import db
from model.costCenter import costCenter
from .auth_bp import login_required

costCenter_bp = Blueprint('costCenter_bp', __name__)

@costCenter_bp.route('/costcenter')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        query = costCenter.query
        if search:                    
            query = query.filter(costCenter.org_name.ilike(f"%{search}%"))
        pagination = query.paginate(page=page, per_page=pageSize, error_out=False)
        return jsonify({
            "status": "success",
            "data": [cost.to_dict() for cost in pagination.items],
            "total_page": pagination.pages,
            "current_page": pagination.page,
            "total_item": pagination.total
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@costCenter_bp.route('/costcenter/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form
        
        new_cc = costCenter(
            company_id = data.get('company_id'),
            org_id = data.get('org_id'),
            org_name = data.get('org_name'),
            cost_center = data.get('cost_center')                  
        )
        db.session.add(new_cc)
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

@costCenter_bp.route('/costcenter/<string:id>', methods=['PUT'])
def update(id):
    try:
        cc = costCenter.query.filter_by(cost_center=id).first()
        data = request.json
        cc.company_id = data.get('company_id', cc.company_id)
        cc.org_id = data.get('org_id', cc.org_id)
        cc.org_name = data.get('org_name', cc.org_name)
        cc.cost_center = data.get('cost_center', cc.cost_center)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@costCenter_bp.route('/costcenter/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = costCenter.query.filter_by(cost_center=id).first()
        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500
    
# @costCenter_bp.before_request
# @login_required
# def before_request():
#     pass