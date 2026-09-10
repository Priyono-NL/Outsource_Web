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

        # 4. Cek super admin
        is_super_admin = user_result['local_role'] == 'super_admin'
        if is_super_admin:
            menu_query = text("""
                SELECT 
                    id, title AS label, path, icon, parent_id, group_no AS 'group',
                    1 AS can_view, 1 AS can_create, 1 AS can_edit, 1 AS can_delete
                FROM hr_app_menus
                ORDER BY group_no ASC, order_no ASC
            """)
            menu_rows = db.session.execute(menu_query).mappings().fetchall()
        else:
            menu_query = text("""
                SELECT 
                    m.id, m.title AS label, m.path, m.icon, m.parent_id, m.group_no AS 'group',
                    rm.can_view, rm.can_create, rm.can_edit, rm.can_delete
                FROM hr_role_menu_permissions rm
                JOIN hr_app_menus m ON rm.menu_id = m.id
                WHERE rm.role_id = :role_id AND rm.can_view = 1
                ORDER BY m.group_no ASC, m.order_no ASC
            """)
            menu_rows = db.session.execute(menu_query, {'role_id': user_result['local_role_id']}).mappings().fetchall()

        # 5. Konversi ke bentuk hirarki/bersarang (Parent -> Children)
        menus_dict = {}
        nested_menus = []
        crud_permissions = {}

        for row in menu_rows:
            menu_item = dict(row)            
            if menu_item['path']:
                crud_permissions[menu_item['path']] = {
                    'can_create': bool(menu_item['can_create']),
                    'can_edit': bool(menu_item['can_edit']),
                    'can_delete': bool(menu_item['can_delete'])
                }
            if not menu_item['path']: 
                menu_item['children'] = []            
            menus_dict[menu_item['id']] = menu_item

        # Susun relasi Folder dan Sub-menu
        for menu_id, menu_item in menus_dict.items():
            parent_id = menu_item.get('parent_id')
            if parent_id and parent_id in menus_dict:
                menus_dict[parent_id]['children'].append(menu_item)
            else:
                nested_menus.append(menu_item)

        # 6. Return data ke React
        return jsonify({
            'success': True,
            'is_configured': True,
            'user': {
                'id': user_result['id'],
                'name': user_result['nama'],
                'role_app': user_result['local_role'],
                'allowed_subcompanies': allowed_subcompanies,
                'menus': nested_menus,
                'permissions': crud_permissions 
            }
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500