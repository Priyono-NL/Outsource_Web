from flask import Blueprint, request, jsonify
from sqlalchemy import text
from extensions import db
from model.periode import periode, PeriodePhase, PeriodeSchedule, PeriodeTime

periode_bp = Blueprint('periode_bp', __name__)

# Zero-Zombie Connection Policy
@periode_bp.teardown_request
def teardown_request(exception=None):
    try:
        db.session.remove()
    except Exception:
        pass

# =========================================================================
# 1. GET ALL (DATATABLE)
# =========================================================================
@periode_bp.route('/periode', methods=['GET'])
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        
        query = periode.query
        if search:                    
            query = query.filter(periode.periode_name.ilike(f"%{search}%"))
            
        pagination = query.paginate(page=page, per_page=pageSize, error_out=False)
        return jsonify({
            "status": "success",
            "data": [p.to_dict() for p in pagination.items],
            "total_page": pagination.pages,
            "current_page": pagination.page,
            "total_item": pagination.total
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# =========================================================================
# 2. GET DETAIL (UNTUK EDIT DI FRONTEND)
# =========================================================================
@periode_bp.route('/periode/<int:id>', methods=['GET'])
def get_detail(id):
    try:
        header = periode.query.get(id)
        if not header:
            return jsonify({"status": "error", "message": "Data tidak ditemukan."}), 404

        # Ambil Child Data
        phases = PeriodePhase.query.filter_by(periode_id=id).all()
        schedules = PeriodeSchedule.query.filter_by(periode_id=id).all()

        # Format Phase
        phases_out = [{
            "id": str(p.id),  # Berikan ID DB asli sebagai Temporary ID saat dirender ulang di React
            "name": p.name,
            "start_date": p.start_date.strftime('%Y-%m-%d') if p.start_date else None,
            "end_date": p.end_date.strftime('%Y-%m-%d') if p.end_date else None
        } for p in phases]

        # Format Schedules & Times
        schedules_out = []
        for s in schedules:
            times = PeriodeTime.query.filter_by(schedule_id=s.id).all()
            times_dict = {str(t.phase_id): {"start": t.start_time, "end": t.end_time} for t in times}
            
            schedules_out.append({
                "id": s.id,
                "shift_type": s.shift_type,
                "target_shift": s.target_shift,
                "times": times_dict
            })

        data_out = header.to_dict()
        data_out['phases'] = phases_out
        data_out['schedules'] = schedules_out

        return jsonify({"status": "success", "data": data_out}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# =========================================================================
# 3. UPSERT SAKTI (INSERT / HARD-DELETE UPDATE)
# =========================================================================
@periode_bp.route('/periode/submit', methods=['POST'])
def submit():
    try:
        data = request.json if request.is_json else request.form        
        periode_id = data.get('periode_id')

        # Bungkus dalam Atomic Transaction agar jika error di tengah, DB tidak rusak
        with db.session.begin_nested():
            if periode_id:
                # ==========================
                # MODE: UPDATE (HARD DELETE)
                # ==========================
                header = periode.query.get(periode_id)
                if not header:
                    raise ValueError("Data periode tidak ditemukan.")
                
                # Update data master
                header.periode_name = data.get('periode_name')
                header.tahun = data.get('tahun')
                header.start_date = data.get('start_date')
                header.end_date = data.get('end_date')

                # Hard Delete semua Child Data peninggalan lama
                schedule_ids = [s.id for s in PeriodeSchedule.query.filter_by(periode_id=periode_id).all()]
                if schedule_ids:
                    PeriodeTime.query.filter(PeriodeTime.schedule_id.in_(schedule_ids)).delete(synchronize_session=False)
                PeriodeSchedule.query.filter_by(periode_id=periode_id).delete()
                PeriodePhase.query.filter_by(periode_id=periode_id).delete()
                
            else:
                # ==========================
                # MODE: INSERT BARU
                # ==========================
                header = periode(
                    periode_name=data.get('periode_name'),
                    tahun=data.get('tahun'),
                    start_date=data.get('start_date'),
                    end_date=data.get('end_date')
                )
                db.session.add(header)
                db.session.flush() # Eksekusi sementara untuk mendapatkan header.periode_id

            # ============================================
            # RE-INSERT CHILD 1: PHASES (Mapping Temp ID)
            # ============================================
            phases_data = data.get('phases', [])
            temp_id_map = {} # Kamus Penterjemah: { '1792478487903' : 12 }
            
            for p in phases_data:
                temp_id = str(p.get('id'))
                new_phase = PeriodePhase(
                    periode_id=header.periode_id,
                    name=p.get('name'),
                    start_date=p.get('start_date'),
                    end_date=p.get('end_date')
                )
                db.session.add(new_phase)
                db.session.flush() # Paksa MySQL mengeluarkan Auto Increment ID
                temp_id_map[temp_id] = new_phase.id

            # ============================================
            # RE-INSERT CHILD 2 & 3: SCHEDULES AND TIMES
            # ============================================
            schedules_data = data.get('schedules', [])
            for s in schedules_data:
                new_sched = PeriodeSchedule(
                    periode_id=header.periode_id,
                    shift_type=s.get('shift_type'),
                    target_shift=s.get('target_shift')
                )
                db.session.add(new_sched)
                db.session.flush()

                # Memecah Object Times
                times_data = s.get('times', {})
                for temp_phase_id, time_dict in times_data.items():
                    # Terjemahkan Temp ID ke Real DB ID
                    real_phase_id = temp_id_map.get(str(temp_phase_id))
                    
                    if real_phase_id:
                        new_time = PeriodeTime(
                            schedule_id=new_sched.id,
                            phase_id=real_phase_id,
                            start_time=time_dict.get('start'),
                            end_time=time_dict.get('end')
                        )
                        db.session.add(new_time)

        # Jika seluruh rangkaian di atas aman tanpa crash, kita simpan permanen.
        db.session.commit()
        return jsonify({
            "status": "success",
            "message": "Data periode puasa dan jadwal berhasil disimpan!"
        }), 200

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": "Terjadi kesalahan sistem: " + str(e)}), 500

# =========================================================================
# 4. DELETE FULL (CASCADE EFFECT)
# =========================================================================
@periode_bp.route('/periode/<int:id>', methods=['DELETE'])
def delete(id):
    try:
        header = periode.query.get(id)
        if not header:
            return jsonify({"status": "error", "message": "Data tidak ditemukan!"}), 404
        
        with db.session.begin_nested():
            # Hapus dari cucu ke induk untuk mencegah Foreign Key Violation
            schedule_ids = [s.id for s in PeriodeSchedule.query.filter_by(periode_id=id).all()]
            if schedule_ids:
                PeriodeTime.query.filter(PeriodeTime.schedule_id.in_(schedule_ids)).delete(synchronize_session=False)
            
            PeriodeSchedule.query.filter_by(periode_id=id).delete()
            PeriodePhase.query.filter_by(periode_id=id).delete()
            db.session.delete(header)
            
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500