import pandas as pd
from io import BytesIO
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import or_, text
from extensions import db
from openpyxl.worksheet.datavalidation import DataValidation

from model.guest import Guest
from model.canteen import canteen
from model.employment import OsEmployment
from model.person import OsPerson
from model.ob_emp import ObEmployee
from model.osCostCenter import OsCostCenter
from model.hr_models import User, UserSubcompanyAccess, UserCostCenterAccess

guest_bp = Blueprint('guest_bp', __name__)

# =============================================================================
# ZERO-ZOMBIE TEARDOWN
# =============================================================================
@guest_bp.teardown_request
def teardown_request(exception=None):
    try:
        db.session.remove()
    except Exception:
        pass

# =============================================================================
# 1. READ GUEST / ALLOWLIST (GET)
# =============================================================================
@guest_bp.route('/guest', methods=['GET'])
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 100, type=int)
        search = request.args.get('search', '', type=str)
        filter_status = request.args.get('filter', '', type=str)
        req_subco = request.args.get('subcompany', '', type=str)
        req_dept = request.args.get('department', '', type=str)
        req_puasa_id = request.args.get('periode_puasa_id', '', type=str)
        
        query = Guest.query
        now = datetime.now()

        # Filter spesifik untuk melihat data allowlist puasa saja
        if req_puasa_id:
            if req_puasa_id == 'reguler':
                query = query.filter(Guest.periode_puasa_id.is_(None))
            elif req_puasa_id != 'all':
                query = query.filter(Guest.periode_puasa_id == req_puasa_id)

        user_email = request.headers.get('X-User-Email')
        allowed_subco = []
        allowed_cc = []

        if user_email:
            user = User.query.filter_by(email=user_email).first()
            if user:
                subco_records = UserSubcompanyAccess.query.filter_by(user_id=user.id).all()
                allowed_subco = [a.sub_company_id for a in subco_records]
                if allowed_subco and req_subco and req_subco not in allowed_subco:
                    return jsonify({"status": "error", "message": "Akses Subcompany ditolak"}), 403

                cc_records = UserCostCenterAccess.query.filter_by(user_id=user.id).all()
                allowed_cc = [c.cost_center_id for c in cc_records]
                if allowed_cc and req_dept:
                    try:
                        if int(req_dept) not in allowed_cc:
                            return jsonify({"status": "error", "message": "Akses Departemen ditolak"}), 403
                    except ValueError:
                        pass

        subco_filter_active = allowed_subco or ([req_subco] if req_subco else None)
        cc_filter_active = allowed_cc or ([int(req_dept)] if req_dept and req_dept.isdigit() else None)

        subco_emp_ids = None
        if subco_filter_active or cc_filter_active:
            emp_query = db.session.query(OsEmployment.id)
            
            if subco_filter_active:
                emp_query = emp_query.filter(OsEmployment.sub_company_id.in_(subco_filter_active))
            if cc_filter_active:
                emp_query = emp_query.join(OsCostCenter, OsEmployment.id == OsCostCenter.employee_id)\
                                     .filter(OsCostCenter.org_cc_id.in_(cc_filter_active))
            
            subco_matches = emp_query.all()
            subco_emp_ids = [str(row.id) for row in subco_matches]

        if search:
            search_term = f"%{search}%"
            matched_employee_ids = []

            os_matches_q = db.session.query(OsEmployment.id).join(
                OsPerson, OsEmployment.person_id == OsPerson.person_id
            ).filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(search_term),
                    OsPerson.name.ilike(search_term)
                )
            )
            
            if subco_filter_active:
                os_matches_q = os_matches_q.filter(OsEmployment.sub_company_id.in_(subco_filter_active))
            if cc_filter_active:
                os_matches_q = os_matches_q.join(OsCostCenter, OsEmployment.id == OsCostCenter.employee_id)\
                                           .filter(OsCostCenter.org_cc_id.in_(cc_filter_active))

            os_matches = os_matches_q.all()
            matched_employee_ids.extend([str(row.id) for row in os_matches])

            if not req_subco and not req_dept and not allowed_subco and not allowed_cc:
                ob_matches = db.session.query(ObEmployee.employee_id).filter(
                    or_(
                        ObEmployee.employee_id.cast(db.String).ilike(search_term),
                        ObEmployee.employee_name.ilike(search_term)
                    )
                ).all()
                matched_employee_ids.extend([str(row.employee_id) for row in ob_matches])

            if matched_employee_ids:
                query = query.filter(Guest.employee_id.in_(matched_employee_ids))
            else:
                query = query.filter(False)
        else:
            if subco_emp_ids is not None:
                query = query.filter(Guest.employee_id.in_(subco_emp_ids))

        if filter_status == 'active':
            query = query.filter((Guest.valid_to >= now) | (Guest.valid_to == None))
        elif filter_status == 'inactive':
            query = query.filter(Guest.valid_to < now)

        # Urutkan data terbaru di atas
        query = query.order_by(Guest.id.desc())
        
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

