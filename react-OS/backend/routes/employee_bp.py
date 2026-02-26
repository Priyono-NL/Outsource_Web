from flask import Blueprint, request, jsonify
import pandas as pd
import io
from extensions import db
from model.employment import OsEmployment

employee_bp = Blueprint('employee_bp', __name__)

@employee_bp.route('/employee')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        pagination = OsEmployment.query.paginate(page=page, per_page=pageSize, error_out=False)
        return jsonify({
            "status": "success",
            "data": [emp.to_dict() for emp in pagination.items],
            "total_page": pagination.pages,
            "current_page": pagination.page,
            "total_item": pagination.total
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@employee_bp.route('/employee/submit', methods=['POST'])
def add():
    form_data = request.form.to_dict()
    return jsonify({
        "status": "success",
        "data": form_data
    })
