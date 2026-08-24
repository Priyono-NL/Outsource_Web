import pandas as pd
from io import BytesIO
from flask import Blueprint, request, jsonify, send_file
from sqlalchemy import text
from datetime import datetime, date

from extensions import db

AbsenBreak_bp = Blueprint('AbsenBreak_bp', __name__)

# =============================================================================
# HELPER: LAPORAN EMPLOYEE BREAK
# =============================================================================
def _get_break_data(start_date, end_date, sub_company_id, department_id):
    if not start_date or not end_date:
        raise ValueError("Parameter start_date dan end_date wajib diisi")

    filters = []
    params = {'start_date': start_date, 'end_date': end_date}
    
    if sub_company_id:
        filters.append("k.sub_company_id = :sub_company_id")
        params['sub_company_id'] = sub_company_id
        
    if department_id:
        filters.append("k.cost_center = :department_id")
        params['department_id'] = department_id
        
    filter_clause = " AND " + " AND ".join(filters) if filters else ""

    # Menggunakan DATE_FORMAT untuk memastikan MySQL melempar string ('HH:MM') ke Python,
    # Menghindari error timedelta. Dan filter ClockData hanya mengambil action_flag = 'Break'
    sql_query = f"""
        WITH Karyawan AS (
            SELECT 
                CONVERT(employee_id USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_id, 
                CONVERT(employee_name USING utf8mb4) COLLATE utf8mb4_general_ci AS display_name, 
                CONVERT(card_no USING utf8mb4) COLLATE utf8mb4_general_ci AS card_number, 
                CONVERT(CAST(cost_center AS CHAR) USING utf8mb4) COLLATE utf8mb4_general_ci AS cost_center, 
                CONVERT(dept_name USING utf8mb4) COLLATE utf8mb4_general_ci AS cc_name, 
                CONVERT(company_id USING utf8mb4) COLLATE utf8mb4_general_ci AS sub_company_id
            FROM vw_master_karyawan
            
            UNION
            
            SELECT 
                CONVERT(employee_code USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_id, 
                CONVERT(employee_name USING utf8mb4) COLLATE utf8mb4_general_ci AS display_name, 
                CONVERT(card_number USING utf8mb4) COLLATE utf8mb4_general_ci AS card_number, 
                CONVERT(CAST(cost_center_id AS CHAR) USING utf8mb4) COLLATE utf8mb4_general_ci AS cost_center, 
                CONVERT(cc_name USING utf8mb4) COLLATE utf8mb4_general_ci AS cc_name, 
                CONVERT(sub_company_id USING utf8mb4) COLLATE utf8mb4_general_ci AS sub_company_id
            FROM vw_master_os_active
        ),
        ClockData AS (
            SELECT 
                CONVERT(emp_id USING utf8mb4) COLLATE utf8mb4_general_ci AS emp_id, 
                DATE(clocking_time) as clock_date,
                DATE_FORMAT(MIN(CASE WHEN direction = 'OUT' THEN clocking_time END), '%H:%i') as jam_out,
                DATE_FORMAT(MAX(CASE WHEN direction = 'IN' THEN clocking_time END), '%H:%i') as jam_in,
                MAX(node_id) as node_id
            FROM vw_filter_test
            WHERE DATE(clocking_time) BETWEEN :start_date AND :end_date
              AND action_flag = 'Break'
            GROUP BY emp_id, DATE(clocking_time)
        ),
        MakanData AS (
            SELECT 
                CONVERT(EMPLOYEE_ID USING utf8mb4) COLLATE utf8mb4_general_ci as emp_id, 
                TANGGAL_MAKAN as tanggal_makan, 
                DATE_FORMAT(MIN(JAM_MAKAN), '%H:%i') as jam_makan
            FROM `db-webapps`.`KANTIN_KARYAWAN_MAKAN_TBL`
            WHERE TANGGAL_MAKAN BETWEEN :start_date AND :end_date
            GROUP BY EMPLOYEE_ID, TANGGAL_MAKAN
        )
        SELECT 
            k.emp_id, 
            k.display_name, 
            k.card_number,
            c.clock_date as tanggal_out, 
            c.jam_out,
            m.tanggal_makan, 
            m.jam_makan,
            c.clock_date as tanggal_in, 
            c.jam_in,
            c.node_id
        FROM Karyawan k
        LEFT JOIN ClockData c ON k.emp_id = c.emp_id
        LEFT JOIN MakanData m ON k.emp_id = m.emp_id AND c.clock_date = m.tanggal_makan
        WHERE (c.jam_out IS NOT NULL OR m.jam_makan IS NOT NULL OR c.jam_in IS NOT NULL)
        {filter_clause}
    """
    
    rows = db.session.execute(text(sql_query), params).mappings().fetchall()
    
    report_data = []
    
    def get_access_area(node_id):
        if not node_id: return "-"
        node_str = str(node_id)
        if node_str in ('161', '162'): return 'Access Dekat Loker 94'
        if node_str in ('166', '167'): return 'Access Dekat Loker Garuda'
        if node_str in ('191', '192'): return 'Access Gerbang Biru'
        if node_str in ('188', '189'): return 'Access 86'
        if node_str in ('175', '173'): return 'Access Gerbang 92'
        if node_str in ('114', '115', '215', '216'): return 'Access Bike'
        return f"Node {node_str}"

    for row in rows:
        jam_out_str = row['jam_out'] # String (misal: '11:19')
        jam_makan_str = row['jam_makan']
        jam_in_str = row['jam_in']
        
        # Tanggal tetap dikelola sebagai objek date oleh SQLAlchemy, jadi bisa menggunakan strftime
        tgl_out_str = row['tanggal_out'].strftime('%d-%b-%Y').upper() if row['tanggal_out'] else ""
        tgl_mak_str = row['tanggal_makan'].strftime('%d-%b-%Y').upper() if row['tanggal_makan'] else ""
        tgl_in_str = row['tanggal_in'].strftime('%d-%b-%Y').upper() if row['tanggal_in'] else ""
        
        total_mins = 0
        status = "Normal Break"
        
        if not jam_in_str:
            status = "No Clocking IN"
        else:
            # String bisa dibandingkan secara langsung ('11:19' < '11:20' bernilai True)
            start_break_str = None
            if jam_out_str and jam_makan_str:
                start_break_str = min(jam_out_str, jam_makan_str)
            elif jam_out_str:
                start_break_str = jam_out_str
            elif jam_makan_str:
                start_break_str = jam_makan_str
                
            if start_break_str:
                # Kalkulasi total waktu dalam menit dengan mengonversi string jam ke objek datetime
                fmt = '%H:%M'
                dt_in = datetime.strptime(jam_in_str, fmt)
                dt_start = datetime.strptime(start_break_str, fmt)
                
                delta = dt_in - dt_start
                total_mins = int(delta.total_seconds() // 60)
                
                if total_mins < 0: total_mins = 0
                
                if total_mins > 60:
                    status = ">60"
            else:
                status = "No Clocking OUT"
                
        report_data.append({
            "emp_id": row['emp_id'],
            "display_name": row['display_name'] or '-',
            "card_number": row['card_number'] or '-',
            "tanggal_out": tgl_out_str,
            "jam_out": jam_out_str or "",
            "tanggal_makan": tgl_mak_str,
            "jam_makan": jam_makan_str or "",
            "tanggal_in": tgl_in_str,
            "jam_in": jam_in_str or "",
            "access_area": get_access_area(row['node_id']),
            "total": total_mins,
            "status": status
        })

    return report_data

# =============================================================================
# ENDPOINT
# =============================================================================
@AbsenBreak_bp.route('/reportBreak')
def reportBreak():
    try:
        # Frontend mengirim parameter ini via params URLSearchParams
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()
        sub_company_id = request.args.get('sub_company_id', '').strip()
        department_id = request.args.get('department_id', '').strip() 
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('pageSize', 10))

        report_data = _get_break_data(start_date, end_date, sub_company_id, department_id)

        # Pagination manual di backend
        total_item = len(report_data)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        
        paginated_data = report_data[start_idx:end_idx]

        return jsonify({
            "status": "success",
            "data": paginated_data,
            "total_item": total_item,
            "current_page": page,
            "total_page": (total_item + page_size - 1) // page_size if total_item > 0 else 1
        }), 200

    except ValueError as ve:
        return jsonify({"status": "error", "message": str(ve)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@AbsenBreak_bp.route('/exportBreak')
def exportBreak():
    try:
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()
        sub_company_id = request.args.get('sub_company_id', '').strip()
        department_id = request.args.get('department_id', '').strip()
        
        report_data = _get_break_data(start_date, end_date, sub_company_id, department_id)

        if not report_data:
            return jsonify({"status": "error", "message": "Data absensi istirahat tidak ditemukan untuk periode/departemen ini"}), 400

        # Mapping ulang untuk nama header di file excel
        excel_rows = []
        for row in report_data:
            excel_rows.append({
                'Employee Id': row['emp_id'],
                'Display Name': row['display_name'],
                'Absence Card No': row['card_number'],
                'Tanggal OUT': row['tanggal_out'],
                'Jam OUT': row['jam_out'],
                'Tanggal Makan': row['tanggal_makan'],
                'Jam Makan': row['jam_makan'],
                'Tanggal IN': row['tanggal_in'],
                'Jam IN': row['jam_in'],
                'Access Area': row['access_area'],
                'Total': row['total'],
                'Status': row['status']
            })

        df = pd.DataFrame(excel_rows)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Employee_Break_Report')
        output.seek(0)

        filename = f"Employee_Break_Report_{start_date}_to_{end_date}.xlsx"
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )

    except ValueError as ve:
        return jsonify({"status": "error", "message": str(ve)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500