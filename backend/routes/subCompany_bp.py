from flask import Blueprint, request, jsonify
from extensions import db
from model.subCompany import SubCompany
from .auth_bp import login_required

subCom_bp = Blueprint('subCom_bp', __name__)

@subCom_bp.route('/subcom')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        query = SubCompany.query
        if search:                    
            query = query.filter(SubCompany.sub_company_name.ilike(f"%{search}%"))
        pagination = query.paginate(page=page, per_page=pageSize, error_out=False)
        return jsonify({
            "status": "success",
            "data": [sub.to_dict() for sub in pagination.items],
            "total_page": pagination.pages,
            "current_page": pagination.page,
            "total_item": pagination.total
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@subCom_bp.route('/subcom/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form

        last_company = SubCompany.query.order_by(SubCompany.sub_company_id.desc()).first()
        if last_company and last_company.sub_company_id.startswith('sub'):
            last_number = int(last_company.sub_company_id[3:])
            new_number = last_number + 1
        else:
            new_number = 1
        new_sub_id = f"sub{new_number:05d}"
        
        new_company = SubCompany(
            sub_company_id=new_sub_id,
            sub_company_name = data.get('sub_company_name'),
            type_company = data.get('type_company')
        )
        db.session.add(new_company)
        db.session.commit()

        return jsonify({
            "status": "success",
            "message": f"Data berhasil disimpan dengan ID {new_sub_id}!"
        }), 201     
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": "Terjadi kesalahan pada server: " + str(e)
        }), 500

@subCom_bp.route('/subcom/<string:id>', methods=['PUT'])
def update(id):
    try:
        company = SubCompany.query.filter_by(sub_company_id=id).first()
        data = request.json
        company.sub_company_name = data.get('sub_company_name', company.sub_company_name)
        company.type_company = data.get('type_company', company.type_company)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@subCom_bp.route('/subcom/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = SubCompany.query.filter_by(sub_company_id=id).first()
        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500
    
@subCom_bp.before_request
@login_required
def before_request():
    pass