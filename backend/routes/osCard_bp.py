import pandas as pd
from io import BytesIO
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_
from extensions import db
from model.card import OsCard
from model.employment import OsEmployment
from model.person import OsPerson
from model.hr_models import User, UserSubcompanyAccess

osCard_bp = Blueprint('osCard_bp', __name__)

@osCard_bp.route('/oscard')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        filter_status = request.args.get('filter', '', type=str)
        req_subco = request.args.get('subcompany', '', type=str)
        
        query = OsCard.query.join(OsEmployment, OsCard.employee_id == OsEmployment.id) \
                            .join(OsPerson, OsEmployment.person_id == OsPerson.person_id)

        user_email = request.headers.get('X-User-Email')
        if user_email:
            user = User.query.filter_by(email=user_email).first()
            if user:
                access_records = UserSubcompanyAccess.query.filter_by(user_id=user.id).all()
                allowed_access = [a.sub_company_id for a in access_records]
                if allowed_access:
                    query = query.filter(OsEmployment.sub_company_id.in_(allowed_access))
                    if req_subco and req_subco not in allowed_access:
                        return jsonify({"status": "error", "message": "Akses ke Subcompany ini ditolak"}), 403
        if req_subco:
            query = query.filter(OsEmployment.sub_company_id == req_subco)

        now = datetime.now()
        
        if search:
            query = query.filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),
                    OsCard.card_number.ilike(f"%{search}%"),
                )
            )
            
        if filter_status == 'active':
            query = query.filter((OsCard.valid_to >= now) | (OsCard.valid_to == None))
        elif filter_status == 'inactive':
            query = query.filter(OsCard.valid_to < now)
            
        pagination = query.paginate(page=page, per_page=pageSize, error_out=False)
        
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

@osCard_bp.route('/oscard/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form
        previous_day = None
        new_from_date = None

        if data.get('valid_from'):
            try:
                new_from_dt = datetime.strptime(data.get('valid_from'), '%Y-%m-%d')
                new_from_date = new_from_dt.date()
                previous_day = new_from_date - timedelta(days=1)
            except ValueError:
                return jsonify({"status": "error", "message": "Format tanggal valid_from salah"}), 400

        if previous_day:
            old_records = OsCard.query.filter(
                or_(
                    OsCard.card_number == data.get('card_number'),
                    OsCard.employee_id == data.get('employee_id')
                ),
                or_(
                    OsCard.valid_to == None,
                    OsCard.valid_to >= new_from_date
                )
            ).all()
            for record in old_records:
                record.valid_to = previous_day

        new_OsCard = OsCard(
            employee_id = data.get('employee_id'),
            card_number = data.get('card_number'),
            valid_from = data.get('valid_from'),
            valid_to = data.get('valid_to')
        )
        db.session.add(new_OsCard)
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

@osCard_bp.route('/oscard/<string:id>', methods=['PUT'])
def update(id):
    try:
        OsCard_data = OsCard.query.filter_by(id=id).first()
        data = request.json
        OsCard_data.employee_id = data.get('employee_id', OsCard_data.employee_id)
        OsCard_data.card_number = data.get('card_number', OsCard_data.card_number)
        OsCard_data.valid_from = data.get('valid_from', OsCard_data.valid_from)
        if 'valid_to' in data:
            new_valid_to = data.get('valid_to')
            OsCard_data.valid_to = new_valid_to if new_valid_to else None
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@osCard_bp.route('/oscard/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = OsCard.query.filter_by(id=id).first()
        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500