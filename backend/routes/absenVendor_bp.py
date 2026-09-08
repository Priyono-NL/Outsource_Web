from flask import Blueprint, request, jsonify
from datetime import datetime
from sqlalchemy import text
from extensions import db

absenVendor_bp = Blueprint('absenVendor_bp', __name__)

@absenVendor_bp.route('/absensiVendor/tap', methods=['POST'])
def process_vendor_tap():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "Payload tidak ditemukan"}), 400

        card_no = data.get('card_no', '').strip()
        clocking_type = data.get('clocking_type', 'Absensi').strip()
        
        try:
            clocking_mode = int(data.get('clocking_mode', 0))
        except ValueError:
            clocking_mode = 0

        if not card_no:
            return jsonify({"success": False, "message": "Silakan tap kartu kembali"}), 400

        # --- UPDATE QUERY: Ganti cc_name jadi sub_company_name ---
        check_sql = """
            SELECT 
                employee_code AS emp_id, 
                employee_name AS display_name, 
                card_number, 
                sub_company_name, 
                photo_url 
            FROM vw_master_os_active
            WHERE card_number = :card_no
            LIMIT 1
        """
        
        employee = db.session.execute(text(check_sql), {'card_no': card_no}).mappings().fetchone()

        if not employee:
            return jsonify({"success": False, "message": "Kartu OS tidak terdaftar"}), 404

        current_time = datetime.now()
        
        insert_sql = """
            INSERT INTO absensi_vendor (card_no, nrp, clocking_time, clocking_type, clocking_mode)
            VALUES (:card_no, :nrp, :c_time, :c_type, :c_mode)
        """
        
        db.session.execute(text(insert_sql), {
            'card_no': employee['card_number'],
            'nrp': employee['emp_id'],
            'c_time': current_time,
            'c_type': clocking_type[:10], 
            'c_mode': clocking_mode
        })
        
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Absensi Berhasil",
            "employee": {
                "emp_id": employee['emp_id'],
                "display_name": employee['display_name'],
                "sub_company_name": employee['sub_company_name'],
                "photo_url": employee['photo_url'] if employee['photo_url'] else None
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Terjadi kesalahan server: {str(e)}"}), 500