from flask import Blueprint, request, jsonify, send_file
from datetime import datetime
from sqlalchemy import text
from extensions import db
import math
import pandas as pd
from io import BytesIO

absenVendor_bp = Blueprint('absenVendor_bp', __name__)

def _build_report_query(args):
    start_date = args.get('start_date', '')
    end_date = args.get('end_date', '')
    status_filter = args.get('status_filter', 'all_data') 
    sub_company = args.get('sub_company', '')
    search = args.get('search', '').strip()    
    clocking_type = args.get('clocking_type', 'all_data')
    sort_by = args.get('sort_by', 'tgl_clocking')
    sort_dir = args.get('sort_dir', 'DESC').upper()

    if not start_date or not end_date:
        raise ValueError("Tanggal awal dan akhir harus diisi")

    allowed_sort_columns = ['tgl_clocking', 'jenis_clocking', 'mode', 'comp_id', 'emp_id', 'card_no', 'display_name']
    if sort_by not in allowed_sort_columns:
        sort_by = 'tgl_clocking'
        
    if sort_dir not in ['ASC', 'DESC']:
        sort_dir = 'DESC'

    base_query = """
        WITH DataValid AS (
            SELECT 
                -- Logika MIN/MAX (IN jadi MAX, OUT jadi MIN)
                CASE WHEN v.clocking_mode = 0 THEN MAX(v.clocking_time) ELSE MIN(v.clocking_time) END AS tgl_clocking,
                v.clocking_type AS jenis_clocking,
                CASE WHEN v.clocking_mode = 0 THEN 'IN' ELSE 'OUT' END AS mode,
                COALESCE(o.sub_company_name, '-') AS comp_id,
                v.nrp AS emp_id,
                v.card_no,
                COALESCE(o.employee_name, '-') AS display_name,
                'Valid' AS status_data,
                '-' AS ket_reject
            FROM absensi_vendor v
            LEFT JOIN vw_master_os_active o 
                ON v.nrp COLLATE utf8mb4_unicode_ci = o.employee_code COLLATE utf8mb4_unicode_ci
            WHERE DATE(v.clocking_time) BETWEEN :start_date AND :end_date
            GROUP BY 
                DATE(v.clocking_time), v.nrp, v.card_no, v.clocking_type, 
                v.clocking_mode, o.sub_company_name, o.employee_name
        ),
        DataReject AS (
            SELECT 
                l.clocking_time AS tgl_clocking,
                '-' AS jenis_clocking,
                '-' AS mode,
                '-' AS comp_id,
                '-' AS emp_id,
                l.card_no,
                '-' AS display_name,
                'Reject' AS status_data,
                l.message AS ket_reject
            FROM log_invalid_card l
            WHERE DATE(l.clocking_time) BETWEEN :start_date AND :end_date
        ),
        AllData AS (
            SELECT * FROM DataValid
            UNION ALL
            SELECT * FROM DataReject
        )
        SELECT * FROM AllData
        WHERE 1=1
    """

    params = {'start_date': start_date, 'end_date': end_date}

    if status_filter == 'valid':
        base_query += " AND status_data = 'Valid'"
    elif status_filter == 'reject':
        base_query += " AND status_data = 'Reject'"

    if clocking_type != 'all_data':
        base_query += " AND jenis_clocking = :c_type"
        params['c_type'] = clocking_type

    if sub_company:
        base_query += " AND comp_id = :sub_company"
        params['sub_company'] = sub_company

    if search:
        base_query += " AND (emp_id LIKE :search OR display_name LIKE :search OR card_no LIKE :search)"
        params['search'] = f"%{search}%"

    base_query += f" ORDER BY {sort_by} {sort_dir}"
    
    return base_query, params

