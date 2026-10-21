from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from extensions import db
from model.hr_models import User, Role, AppMenu, RoleMenuPermission, UserSubcompanyAccess, UserCostCenterAccess
from model.subCompany import SubCompany
from model.costCenter import costCenter

userManagement_bp = Blueprint('user_management', __name__)

# =============================================================================
# ZERO-ZOMBIE CONNECTION POLICY (TEARDOWN HOOK)
# =============================================================================
@userManagement_bp.teardown_request
def teardown_request(exception=None):
    try:
        db.session.remove()
    except Exception:
        pass

# =============================================================================
# 1. GET LIST USER MANAGEMENT (WITH SEARCH & PAGINATION)
# =============================================================================
@userManagement_bp.route('/api/users/management', methods=['GET'])
def get_user_management():
    try:
        search = request.args.get('search', '', type=str).strip()
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 20, type=int)

        query = User.query

        if search:
            query = query.filter(
                or_(
                    User.nama.ilike(f"%{search}%"),
                    User.email.ilike(f"%{search}%"),
                    User.department.ilike(f"%{search}%")
                )
            )

        query = query.order_by(User.nama.asc())

        pagination = query.paginate(page=page, per_page=pageSize, error_out=False)
        users = pagination.items

        roles = Role.query.order_by(Role.role_name.asc()).all()
        subcompanies = SubCompany.query.all()
        cost_centers = costCenter.query.order_by(costCenter.org_name.asc()).all()
        role_map = {r.id: r.role_name for r in roles}

        user_ids = [u.id for u in users]
        
        user_subco_map = {}
        if user_ids:
            subco_access = UserSubcompanyAccess.query.filter(UserSubcompanyAccess.user_id.in_(user_ids)).all()
            for acc in subco_access:
                if acc.user_id not in user_subco_map:
                    user_subco_map[acc.user_id] = []
                user_subco_map[acc.user_id].append(acc.sub_company_id)

        user_cc_map = {}
        if user_ids:
            cc_access = UserCostCenterAccess.query.filter(UserCostCenterAccess.user_id.in_(user_ids)).all()
            for acc in cc_access:
                if acc.user_id not in user_cc_map:
                    user_cc_map[acc.user_id] = []
                user_cc_map[acc.user_id].append(acc.cost_center_id)

        users_data = []
        for u in users:
            users_data.append({
                'id': u.id,
                'nama': u.nama,
                'email': u.email,
                'department': u.department,
                'local_role_id': u.local_role_id,
                'role_name': role_map.get(u.local_role_id, 'Belum di-mapping'),
                'subcompany_access': user_subco_map.get(u.id, []),
                'costcenter_access': user_cc_map.get(u.id, [])
            })

        return jsonify({
            'success': True,
            'data': {
                'users': users_data,
                'roles': [{'id': r.id, 'role_name': r.role_name} for r in roles],
                'subcompanies': [{'sub_company_id': s.sub_company_id, 'sub_company_name': s.sub_company_name} for s in subcompanies],
                'cost_centers': [{'id': c.id, 'cost_center': c.cost_center, 'org_name': c.org_name} for c in cost_centers],
                'pagination': {
                    'total_item': pagination.total,
                    'total_page': pagination.pages,
                    'current_page': page,
                    'page_size': pageSize
                }
            }
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        db.session.close()

# =============================================================================
# 2. UPDATE USER ROLE & HAK AKSES
# =============================================================================
@userManagement_bp.route('/api/users/update-access', methods=['POST'])
def update_user_access():
    data = request.json or {}
    user_id = data.get('user_id')
    role_id = data.get('role_id')
    subcompanies = data.get('subcompanies', [])
    cost_centers = data.get('cost_centers', [])

    if not user_id or not role_id:
        return jsonify({'success': False, 'message': 'User dan Role wajib dipilih'}), 400

    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': 'User tidak ditemukan'}), 404

        user.local_role_id = role_id
        
        UserSubcompanyAccess.query.filter_by(user_id=user_id).delete()
        UserCostCenterAccess.query.filter_by(user_id=user_id).delete()

        for subco_id in subcompanies:
            db.session.add(UserSubcompanyAccess(user_id=user_id, sub_company_id=subco_id))

        for cc_id in cost_centers:
            db.session.add(UserCostCenterAccess(user_id=user_id, cost_center_id=cc_id))

        db.session.commit()
        return jsonify({'success': True, 'message': 'Akses user berhasil diperbarui!'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        db.session.close()

# =============================================================================
# 3. DELETE USER & CASCADE CLEANUP HAK AKSES (ROUTE BARU)
# =============================================================================
@userManagement_bp.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': 'User tidak ditemukan'}), 404

        user_identifier = user.email or user.nama or f"ID {user_id}"

        # 1. Hapus Relasi Akses Terlebih Dahulu (Manual Cascade Cleanup)
        UserSubcompanyAccess.query.filter_by(user_id=user_id).delete()
        UserCostCenterAccess.query.filter_by(user_id=user_id).delete()

        # 2. Hapus Record User Utama
        db.session.delete(user)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': f'User {user_identifier} berhasil dihapus dari sistem.'
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Gagal menghapus user: {str(e)}'
        }), 500
    finally:
        db.session.close()

# =============================================================================
# 4. IMPERSONATE USER (LOGIN SEBAGAI USER LAIN)
# =============================================================================
@userManagement_bp.route('/api/users/impersonate', methods=['POST'])
def impersonate_user():
    try:
        # [SECURITY WARNING] 
        # Pastikan Anda mengamankan endpoint ini khusus untuk Superadmin
        
        data = request.json or {}
        target_email = data.get('email')

        if not target_email:
            return jsonify({'success': False, 'message': 'Email target wajib dikirim.'}), 400

        # 1. Cari data user target
        target_user = User.query.filter_by(email=target_email).first()
        if not target_user:
            return jsonify({'success': False, 'message': f'User dengan email {target_email} tidak ditemukan.'}), 404

        user_id = target_user.id

        # 2. Tarik hak akses Sub Company milik user target
        subco_access = UserSubcompanyAccess.query.filter_by(user_id=user_id).all()
        allowed_subcos = [acc.sub_company_id for acc in subco_access]

        # 3. Tarik hak akses Cost Center milik user target
        cc_access = UserCostCenterAccess.query.filter_by(user_id=user_id).all()
        allowed_ccs = [acc.cost_center_id for acc in cc_access]

        # =====================================================================
        # [FIX] 4. REPLIKASI LOGIKA MENU & PERMISSIONS SESUAI ROLE TARGET
        # =====================================================================
        role_obj = Role.query.get(target_user.local_role_id)
        role_name = role_obj.role_name if role_obj else 'user'
        is_superadmin = (role_name.lower() == 'superadmin')
        
        crud_permissions = {}
        menu_items_raw = []
        
        if is_superadmin:
            all_menus = AppMenu.query.order_by(AppMenu.group_no.asc(), AppMenu.order_no.asc()).all()
            for m in all_menus:
                menu_items_raw.append({
                    'id': m.id, 'title': m.title, 'path': m.path, 'icon': m.icon, 'parent_id': m.parent_id,
                    'group_no': m.group_no, 'order_no': m.order_no,
                    'can_create': True, 'can_edit': True, 'can_delete': True
                })
                if m.path:
                    crud_permissions[m.path] = {'can_create': True, 'can_edit': True, 'can_delete': True}
        else:
            perms = RoleMenuPermission.query.filter_by(role_id=target_user.local_role_id, can_view=True).all()
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
                        'group_no': m.group_no, 'order_no': m.order_no,
                        'can_create': can_c, 'can_edit': can_e, 'can_delete': can_d
                    })
                    if m.path:
                        crud_permissions[m.path] = {'can_create': can_c, 'can_edit': can_e, 'can_delete': can_d}
                        
        menus_dict = {m['id']: {**m, 'children': []} for m in menu_items_raw}
        nested_menus = []
        for m_id, m_item in menus_dict.items():
            parent_id = m_item.get('parent_id')
            if parent_id and parent_id in menus_dict:
                menus_dict[parent_id]['children'].append(m_item)
            else:
                nested_menus.append(m_item)

        # =====================================================================
        # 5. BENTUK PAYLOAD SESI TIRUAN (LENGKAP)
        # =====================================================================
        session_payload = {
            "success": True,
            "user": {
                "id": user_id,
                "email": target_user.email,
                "nama": target_user.nama,
                "department": target_user.department,
                "local_role_id": target_user.local_role_id,
                "role_app": role_name,
                "allowed_subcompanies": allowed_subcos,
                "allowed_costcenters": allowed_ccs,
                "menus": nested_menus,            # <--- INI KUNCI AGAR SIDEBAR MUNCUL
                "permissions": crud_permissions   # <--- INI KUNCI AGAR TOMBOL CRUD MUNCUL
            }
        }

        return jsonify({
            'success': True,
            'status': 'success',
            'message': f'Berhasil meng-impersonate akun {target_email}',
            'data': {
                'session_payload': session_payload
            }
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'status': 'error',
            'message': f'Gagal melakukan impersonate: {str(e)}'
        }), 500
    finally:
        db.session.close()