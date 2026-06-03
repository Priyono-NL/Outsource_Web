import pandas as pd
from io import BytesIO
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_
from extensions import db
from model.osCostCenter import OsCostCenter
from model.employment import OsEmployment
from model.person import OsPerson
from .auth_bp import login_required

osCC_bp = Blueprint('osCC_bp', __name__)

@osCC_bp.route('/oscc')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        filter = request.args.get('filter', '', type=str)
        query = OsCostCenter.query
        if search:
            query = query.join(OsEmployment, OsCostCenter.employee_id == OsEmployment.id) \
                     .join(OsPerson, OsEmployment.person_id == OsPerson.person_id)                     
            query = query.filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),                    
                )
            )
        now = datetime.now()
        if filter == 'active':
            query = query.filter((OsCostCenter.valid_to >= now) | (OsCostCenter.valid_to == None))
        elif filter == 'inactive':
            query = query.filter(OsCostCenter.valid_to < now)
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

@osCC_bp.route('/oscc/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form

        #change last cc to valid to previous day
        old_cc = OsCostCenter.query.filter_by(employee_id=data.get('employee_id')).order_by(OsCostCenter.id.desc()).first()
        if old_cc and data.get('valid_from'):
            try:
                new_valid_from = datetime.strptime(data.get('valid_from'), '%Y-%m-%d')
                previous_day = new_valid_from - timedelta(days=1)
                old_cc.valid_to = previous_day.date()
            except ValueError as e:
                print(f"Format tanggal salah: {e}")

        new_OsCostCenter = OsCostCenter(
            employee_id = data.get('employee_id'),
            cc_id = data.get('cc_id'),
            valid_from = data.get('valid_from'),
            valid_to = data.get('valid_to')
        )
        db.session.add(new_OsCostCenter)
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

@osCC_bp.route('/oscc/<string:id>', methods=['PUT'])
def update(id):
    try:
        OsCostCenter_data = OsCostCenter.query.filter_by(id=id).first()
        data = request.json
        OsCostCenter_data.employee_id = data.get('employee_id', OsCostCenter_data.employee_id)
        OsCostCenter_data.cc_id = data.get('cc_id', OsCostCenter_data.cc_id)
        OsCostCenter_data.valid_from = data.get('valid_from', OsCostCenter_data.valid_from)
        if 'valid_to' in data:
            new_valid_to = data.get('valid_to')
            OsCostCenter_data.valid_to = new_valid_to if new_valid_to else None
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@osCC_bp.route('/oscc/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = OsCostCenter.query.filter_by(id=id).first()
        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500
    
@osCC_bp.route('/oscc/export', methods=['GET'])
def export():
    try:
        master = OsCostCenter.query.all()
        data = []
        for m in master:
            d = m.to_dict()
            data.append({
                "Employee ID": d['employee_id'],
                "Employee Name": d['employee_name'],
                "Card Number": d['medical_name'],
                "Valid From": d['v_valid_from'],
                "Valid To": d['valid_to'],
            })
        if not data:
            return jsonify({'status': 'error', 'message': 'tidak ada data'})
        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Data OS Medical')        
        output.seek(0)
        return send_file(
            output, 
            as_attachment=True, 
            download_name="Export_OS_Medical.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    
@osCC_bp.route('/oscc/template', methods=['GET'])
def template():
    try:
        example_data = [{
            "ID Employee": "12345",
            "Card Number": "12345.12345",
            "Valid From": "2026-03-20",
            "Valid To": "SEHAT",
        }]
        df = pd.DataFrame(example_data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Template_Import')
        output.seek(0)
        return send_file(
            output, 
            as_attachment=True, 
            download_name="Template_Import_Medical.xlsx"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@osCC_bp.route('/oscc/upload', methods=['POST'])
def upload():
    file = request.files.get('file')
    if not file:
        return jsonify({'message': 'Tidak ada file'}), 400
    try:
        df = pd.read_excel(file)
        all_employees = OsEmployment.query.with_entities(OsEmployment.employee_id).all()
        valid_employee_ids = {str(e.employee_id) for e in all_employees}
        errors = []
        to_save = []
        for index, row in df.iterrows():
            e_id = str(row['ID Employee']).strip()
            m_name = str(row['Medical Name']).lower().strip()
            if e_id not in valid_employee_ids:
                errors.append(f"Baris {index+2}: ID Employee '{e_id}' tidak terdaftar di sistem.")
                continue            
            new_medical = OsCostCenter(
                employee_id=int(e_id),
                cc_id=row['Card Number'],
                valid_from=pd.to_datetime(row['Valid From']),
                valid_to=pd.to_datetime(row['Valid To']),
            )
            to_save.append(new_medical)
        if errors:
            return jsonify({
                "status": "error", 
                "message": "Import gagal karena beberapa data tidak valid.",
                "errors": errors
            }), 400
        db.session.add_all(to_save)
        db.session.commit()
        return jsonify({"status": "success", "message": f"Berhasil mengimport {len(to_save)} data."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500    
    