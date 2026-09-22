from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from extensions import db

from model.alokasi import Alokasi
from model.employment import OsEmployment
from model.person import OsPerson
from model.ob_emp import ObEmployee
from model.osCostCenter import OsCostCenter
from model.hr_models import User, UserSubcompanyAccess, UserCostCenterAccess

guest_bp = Blueprint('guest_bp', __name__)

@guest_bp.route('/guest', methods=['GET'])
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 100, type=int)
        search = request.args.get('search', '', type=str)
        filter_status = request.args.get('filter', '', type=str)
        req_subco = request.args.get('subcompany', '', type=str)
        req_dept = request.args.get('department', '', type=str)
        
        query = Alokasi.query
        now = datetime.now()

        # =================================================================
        # 1. LOGIKA FILTER HAK AKSES SSO (SUBCOMPANY & COST CENTER)
        # =================================================================
        user_email = request.headers.get('X-User-Email')
        allowed_subco = []
        allowed_cc = []

        if user_email:
            user = User.query.filter_by(email=user_email).first()
            if user:
                # Access Subcompany Check
                subco_records = UserSubcompanyAccess.query.filter_by(user_id=user.id).all()
                allowed_subco = [a.sub_company_id for a in subco_records]
                if allowed_subco and req_subco and req_subco not in allowed_subco:
                    return jsonify({"status": "error", "message": "Akses Subcompany ditolak"}), 403

                # Access Cost Center / Department Check
                cc_records = UserCostCenterAccess.query.filter_by(user_id=user.id).all()
                allowed_cc = [c.cost_center_id for c in cc_records]
                if allowed_cc and req_dept:
                    try:
                        if int(req_dept) not in allowed_cc:
                            return jsonify({"status": "error", "message": "Akses Departemen ditolak"}), 403
                    except ValueError:
                        pass

        # Penentuan Filter Aktif
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

        # =================================================================
        # 2. FILTER SEARCH KATA KUNCI & ID KARYAWAN
        # =================================================================
        if search:
            search_term = f"%{search}%"
            matched_employee_ids = []

            # Search pada OsEmployment
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

            # Search pada ObEmployee (Hanya jika tidak ada batasan subcompany / department)
            if not req_subco and not req_dept and not allowed_subco and not allowed_cc:
                ob_matches = db.session.query(ObEmployee.employee_id).filter(
                    or_(
                        ObEmployee.employee_id.cast(db.String).ilike(search_term),
                        ObEmployee.employee_name.ilike(search_term)
                    )
                ).all()
                matched_employee_ids.extend([str(row.employee_id) for row in ob_matches])

            if matched_employee_ids:
                query = query.filter(Alokasi.employee_id.in_(matched_employee_ids))
            else:
                query = query.filter(False)
        else:
            if subco_emp_ids is not None:
                query = query.filter(Alokasi.employee_id.in_(subco_emp_ids))

        # Filter Berdasarkan Status Aktif / Inaktif
        if filter_status == 'active':
            query = query.filter((Alokasi.valid_to >= now) | (Alokasi.valid_to == None))
        elif filter_status == 'inactive':
            query = query.filter(Alokasi.valid_to < now)

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


