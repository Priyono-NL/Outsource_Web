import os
import pandas as pd
from io import BytesIO
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_
from openpyxl import Workbook
from openpyxl.worksheet.datavalidation import DataValidation

from extensions import db
from model.osCostCenter import OsCostCenter
from model.costCenter import costCenter
from model.employment import OsEmployment
from model.person import OsPerson
from model.hr_models import User, UserSubcompanyAccess, UserCostCenterAccess

osCC_bp = Blueprint('osCC_bp', __name__)

@osCC_bp.teardown_request
def teardown_request(exception=None):
    try:
        db.session.remove()
    except Exception:
        pass

# Helper pembersih string & tanggal
def clean_val(val):
    if val is None or pd.isna(val):
        return None
    s = str(val).strip()
    if s.lower() in ('', 'null', 'none', 'undefined', 'nan', 'nat'):
        return None
    return s

def parse_date(date_val):
    if pd.isna(date_val) or date_val is None:
        return None
    if hasattr(date_val, 'date'):
        return date_val.date()
    cleaned = clean_val(str(date_val))
    if not cleaned:
        return None
    try:
        return datetime.strptime(cleaned[:10], '%Y-%m-%d').date()
    except ValueError:
        return None

def get_allowed_subcompanies():
    user_email = request.headers.get('X-User-Email')
    if not user_email:
        return []
    user = User.query.filter_by(email=user_email).first()
    if not user:
        return []
    access_records = UserSubcompanyAccess.query.filter_by(user_id=user.id).all()
    return [a.sub_company_id for a in access_records]

@osCC_bp.route('/oscc', methods=['GET'])
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 20, type=int)
        search = request.args.get('search', '', type=str)
        filter_status = request.args.get('filter', '', type=str)
        req_subco = request.args.get('subcompany', '', type=str)
        req_dept = request.args.get('department', '', type=str)

        query = OsCostCenter.query.join(OsEmployment, OsCostCenter.employee_id == OsEmployment.id) \
                                  .join(OsPerson, OsEmployment.person_id == OsPerson.person_id)

        # 1. Restriksi SSO
        allowed_subco = get_allowed_subcompanies()
        if allowed_subco:
            query = query.filter(OsEmployment.sub_company_id.in_(allowed_subco))
            if req_subco and req_subco not in allowed_subco:
                return jsonify({"status": "error", "message": "Akses Subcompany ditolak"}), 403

        user_email = request.headers.get('X-User-Email')
        if user_email:
            user = User.query.filter_by(email=user_email).first()
            if user:
                cc_access = UserCostCenterAccess.query.filter_by(user_id=user.id).all()
                allowed_cc = [c.cost_center_id for c in cc_access]
                if allowed_cc:
                    query = query.filter(OsCostCenter.org_cc_id.in_(allowed_cc))
                    if req_dept and int(req_dept) not in allowed_cc:
                        return jsonify({"status": "error", "message": "Akses Departemen ditolak"}), 403

        # 2. Filter Dinamis
        if req_subco:
            query = query.filter(OsEmployment.sub_company_id == req_subco)

        if req_dept:
            try:
                query = query.filter(OsCostCenter.org_cc_id == int(req_dept))
            except ValueError:
                pass

        if search:
            query = query.filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(f"%{search}%"),
                    OsPerson.name.ilike(f"%{search}%"),
                    OsCostCenter.cc_id.cast(db.String).ilike(f"%{search}%")
                )
            )
            
        now = datetime.now().date()
        if filter_status == 'active':
            query = query.filter(or_(OsCostCenter.valid_to >= now, OsCostCenter.valid_to == None))
        elif filter_status == 'inactive':
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
        return jsonify({"status": "error", "message": str(e)}), 500