# ==========================================
# 1. ENDPOINT UNTUK KIOSK (TAPPING KARTU)
# ==========================================
@absenVendor_bp.route('/absensiVendor/tap', methods=['POST'])
def process_vendor_tap():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "Payload tidak ditemukan"}), 400

        card_no = data.get('card_no', '').strip()
        raw_card_no = data.get('raw_card_no', '').strip()
        clocking_type = data.get('clocking_type', 'Absensi').strip()
        
        try:
            clocking_mode = int(data.get('clocking_mode', 0))
        except ValueError:
            clocking_mode = 0

        if not card_no:
            return jsonify({"success": False, "message": "Silakan tap kartu kembali"}), 400

        check_sql = """
            SELECT 
                employee_code AS emp_id, 
                employee_name AS display_name, 
                card_number, 
                sub_company_name, 
                photo_url 
            FROM vw_master_os_active
            WHERE card_number IN (:card_no, :raw_card_no)
            LIMIT 1
        """
        employee = db.session.execute(text(check_sql), {
            'card_no': card_no,
            'raw_card_no': raw_card_no
        }).mappings().fetchone()
        
        current_time = datetime.now()

        if not employee:
            error_msg = "Kartu tidak terdaftar"
            log_sql = """
                INSERT INTO log_invalid_card (card_no, clocking_time, message)
                VALUES (:card, :clocking_time, :message)
            """
            db.session.execute(text(log_sql), {
                'card': raw_card_no if raw_card_no else card_no, # Simpan angka mentah ke log
                'clocking_time': current_time,
                'message': error_msg
            })
            db.session.commit()
            return jsonify({"success": False, "message": error_msg}), 404
        
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

# ==========================================
# 2. ENDPOINT UNTUK REPORT (DATATABLE)
# ==========================================
@absenVendor_bp.route('/absensiVendor', methods=['GET'])
def get_absensi_vendor_report():
    try:
        base_query, params = _build_report_query(request.args)
        
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('pageSize', 20))

        count_query = f"SELECT COUNT(*) FROM ({base_query}) AS total"
        total_data = db.session.execute(text(count_query), params).scalar()

        paginated_query = base_query + " LIMIT :limit OFFSET :offset"
        params['limit'] = page_size
        params['offset'] = (page - 1) * page_size

        result = db.session.execute(text(paginated_query), params).mappings().fetchall()

        data_list = []
        for row in result:
            row_dict = dict(row)
            if row_dict.get('tgl_clocking'):
                row_dict['tgl_clocking'] = str(row_dict['tgl_clocking'])
            data_list.append(row_dict)
        
        return jsonify({
            "status": "success",
            "data": [dict(row) for row in result],
            "total_data": total_data,
            "total_page": math.ceil(total_data / page_size) if total_data > 0 else 0
        }), 200

    except ValueError as ve:
        return jsonify({"status": "error", "message": str(ve)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@absenVendor_bp.route('/absensiVendor/export', methods=['GET'])
def export_absensi_vendor():
    try:
        base_query, params = _build_report_query(request.args)
        result = db.session.execute(text(base_query), params).mappings().fetchall()
        
        data_list = [dict(row) for row in result]
        
        if not data_list:
            return jsonify({"status": "error", "message": "Tidak ada data untuk diekspor"}), 404

        df = pd.DataFrame(data_list)
        
        df.rename(columns={
            'tgl_clocking': 'Waktu Clocking',
            'jenis_clocking': 'Jenis',
            'mode': 'Mode (IN/OUT)',
            'comp_id': 'Sub Company',
            'emp_id': 'NRP / ID',
            'card_no': 'No Kartu',
            'display_name': 'Nama Karyawan',
            'status_data': 'Status',
            'ket_reject': 'Ket Reject'
        }, inplace=True)

        if 'Waktu Clocking' in df.columns:
            df['Waktu Clocking'] = pd.to_datetime(df['Waktu Clocking']).dt.tz_localize(None)

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Report Absen Vendor')
        
        output.seek(0)
        
        return send_file(
            output,
            as_attachment=True,
            download_name="Report_Absen_Vendor.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    except ValueError as ve:
        return jsonify({"status": "error", "message": str(ve)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500