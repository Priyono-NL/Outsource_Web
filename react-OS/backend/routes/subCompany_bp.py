from flask import Blueprint, request, jsonify
import pandas as pd
import io
from extensions import db
from model.subCompany import SubCompany

subCom_bp = Blueprint('subCom_bp', __name__)

@subCom_bp.route('/subcom')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        pagination = SubCompany.query.paginate(page=page, per_page=pageSize, error_out=False)
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
