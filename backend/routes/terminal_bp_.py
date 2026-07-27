from flask import Blueprint, request, jsonify
from extensions import db
from model.terminal import terminal
from .auth_bp import login_required
from sqlalchemy import or_

terminal_bp = Blueprint('terminal_bp', __name__)

@terminal_bp.route('/terminal')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        query = terminal.query.filter(terminal.company_id.ilike(1111))
        if search:                    
            query = query.filter(
                or_(
                    terminal.terminal_id.cast(db.String).ilike(f"%{search}%"),
                    terminal.terminal_name.ilike(f"%{search}%")
                )
            )
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

@terminal_bp.route('/terminal/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form        
        
        new_terminal = terminal(
            terminal_id = data.get('terminal_id'),
            terminal_name = data.get('terminal_name'),
            company_id = data.get('company_id'),
            direction = data.get('direction'),
            terminal_type = data.get('terminal_type'),
            node_id = data.get('node_id'),
            cost_center = data.get('cost_center'),
            server_loc = data.get('server_loc')
        )
        db.session.add(new_terminal)
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

@terminal_bp.route('/terminal/<string:id>', methods=['PUT'])
def update(id):
    try:
        med = terminal.query.filter_by(id=id).first()
        data = request.json
        med.terminal_id = data.get('terminal_id', med.terminal_id)
        med.terminal_name = data.get('terminal_name', med.terminal_name)
        med.company_id = data.get('company_id', med.company_id)
        med.direction = data.get('direction', med.direction)
        med.terminal_type = data.get('terminal_type', med.terminal_type)
        med.node_id = data.get('node_id', med.node_id )if data.get('node_id') else None
        med.cost_center = data.get('cost_center', med.cost_center) if data.get('cost_center') else None
        med.server_loc = data.get('server_loc', med.server_loc)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@terminal_bp.route('/terminal/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = terminal.query.filter_by(id=id).first()
        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500

# @terminal_bp.before_request
# @login_required
# def before_request():
#     pass