@guest_bp.route('/guest/submit', methods=['POST'])
def submit():
    try:
        data = request.json or request.form
        employee_id = data.get('employee_id')
        canteen_id = data.get('canteen_id')
        valid_from_str = data.get('valid_from')
        valid_to_str = data.get('valid_to')

        if not employee_id or not canteen_id or not valid_from_str:
            return jsonify({"status": "error", "message": "Data tidak lengkap"}), 400

        # Parse tanggal baru
        new_valid_from = datetime.strptime(valid_from_str, '%Y-%m-%d').date()
        new_valid_to = datetime.strptime(valid_to_str, '%Y-%m-%d').date() if valid_to_str else None

        # --- LOGIKA HISTORI: Tutup Alokasi Terakhir di H-1 ---
        old_alokasi = Alokasi.query.filter_by(employee_id=str(employee_id))\
                                   .order_by(Alokasi.id.desc())\
                                   .first()

        if old_alokasi:
            previous_day = new_valid_from - timedelta(days=1)
            # Cegah valid_to lama menjadi lebih kecil dari valid_from lama
            if not old_alokasi.valid_from or previous_day >= old_alokasi.valid_from:
                old_alokasi.valid_to = previous_day

        # --- SIMPAN ALOKASI BARU ---
        new_alokasi = Alokasi(
            employee_id=str(employee_id),
            canteen_id=canteen_id,
            valid_from=new_valid_from,
            valid_to=new_valid_to
        )
        db.session.add(new_alokasi)
        db.session.commit()

        return jsonify({
            "status": "success",
            "message": "Data alokasi berhasil disimpan dan alokasi lama diperbarui!"
        }), 201

    except ValueError as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Format tanggal salah: {str(e)}"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Gagal menyimpan: {str(e)}"}), 500


@guest_bp.route('/guest/submit-bulk', methods=['POST'])
def submit_bulk():
    try:
        data = request.json
        employee_ids = data.get('employee_ids', [])
        canteen_id = data.get('canteen_id')
        valid_from_str = data.get('valid_from')
        valid_to_str = data.get('valid_to')

        if not employee_ids or not canteen_id or not valid_from_str:
            return jsonify({"status": "error", "message": "Karyawan, kantin, dan tanggal mulai wajib diisi"}), 400

        new_valid_from = datetime.strptime(valid_from_str, '%Y-%m-%d').date()
        new_valid_to = datetime.strptime(valid_to_str, '%Y-%m-%d').date() if valid_to_str else None
        previous_day = new_valid_from - timedelta(days=1)

        inserted_count = 0

        # Loop setiap karyawan
        for emp_id in employee_ids:
            emp_id_str = str(emp_id)

            # Logika Histori Setiap Karyawan
            old_alokasi = Alokasi.query.filter_by(employee_id=emp_id_str)\
                                       .order_by(Alokasi.id.desc())\
                                       .first()

            if old_alokasi:
                if not old_alokasi.valid_from or previous_day >= old_alokasi.valid_from:
                    old_alokasi.valid_to = previous_day

            # Simpan Alokasi Baru
            new_alokasi = Alokasi(
                employee_id=emp_id_str,
                canteen_id=canteen_id,
                valid_from=new_valid_from,
                valid_to=new_valid_to
            )
            db.session.add(new_alokasi)
            inserted_count += 1

        db.session.commit()

        return jsonify({
            "status": "success",
            "message": f"Berhasil memperbarui alokasi untuk {inserted_count} karyawan!"
        }), 201

    except ValueError as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Format tanggal salah: {str(e)}"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"Gagal simpan massal: {str(e)}"}), 500


@guest_bp.route('/guest/<string:id>', methods=['PUT'])
def update(id):
    try:
        alokasi = Alokasi.query.filter_by(id=id).first()
        if not alokasi:
            return jsonify({"status": "error", "message": "Data alokasi tidak ditemukan"}), 404

        data = request.json
        alokasi.employee_id = data.get('employee_id', alokasi.employee_id)
        alokasi.canteen_id = data.get('canteen_id', alokasi.canteen_id)
        
        if data.get('valid_from'):
            alokasi.valid_from = datetime.strptime(data.get('valid_from'), '%Y-%m-%d').date()
            
        if 'valid_to' in data:
            new_valid_to = data.get('valid_to')
            alokasi.valid_to = datetime.strptime(new_valid_to, '%Y-%m-%d').date() if new_valid_to else None

        db.session.commit()
        return jsonify({"status": "success", "message": "Data alokasi berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@guest_bp.route('/guest/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = Alokasi.query.filter_by(id=id).first()
        if not data:
            return jsonify({"status": "error", "message": "Data alokasi tidak ditemukan"}), 404

        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data alokasi berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500