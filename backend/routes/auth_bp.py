from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError
from extensions import db
from model.hr_models import User, Role, AppMenu, RoleMenuPermission, UserSubcompanyAccess

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/auth/sso-sync', methods=['POST'])
def sso_sync():
    data = request.json or {}
    raw_sso_id = data.get('sso_user_id')
    raw_email = data.get('email')

    sso_user_id = str(raw_sso_id).strip() if raw_sso_id else (str(raw_email).strip() if raw_email else None)
    email = str(raw_email).strip() if raw_email else None
    nama = data.get('nama', '').strip()
    department = data.get('department')
    role_sso = data.get('role_sso', '').strip()

    if not sso_user_id:
        return jsonify({'success': False, 'message': 'ID Pengguna / SSO User ID wajib ada'}), 400

    try:
        matched_role = None
        if role_sso:
            matched_role = Role.query.filter(Role.role_name.ilike(role_sso)).first()

        # 1. Cari User di Database
        user = User.query.filter((User.sso_user_id == sso_user_id) | (User.email == email)).first()

        if not user:
            try:
                # Coba Insert User Baru
                user = User(
                    sso_user_id=sso_user_id,
                    email=email,
                    nama=nama,
                    department=department,
                    role_sso=role_sso,
                    local_role_id=matched_role.id if matched_role else None,
                    status='active' if matched_role else 'pending'
                )
                db.session.add(user)
                db.session.commit()
            except IntegrityError:
                # JIKA BENTROK (Race Condition request ganda), ROLLBACK DAN AMBIL DATA TERAKHIR
                db.session.rollback()
                user = User.query.filter((User.sso_user_id == sso_user_id) | (User.email == email)).first()
                if user:
                    user.nama = nama
                    user.department = department
                    user.role_sso = role_sso
                    if matched_role and not user.local_role_id:
                        user.local_role_id = matched_role.id
                        user.status = 'active'
                    db.session.commit()
        else:
            # Update User Eksisting
            user.nama = nama
            user.department = department
            user.role_sso = role_sso
            if matched_role and not user.local_role_id:
                user.local_role_id = matched_role.id
                user.status = 'active'
            db.session.commit()

        # 2. Cek Status Pending
        if not user.local_role_id or user.status == 'pending':
            return jsonify({
                'success': True,
                'is_configured': False,
                'user': {
                    'id': user.id,
                    'nama': user.nama,
                    'email': user.email,
                    'sso_user_id': user.sso_user_id,
                    'status': 'pending'
                },
                'message': 'User terdaftar namun menunggu persetujuan role'
            })

        # 3. Ambil Master Menu & Hak Akses
        role_obj = Role.query.get(user.local_role_id)
        role_name = role_obj.role_name if role_obj else 'user'
        is_superadmin = (role_name.lower() == 'superadmin')

        crud_permissions = {}
        menu_items_raw = []

        if is_superadmin:
            all_menus = AppMenu.query.order_by(AppMenu.group_no.asc(), AppMenu.order_no.asc()).all()
            for m in all_menus:
                menu_items_raw.append({
                    'id': m.id, 'title': m.title, 'path': m.path, 'icon': m.icon, 'parent_id': m.parent_id,
                    'can_create': True, 'can_edit': True, 'can_delete': True
                })
                if m.path:
                    crud_permissions[m.path] = {'can_create': True, 'can_edit': True, 'can_delete': True}
        else:
            perms = RoleMenuPermission.query.filter_by(role_id=user.local_role_id, can_view=True).all()
            perm_dict = {p.menu_id: p for p in perms}

            if perm_dict:
                allowed_menus = AppMenu.query.filter(AppMenu.id.in_(list(perm_dict.keys()))).order_by(AppMenu.group_no.asc(), AppMenu.order_no.asc()).all()
                for m in allowed_menus:
                    p = perm_dict.get(m.id)
                    can_c = p.can_create if p else False
                    can_e = p.can_edit if p else False
                    can_d = p.can_delete if p else False

                    menu_items_raw.append({
                        'id': m.id, 'title': m.title, 'path': m.path, 'icon': m.icon, 'parent_id': m.parent_id,
                        'can_create': can_c, 'can_edit': can_e, 'can_delete': can_d
                    })
                    if m.path:
                        crud_permissions[m.path] = {'can_create': can_c, 'can_edit': can_e, 'can_delete': can_d}

        # Susun Hirarki Tree Menu
        menus_dict = {m['id']: {**m, 'children': []} for m in menu_items_raw}
        nested_menus = []
        for m_id, m_item in menus_dict.items():
            parent_id = m_item.get('parent_id')
            if parent_id and parent_id in menus_dict:
                menus_dict[parent_id]['children'].append(m_item)
            else:
                nested_menus.append(m_item)

        subco_access = UserSubcompanyAccess.query.filter_by(user_id=user.id).all()

        return jsonify({
            'success': True,
            'is_configured': True,
            'user': {
                'id': user.id,
                'nama': user.nama,
                'email': user.email,
                'role_app': role_name,
                'allowed_subcompanies': [s.sub_company_id for s in subco_access],
                'menus': nested_menus,
                'permissions': crud_permissions
            }
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500