@osCC_bp.route('/oscc/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form
        
        employee_id = clean_val(data.get('employee_id'))
        org_cc_id = clean_val(data.get('org_cc_id') or data.get('cc_id'))
        valid_from_raw = data.get('valid_from')
        valid_to_raw = data.get('valid_to')

        if not employee_id or not org_cc_id or not valid_from_raw:
            return jsonify({"status": "error", "message": "Employee ID, Cost Center, dan Valid From wajib diisi!"}), 400

        new_start_date = parse_date(valid_from_raw)
        if not new_start_date:
            return jsonify({"status": "error", "message": "Format Tanggal Valid From tidak valid!"}), 400

        new_end_date = parse_date(valid_to_raw)
        adjusted_valid_to = new_start_date - timedelta(days=1)

        # Master Cost Center Check
        master_cc = costCenter.query.get(org_cc_id)
        if not master_cc:
            return jsonify({"status": "error", "message": f"Master Cost Center dengan ID {org_cc_id} tidak ditemukan"}), 404

        # Delimit Record Aktif Sebelumnya
        active_old_cc = OsCostCenter.query.filter(
            OsCostCenter.employee_id == employee_id,
            or_(
                OsCostCenter.valid_to == None,
                OsCostCenter.valid_to >= new_start_date
            ),
            OsCostCenter.valid_from <= adjusted_valid_to
        ).all()

        for old_rec in active_old_cc:
            old_rec.valid_to = adjusted_valid_to
            db.session.add(old_rec)

        db.session.flush()

        # Simpan Record Baru
        new_OsCostCenter = OsCostCenter(
            employee_id = employee_id,
            cc_id       = master_cc.cost_center, 
            org_cc_id   = master_cc.id,          
            valid_from  = new_start_date,
            valid_to    = new_end_date
        )
        db.session.add(new_OsCostCenter)
        db.session.commit()

        return jsonify({"status": "success", "message": "Data Cost Center berhasil disimpan!"}), 201    

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Terjadi kesalahan pada server: " + str(e)}), 500


@osCC_bp.route('/oscc/<string:id>', methods=['PUT'])
def update(id):
    try:
        OsCostCenter_data = OsCostCenter.query.get(id)
        if not OsCostCenter_data:
            return jsonify({"status": "error", "message": "Data tidak ditemukan"}), 404

        data = request.json if request.is_json else request.form
        org_cc_id = clean_val(data.get('org_cc_id') or data.get('cc_id'))

        if org_cc_id:
            master_cc = costCenter.query.get(org_cc_id)
            if master_cc:
                OsCostCenter_data.org_cc_id = master_cc.id
                OsCostCenter_data.cc_id = master_cc.cost_center

        if 'valid_from' in data:
            v_from = parse_date(data.get('valid_from'))
            if v_from:
                OsCostCenter_data.valid_from = v_from

        if 'valid_to' in data:
            OsCostCenter_data.valid_to = parse_date(data.get('valid_to'))

        db.session.commit()
        return jsonify({"status": "success", "message": "Data Cost Center berhasil diupdate!"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@osCC_bp.route('/oscc/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = OsCostCenter.query.get(id)
        if not data:
            return jsonify({"status": "error", "message": "Data tidak ditemukan"}), 404

        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data Cost Center berhasil dihapus!"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500


# =============================================================================
# FITUR BARU: GENERATE TEMPLATE IMPORT MUTASI COST CENTER
# =============================================================================
@osCC_bp.route('/oscc/template', methods=['GET'])
def template():
    try:
        # Tarik Master Data Cost Center
        dept_query = db.session.query(costCenter.org_name).filter(costCenter.org_name.is_not(None))
        department_names = [r[0].strip() for r in dept_query.order_by(costCenter.org_name.asc()).all() if r[0]]

        wb = Workbook()
        ws = wb.active
        ws.title = 'Template_Mutasi_CC'

        # Header Kolom Excel
        headers = ["Employee Code", "Cost Center Baru", "Valid From", "Valid To"]
        ws.append(headers)

        # Baris Contoh
        sample_dept = department_names[0] if department_names else "PRODUCTION"
        sample_row = ["123456", sample_dept, "2026-10-01", ""]
        ws.append(sample_row)

        # Hidden Sheet untuk Master Data Dropdown
        ws_master = wb.create_sheet(title='Master_Data')
        ws_master.cell(row=1, column=1, value="Cost Center")
        for idx, name in enumerate(department_names, start=2):
            ws_master.cell(row=idx, column=1, value=name)
        
        ws_master.sheet_state = 'hidden'

        max_dept_row = max(len(department_names) + 1, 2)

        # Pasang Data Validation (Dropdown) di Kolom C (Cost Center Baru)
        dv_dept = DataValidation(type="list", formula1=f"Master_Data!$A$2:$A${max_dept_row}", allow_blank=True)
        dv_dept.error = 'Pilih Cost Center dari list dropdown yang tersedia.'
        dv_dept.errorTitle = 'Cost Center Tidak Valid'
        ws.add_data_validation(dv_dept)
        dv_dept.add("B2:B1000")

        output = BytesIO()
        wb.save(output)
        output.seek(0)

        return send_file(
            output,
            as_attachment=True,
            download_name="Template_Import_Mutasi_CostCenter.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": f"Gagal membuat template: {str(e)}"}), 500


# =============================================================================
# FITUR BARU: UPLOAD MASSAL MUTASI COST CENTER
# =============================================================================
@osCC_bp.route('/oscc/upload', methods=['POST'])
def upload():
    file = request.files.get('file')
    if not file:
        return jsonify({'message': 'Mohon pilih file Excel terlebih dahulu.'}), 400

    try:
        df = pd.read_excel(file, dtype={'Employee Code': str})

        required_columns = ['Employee Code', 'Cost Center Baru', 'Valid From']
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            return jsonify({"message": f"Format Excel salah. Kolom berikut tidak ditemukan: {', '.join(missing_cols)}"}), 400

        errors = []
        notes = []
        success_count = 0

        for index, row in df.iterrows():
            line_number = index + 2
            try:
                with db.session.begin_nested():
                    emp_code_input = clean_val(row.get('Employee Code'))
                    cc_name_input = clean_val(row.get('Cost Center Baru'))
                    valid_from_raw = row.get('Valid From')
                    valid_to_raw = row.get('Valid To')

                    if not emp_code_input or not cc_name_input or pd.isna(valid_from_raw):
                        raise ValueError("Employee Code, Cost Center Baru, dan Valid From tidak boleh kosong.")

                    new_start_date = parse_date(valid_from_raw)
                    if not new_start_date:
                        raise ValueError("Tanggal 'Valid From' tidak valid.")

                    new_valid_to = parse_date(valid_to_raw)
                    adjusted_valid_to = new_start_date - timedelta(days=1)

                    # 1. Cari Karyawan Aktif berdasarkan Employee Code
                    target_emp = OsEmployment.query.filter(
                        OsEmployment.employee_code == emp_code_input,
                        or_(OsEmployment.valid_to >= new_start_date, OsEmployment.valid_to == None)
                    ).order_by(OsEmployment.id.desc()).first()

                    if not target_emp:
                        raise ValueError(f"Karyawan dengan ID '{emp_code_input}' tidak ditemukan atau tidak aktif pada tanggal {new_start_date}.")

                    # 2. Cari Cost Center berdasarkan Nama atau Kode
                    master_cc = costCenter.query.filter(
                        or_(
                            costCenter.org_name.ilike(cc_name_input),
                            costCenter.cost_center == cc_name_input
                        )
                    ).first()

                    if not master_cc:
                        raise ValueError(f"Cost Center '{cc_name_input}' tidak ditemukan di master data.")

                    # 3. Delimit Record CC Lama (Gaya SCD Type 2)
                    old_records = OsCostCenter.query.filter(
                        OsCostCenter.employee_id == target_emp.id,
                        or_(OsCostCenter.valid_to == None, OsCostCenter.valid_to >= new_start_date),
                        OsCostCenter.valid_from <= adjusted_valid_to
                    ).all()

                    for rec in old_records:
                        rec.valid_to = adjusted_valid_to
                        db.session.add(rec)

                    db.session.flush()

                    # 4. Insert Record Cost Center Baru
                    new_cc = OsCostCenter(
                        employee_id = target_emp.id,
                        cc_id       = master_cc.cost_center,
                        org_cc_id   = master_cc.id,
                        valid_from  = new_start_date,
                        valid_to    = new_valid_to
                    )
                    db.session.add(new_cc)

                    success_count += 1
                    notes.append(f"Baris {line_number}: Karyawan '{emp_code_input}' berhasil dipindahkan ke Cost Center '{master_cc.org_name}'.")

            except ValueError as ve:
                errors.append(f"Baris {line_number}: {str(ve)}")
            except Exception as e:
                errors.append(f"Baris {line_number}: {str(e)}")

        db.session.commit()

        if success_count > 0:
            status = "success" if not errors else "partial_success"
            return jsonify({
                "status": status,
                "message": f"Berhasil mengimport {success_count} data mutasi Cost Center.",
                "errors": errors,
                "notes": notes
            }), 200
        else:
            return jsonify({
                "status": "error",
                "message": "Tidak ada data yang berhasil diimport.",
                "errors": errors,
                "notes": notes
            }), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Terjadi kesalahan fatal pada server: {str(e)}"}), 500