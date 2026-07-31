from flask import Blueprint, request, jsonify
from datetime import datetime
import pandas as pd
from extensions import db
from model.terminal import terminal
from .auth_bp import login_required
from sqlalchemy import or_

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
        df = pd.read_csv(SHEET_MIRROR_CSV_URL, dtype=str)
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
        df = df.dropna(subset=['node_id'])

        SERVER_CODE_MAP = {
            'ceres': 'CRS',
            'finger': 'FIN',
            'garuda': 'GRD'
        }
        
        success_count = 0
        now = datetime.now()
        
        for index, row in df.iterrows():
            # Formatting Value dari Sheet
            raw_node = str(row['node_id']).strip() if pd.notna(row['node_id']) else ''
            node_val = raw_node.zfill(3) if raw_node.isdigit() else raw_node
            name_val = str(row['name']).strip() if pd.notna(row['name']) else None
            direction_val = str(row['jenis']).strip() if pd.notna(row['jenis']) else None
            server_val = str(row['server']).strip() if pd.notna(row['server']) else None
            type_val = str(row['type']).strip() if pd.notna(row['type']) else None

            if not node_val:
                continue

            # Menentukan Prefix terminal_id
            server_key = server_val.lower() if server_val else ''
            server_prefix = SERVER_CODE_MAP.get(server_key, server_val[:3].upper() if server_val else 'UNK')
            terminal_id_val = f"{server_prefix}{node_val}"

            # --- CEK KE DATABASE (Cek terminal_id & company_id) ---
            existing_terminal = terminal.query.filter_by(
                terminal_id=terminal_id_val, 
                company_id=1111
            ).first()

            if existing_terminal:
                # 4a. UPDATE JIKA DATA SUDAH ADA
                existing_terminal.node_id = node_val
                existing_terminal.terminal_name = name_val
                existing_terminal.direction = direction_val
                existing_terminal.server_loc = server_val
                existing_terminal.terminal_type = type_val
                
                # Audit Trails
                if hasattr(existing_terminal, 'modified_date'):
                    existing_terminal.modified_date = now
                if hasattr(existing_terminal, 'modified_by'):
                    existing_terminal.modified_by = 'SYNC_SHEET'

            else:
                # 4b. INSERT JIKA DATA BELUM ADA
                new_terminal = terminal(
                    company_id=1111,
                    terminal_id=terminal_id_val,
                    node_id=node_val,
                    terminal_name=name_val,
                    direction=direction_val,
                    server_loc=server_val,
                    terminal_type=type_val,
                    created_date=now,
                    created_by='SYNC_SHEET'
                )
                db.session.add(new_terminal)

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