# =============================================================================
# 2. SUBMIT SINGLE (Guest Biasa / Pengecualian)
# =============================================================================
@guest_bp.route('/guest/submit', methods=['POST'])
def submit():
    try:
        data = request.json or request.form
        employee_id = data.get('employee_id')
        canteen_id = data.get('canteen_id')
        valid_from_str = data.get('valid_from')
        valid_to_str = data.get('valid_to')
        
        # Tambahan field hibrida Puasa
        periode_puasa_id = data.get('periode_puasa_id')
        reason = data.get('reason')

        if not employee_id or not canteen_id or not valid_from_str:
            return jsonify({"status": "error", "message": "Data tidak lengkap"}), 400

        new_valid_from = datetime.strptime(valid_from_str, '%Y-%m-%d').date()
        new_valid_to = datetime.strptime(valid_to_str, '%Y-%m-%d').date() if valid_to_str else None

        # Histori Tutup Guest Terakhir (Hanya jika bukan Allowlist Puasa)
        if not periode_puasa_id:
            old_Guest = Guest.query.filter_by(employee_id=str(employee_id), periode_puasa_id=None)\
                                   .order_by(Guest.id.desc()).first()
            if old_Guest:
                previous_day = new_valid_from - timedelta(days=1)
                if not old_Guest.valid_from or previous_day >= old_Guest.valid_from:
                    old_Guest.valid_to = previous_day

        new_Guest = Guest(
            employee_id=str(employee_id),
            canteen_id=canteen_id,
            valid_from=new_valid_from,
            valid_to=new_valid_to,
            periode_puasa_id=periode_puasa_id if periode_puasa_id else None,
            reason=reason
        )
        db.session.add(new_Guest)
        db.session.commit()

        return jsonify({"status": "success", "message": "Data berhasil disimpan!"}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Gagal menyimpan: {str(e)}"}), 500


# =============================================================================
# 3. SUBMIT BULK (SLA OPTIMIZED - No N+1 Queries)
# =============================================================================
@guest_bp.route('/guest/submit-bulk', methods=['POST'])
def submit_bulk():
    try:
        data = request.json
        employee_ids = data.get('employee_ids', [])
        canteen_id = data.get('canteen_id')
        valid_from_str = data.get('valid_from')
        valid_to_str = data.get('valid_to')

        periode_puasa_id = data.get('periode_puasa_id')
        reason = data.get('reason')
        current_user = request.headers.get('X-User-Email', 'system')

        if not employee_ids or not canteen_id or not valid_from_str:
            return jsonify({"status": "error", "message": "Data wajib diisi"}), 400

        new_valid_from = datetime.strptime(valid_from_str, '%Y-%m-%d').date()
        new_valid_to = datetime.strptime(valid_to_str, '%Y-%m-%d').date() if valid_to_str else None
        previous_day = new_valid_from - timedelta(days=1)
        now_time = datetime.now()

        emp_ids_str = [str(eid) for eid in employee_ids]

        latest_old_guests = {}
        if not periode_puasa_id:
            old_guests = Guest.query.filter(Guest.employee_id.in_(emp_ids_str), Guest.periode_puasa_id == None).all()
            
            for g in old_guests:
                if g.employee_id not in latest_old_guests or g.id > latest_old_guests[g.employee_id].id:
                    latest_old_guests[g.employee_id] = g

        new_records = []
        for emp_id in emp_ids_str:
            # Eksekusi penutupan histori jika ini Guest Reguler
            if not periode_puasa_id:
                old_g = latest_old_guests.get(emp_id)
                if old_g and (not old_g.valid_from or previous_day >= old_g.valid_from):
                    old_g.valid_to = previous_day

            # [FIX] 3. Inject parameter Puasa & Manual Audit Trail (created_by)
            new_records.append(Guest(
                employee_id=emp_id,
                canteen_id=canteen_id,
                valid_from=new_valid_from,
                valid_to=new_valid_to,
                periode_puasa_id=periode_puasa_id if periode_puasa_id else None,
                reason=reason if periode_puasa_id else None,
                created_by=current_user,
                created_date=now_time
            ))

        if new_records:
            with db.session.begin_nested():
                db.session.bulk_save_objects(new_records)
        db.session.commit()

        return jsonify({"status": "success", "message": f"Berhasil memperbarui {len(new_records)} karyawan!"}), 201

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

# =============================================================================
# 4. DOWNLOAD TEMPLATE ALLOWLIST PUASA
# =============================================================================
@guest_bp.route('/guest/template-allowlist', methods=['GET'])
def template_allowlist():
    try:
        canteen_list = canteen.query.all()

        df_main = pd.DataFrame(columns=[
            'Employee ID', 'Canteen ID', 'Valid From (YYYY-MM-DD)', 
            'Valid To (YYYY-MM-DD)', 'Alasan Pengecualian'
        ])
        
        df_canteen = pd.DataFrame([
            {'Canteen ID': c.canteen_id, 'Canteen Name': c.canteen_name} 
            for c in canteen_list
        ])
        
        output = BytesIO()
        
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df_main.to_excel(writer, index=False, sheet_name='Template_Allowlist')
            df_canteen.to_excel(writer, index=False, sheet_name='Master_Kantin')
            
            workbook = writer.book
            ws_main = workbook['Template_Allowlist']
            ws_canteen = workbook['Master_Kantin']
            
            ws_canteen.sheet_state = 'hidden'
            
            if len(canteen_list) > 0:
                max_row = len(canteen_list) + 1
                formula = f"Master_Kantin!$B$2:$B${max_row}"
                
                dv = DataValidation(type="list", formula1=formula, allow_blank=True)
                dv.error = 'Kantin tidak valid. Silakan pilih dari Dropdown.'
                dv.errorTitle = 'Invalid Entry'
                dv.prompt = 'Pilih Kantin dari list'
                dv.promptTitle = 'Pilihan Kantin'
                
                dv.add('B2:B10000')
                ws_main.add_data_validation(dv)
                
            ws_main.column_dimensions['A'].width = 18
            ws_main.column_dimensions['B'].width = 18
            ws_main.column_dimensions['C'].width = 25
            ws_main.column_dimensions['D'].width = 25
            ws_main.column_dimensions['E'].width = 30
            
        output.seek(0)
        return send_file(
            output,
            as_attachment=True,
            download_name=f"Template_Allowlist_Puasa_{datetime.now().strftime('%Y%m%d')}.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


# =============================================================================
# 5. UPLOAD MASSAL EXCEL ALLOWLIST (IN-MEMORY ANTI-JOIN)
# =============================================================================
# =============================================================================
# 5. UPLOAD MASSAL EXCEL (IN-MEMORY MAPPING, ANTI-JOIN & HISTORY AUTO-CLOSE)
# =============================================================================
@guest_bp.route('/guest/upload-allowlist', methods=['POST'])
def upload_allowlist():
    try:
        file = request.files.get('file')
        periode_id_raw = request.form.get('periode_id')
        current_user = request.headers.get('X-User-Email', 'system')

        if not file:
            return jsonify({'status': 'error', 'message': 'File Excel wajib ada.'}), 400
        
        is_puasa = bool(periode_id_raw and periode_id_raw not in ['reguler', 'all', 'null', ''])
        actual_periode_id = periode_id_raw if is_puasa else None

        default_start = datetime.now().date()
        default_end = (datetime.now() + timedelta(days=30)).date()
        now_time = datetime.now()

        df = pd.read_excel(file, dtype={'Employee ID': str})
        df.columns = df.columns.str.strip()
        df = df.dropna(subset=['Employee ID'])

        all_canteens = canteen.query.all()
        canteen_name_map = {c.canteen_name.strip().lower(): c.canteen_id for c in all_canteens}
        valid_canteen_ids = {c.canteen_id for c in all_canteens}

        raw_excel_nrp = df['Employee ID'].dropna().astype(str).str.strip().unique().tolist()
        emp_pk_map = {}
        if raw_excel_nrp:
            os_emps = OsEmployment.query.filter(OsEmployment.employee_code.in_(raw_excel_nrp)).all()
            for emp in os_emps:
                emp_pk_map[str(emp.employee_code).strip()] = str(emp.id)
                
            ob_emps = ObEmployee.query.filter(ObEmployee.employee_id.in_(raw_excel_nrp)).all()
            for emp in ob_emps:
                emp_pk_map[str(emp.employee_id).strip()] = str(emp.employee_id)
        actual_emp_ids = list(emp_pk_map.values())

        latest_old_guests = {}
        existing_emp_ids = set()

        if not is_puasa and actual_emp_ids:
            old_guests = Guest.query.filter(Guest.employee_id.in_(actual_emp_ids), Guest.periode_puasa_id == None).all()
            for g in old_guests:
                if g.employee_id not in latest_old_guests or g.id > latest_old_guests[g.employee_id].id:
                    latest_old_guests[g.employee_id] = g
        elif is_puasa and actual_emp_ids:
            existing_guests = Guest.query.filter(Guest.employee_id.in_(actual_emp_ids), Guest.periode_puasa_id == actual_periode_id).all()
            existing_emp_ids = {str(g.employee_id).strip() for g in existing_guests}

        new_records = []
        errors = []

        for index, row in df.iterrows():
            line_num = index + 2
            emp_code_input = str(row.get('Employee ID', '')).strip()
            
            canteen_input = row.get('Nama Kantin') if 'Nama Kantin' in df.columns else row.get('Canteen ID')
            canteen_input_str = str(canteen_input).strip() if pd.notna(canteen_input) else ''

            if not emp_code_input or emp_code_input == 'nan':
                errors.append(f"Baris {line_num}: Employee ID (NRP) wajib diisi.")
                continue
                
            if not canteen_input_str or canteen_input_str.lower() == 'nan':
                errors.append(f"Baris {line_num}: Nama Kantin wajib diisi untuk NRP {emp_code_input}.")
                continue

            actual_emp_id = emp_pk_map.get(emp_code_input)
            if not actual_emp_id:
                errors.append(f"Baris {line_num}: Karyawan dengan NRP '{emp_code_input}' tidak ditemukan di sistem HRIS.")
                continue

            canteen_id = canteen_name_map.get(canteen_input_str.lower())
            if not canteen_id:
                if canteen_input_str in valid_canteen_ids:
                    canteen_id = canteen_input_str
                else:
                    errors.append(f"Baris {line_num}: Kantin '{canteen_input_str}' tidak valid.")
                    continue

            if is_puasa and actual_emp_id in existing_emp_ids:
                errors.append(f"Baris {line_num}: Karyawan NRP {emp_code_input} sudah ada di Allowlist periode ini.")
                continue

            try:
                v_from_raw = row.get('Valid From (YYYY-MM-DD)')
                v_to_raw = row.get('Valid To (YYYY-MM-DD)')
                v_from = pd.to_datetime(v_from_raw).date() if pd.notna(v_from_raw) else default_start
                v_to = pd.to_datetime(v_to_raw).date() if pd.notna(v_to_raw) else default_end
            except Exception:
                errors.append(f"Baris {line_num}: Format tanggal salah untuk {emp_code_input}.")
                continue

            if not is_puasa:
                old_g = latest_old_guests.get(actual_emp_id)
                previous_day = v_from - timedelta(days=1)
                if old_g and (not old_g.valid_from or previous_day >= old_g.valid_from):
                    old_g.valid_to = previous_day

            new_records.append(Guest(
                employee_id=actual_emp_id, 
                canteen_id=canteen_id,
                valid_from=v_from,
                valid_to=v_to,
                periode_puasa_id=actual_periode_id,
                reason=str(row.get('Alasan Pengecualian', '')).strip() or 'Allowlist Puasa' if is_puasa else None,
                created_by=current_user,
                created_date=now_time
            ))

        if new_records:
            with db.session.begin_nested():
                db.session.bulk_save_objects(new_records)
        db.session.commit()

        status = "partial_success" if errors and new_records else ("success" if new_records else "error")
        return jsonify({
            "status": status,
            "message": f"Berhasil memproses {len(new_records)} data Guest.",
            "errors": errors
        }), 200

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": f"Kesalahan Sistem: {str(e)}"}), 500
    
# =============================================================================
# 6. UPDATE (PUT) & DELETE
# =============================================================================
@guest_bp.route('/guest/<string:id>', methods=['PUT'])
def update(id):
    try:
        guest_obj = Guest.query.filter_by(id=id).first()
        if not guest_obj:
            return jsonify({"status": "error", "message": "Data tidak ditemukan"}), 404

        data = request.json
        guest_obj.employee_id = data.get('employee_id', guest_obj.employee_id)
        guest_obj.canteen_id = data.get('canteen_id', guest_obj.canteen_id)
        
        if 'periode_puasa_id' in data:
            guest_obj.periode_puasa_id = data.get('periode_puasa_id')
        if 'reason' in data:
            guest_obj.reason = data.get('reason')
            
        if data.get('valid_from'):
            guest_obj.valid_from = datetime.strptime(data.get('valid_from'), '%Y-%m-%d').date()
            
        if 'valid_to' in data:
            new_valid_to = data.get('valid_to')
            guest_obj.valid_to = datetime.strptime(new_valid_to, '%Y-%m-%d').date() if new_valid_to else None

        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@guest_bp.route('/guest/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = Guest.query.filter_by(id=id).first()
        if not data:
            return jsonify({"status": "error", "message": "Data tidak ditemukan"}), 404

        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500