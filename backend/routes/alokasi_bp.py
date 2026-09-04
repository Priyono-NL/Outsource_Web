from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from extensions import db
from .auth_bp import login_required
from model.alokasi import Alokasi
from model.employment import OsEmployment
from model.person import OsPerson
from model.ob_emp import ObEmployee

alokasi_bp = Blueprint('alokasi_bp', __name__)

@alokasi_bp.route('/alokasi')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 100, type=int)
        search = request.args.get('search', '', type=str)
        filter = request.args.get('filter', '', type=str)
        query = Alokasi.query
        now = datetime.now()

        if search:
            search_term = f"%{search}%"
            matched_employee_ids = []

            os_matches = db.session.query(OsEmployment.id).join(
                OsPerson, OsEmployment.person_id == OsPerson.person_id
            ).filter(
                or_(
                    OsEmployment.employee_code.cast(db.String).ilike(search_term),
                    OsPerson.name.ilike(search_term)
                )
            ).all()
            
            matched_employee_ids.extend([str(row.id) for row in os_matches])

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

        if filter == 'active':
            query = query.filter((Alokasi.valid_to >= now) | (Alokasi.valid_to == None))
        elif filter == 'inactive':
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

@alokasi_bp.route('/alokasi/submit', methods=['POST'])
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
        old_alokasi = Alokasi.query.filter_by(employee_id=employee_id)\
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

@alokasi_bp.route('/alokasi/submit-bulk', methods=['POST'])
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

            # --- LOGIKA HISTORI UNTUK SETIAP KARYAWAN ---
            old_alokasi = Alokasi.query.filter_by(employee_id=emp_id_str)\
                                       .order_by(Alokasi.id.desc())\
                                       .first()

            if old_alokasi:
                if not old_alokasi.valid_from or previous_day >= old_alokasi.valid_from:
                    old_alokasi.valid_to = previous_day

            # --- SIMPAN ALOKASI BARU ---
            new_alokasi = Alokasi(
                employee_id=emp_id_str,
                canteen_id=canteen_id,
                valid_from=new_valid_from,
                valid_to=new_valid_to
            )
            db.session.add(new_alokasi)
            inserted_count += 1

        # Commit sekali saja di akhir loop untuk efisiensi transaksi database
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

@alokasi_bp.route('/alokasi/<string:id>', methods=['PUT'])
def update(id):
    try:
        alokasi = Alokasi.query.filter_by(id=id).first()
        data = request.json
        alokasi.employee_id = data.get('employee_id', alokasi.employee_id)
        alokasi.canteen_id = data.get('canteen_id', alokasi.canteen_id)
        alokasi.valid_from = data.get('valid_from', alokasi.valid_from)
        if 'valid_to' in data:
            new_valid_to = data.get('valid_to')
            alokasi.valid_to = new_valid_to if new_valid_to else None
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    
@alokasi_bp.route('/alokasi/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data = Alokasi.query.filter_by(id=id).first()
        db.session.delete(data)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500
    
# @alokasi_bp.before_request
# @login_required
# def before_request():
#     pass