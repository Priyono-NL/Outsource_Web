from flask import Blueprint, request, jsonify
from sqlalchemy import text
from extensions import db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/auth/sso-sync', methods=['POST'])
def sso_sync():
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({'success': False, 'message': 'Token missing'}), 401
    
    data = request.json
    sso_user_id = data.get('sso_user_id')
    email = data.get('email')
    nama = data.get('nama')
    department = data.get('department')
    role_sso = data.get('role_sso')

    try:
        # 1. UPSERT ke tabel hr_users
        upsert_query = text("""
            INSERT INTO hr_users (sso_user_id, email, nama, department, role_sso, status)
            VALUES (:sso_id, :email, :nama, :dept, :role_sso, 'pending')
            ON DUPLICATE KEY UPDATE 
                email = VALUES(email),
                nama = VALUES(nama),
                department = VALUES(department),
                role_sso = VALUES(role_sso);
        """)
        
        db.session.execute(upsert_query, {
            'sso_id': sso_user_id,
            'email': email,
            'nama': nama,
            'dept': department,
            'role_sso': role_sso
        })
        db.session.commit()

        # 2. Cek Role & Status di tabel hr_users & hr_roles
        check_query = text("""
            SELECT u.id, u.sso_user_id, u.nama, u.email, u.status, u.local_role_id, r.role_name AS local_role
            FROM hr_users u
            LEFT JOIN hr_roles r ON u.local_role_id = r.id
            WHERE u.sso_user_id = :sso_id
        """)
        
        user_result = db.session.execute(check_query, {'sso_id': sso_user_id}).mappings().fetchone()

        if not user_result or user_result['status'] == 'pending' or not user_result['local_role_id']:
            return jsonify({
                'success': True,
                'is_configured': False,
                'message': 'Akun Anda belum dikonfigurasi oleh Admin.'
            })

        # 3. Filter Data lewat hr_user_subcompany_access
        subco_query = text("SELECT sub_company_id FROM hr_user_subcompany_access WHERE user_id = :user_id")
        subco_result = db.session.execute(subco_query, {'user_id': user_result['id']}).mappings().fetchall()
        allowed_subcompanies = [row['sub_company_id'] for row in subco_result]

        return jsonify({
            'success': True,
            'is_configured': True,
            'user': {
                'id': user_result['id'],
                'sso_id': user_result['sso_user_id'],
                'name': user_result['nama'],
                'email': user_result['email'],
                'role_app': user_result['local_role'],
                'allowed_subcompanies': allowed_subcompanies
            }
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500