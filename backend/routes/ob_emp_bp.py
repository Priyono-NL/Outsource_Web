from flask import Blueprint, request, jsonify
from extensions import db
from model.ob_emp import ObEmployee
from .auth_bp import login_required
from sqlalchemy import or_

ob_emp_bp = Blueprint('ob_emp_bp', __name__)

@ob_emp_bp.route('/obemployee')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        query = ObEmployee.query.filter(ObEmployee.company_id.ilike(1111))
        if search:                    
            query = query.filter(
                or_(
                    ObEmployee.employee_id.cast(db.String).ilike(f"%{search}%"),
                    ObEmployee.employee_name.ilike(f"%{search}%")
                )
            )
        pagination = query.paginate(page=page, per_page=pageSize, error_out=False)
        return jsonify({
            "status": "success",
            "data": [item.to_dict() for item in pagination.items],
            "total_page": pagination.pages,
            "current_page": pagination.page,
            "total_item": pagination.total
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# @ob_emp_bp.before_request
# @login_required
# def before_request():
#     pass