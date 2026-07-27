from flask import Blueprint, request, jsonify
from extensions import db
from model.terminal import terminal
from .auth_bp import login_required
from sqlalchemy import or_
import pandas as pd
from sqlalchemy import text

SHEET_MIRROR_CSV_URL = "https://docs.google.com/spreadsheets/d/1Fcf6yzxMp5hNm1-YhzO0rwNfk2cL1tmevnJcFM3JDhg/export?format=csv&gid=0"

terminal_bp = Blueprint('terminal_bp', __name__)

@terminal_bp.route('/terminal')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        query = terminal.query.filter(terminal.company_id.ilike(1111))
        if search:                    
            query = query.filter(
                or_(
                    terminal.terminal_id.cast(db.String).ilike(f"%{search}%"),
                    terminal.terminal_name.ilike(f"%{search}%")
                )
            )
        pagination = query.paginate(page=page, per_page=pageSize, error_out=False)
        return jsonify({
            "status": "success",
            "data": [train.to_dict() for train in pagination.items],
            "total_page": pagination.pages,
            "current_page": pagination.page,
            "total_item": pagination.total
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@terminal_bp.route('/terminal/sync-sheet', methods=['POST'])
def sync_sheet():
    try:
        # 1. Baca CSV dari Google Sheet Mirror
        # skiprows=2 artinya melewati Baris 1 (Judul) & Baris 2 (Kosong)
        # Baris 3 otomatis menjadi Header Column (node, name, kategori, jenis, server)
        df = pd.read_csv(SHEET_MIRROR_CSV_URL, skiprows=2, dtype=str)
        
        # 2. Rapikan Nama Header (Node -> node, Name -> name, dst.)
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
        
        # 3. Filter baris jika kolom 'node' kosong
        df = df.dropna(subset=['node'])

        SERVER_CODE_MAP = {
            'ceres': 'CRS',
            'finger': 'FIN',
            'garuda': 'GRD'
        }
        
        success_count = 0
        
        # 4. Melakukan UPSERT ke MySQL
        for index, row in df.iterrows():
            # Mengubah NaN pandas menjadi None agar MySQL membacanya sebagai NULL
            raw_node = str(row['node']).strip() if pd.notna(row['node']) else ''
            node_val = raw_node.zfill(3) if raw_node.isdigit() else raw_node
            name_val = str(row['name']) if pd.notna(row['name']) else None
            kategori_val = str(row['kategori']) if pd.notna(row['kategori']) else None
            jenis_val = str(row['jenis']) if pd.notna(row['jenis']) else None
            server_val = str(row['server']) if pd.notna(row['server']) else None

            server_key = server_val.lower()
            server_prefix = SERVER_CODE_MAP.get(server_key, server_val[:3].upper() if server_val else 'UNK')
            terminal_id_val = f"{server_prefix}{node_val}"

            if not node_val:
                continue

            # Query SQL Raw UPSERT untuk MySQL
            sql_query = text("""
                INSERT INTO tbl_terminal (terminal_id, node_id, terminal_name, terminal_type, direction, server_loc, company_id)
                VALUES (:terminal_id, :node, :name, :kategori, :jenis, :server, 1111)
                ON DUPLICATE KEY UPDATE
                    terminal_id = VALUES(terminal_id),
                    node_id = VALUES(node_id),
                    terminal_name = VALUES(terminal_name),
                    terminal_type = VALUES(terminal_type),
                    direction = VALUES(direction),
                    server_loc = VALUES(server_loc);
            """)

            db.session.execute(sql_query, {
                "terminal_id": terminal_id_val,
                "node": node_val,
                "name": name_val,
                "kategori": kategori_val,
                "jenis": jenis_val,
                "server": server_val
            })
            success_count += 1

        db.session.commit()

        return jsonify({
            "status": "success",
            "message": f"Berhasil sinkronisasi {success_count} data dari Google Sheet ke Database!"
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": f"Gagal Sinkronisasi Data: {str(e)}"
        }), 500 

# @terminal_bp.before_request
# @login_required
# def before_request():
#     pass