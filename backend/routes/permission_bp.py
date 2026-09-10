# backend/routes/permission_bp.py
from flask import Blueprint, request, jsonify
from extensions import db
from model.hr_models import Role, AppMenu, RoleMenuPermission

permission_bp = Blueprint('permission', __name__)

@permission_bp.route('/roles', methods=['GET', 'POST'])
def handle_roles():
    # ---------------------------------------------------------
    # 1. METHOD POST: TAMBAH ROLE BARU ATAU SIMPAN PERMISSIONS
    # ---------------------------------------------------------
    if request.method == 'POST':
        data = request.json or {}
        action = data.get('action')

        # A. Tambah Role Baru
        if action == 'create_role':
            role_name = data.get('role_name', '').strip()
            if not role_name:
                return jsonify({'success': False, 'message': 'Nama role wajib diisi'}), 400
            
            try:
                new_role = Role(role_name=role_name)
                db.session.add(new_role)
                db.session.commit()
                
                return jsonify({
                    'success': True, 
                    'data': {'id': new_role.id, 'role_name': new_role.role_name}
                })
            except Exception as e:
                db.session.rollback()
                return jsonify({'success': False, 'message': str(e)}), 500

        # B. Simpan Matriks Hak Akses Menu (CRUD) per Role
        elif action == 'save_permissions':
            role_id = data.get('role_id')
            permissions = data.get('permissions', {})

            if not role_id:
                return jsonify({'success': False, 'message': 'Role ID wajib dikirim'}), 400

            try:
                RoleMenuPermission.query.filter_by(role_id=role_id).delete()
                
                for menu_id, perm in permissions.items():
                    if perm.get('can_view'):
                        new_perm = RoleMenuPermission(
                            role_id=role_id,
                            menu_id=menu_id,
                            can_view=True,
                            can_create=bool(perm.get('can_create')),
                            can_edit=bool(perm.get('can_edit')),
                            can_delete=bool(perm.get('can_delete'))
                        )
                        db.session.add(new_perm)

                db.session.commit()
                return jsonify({'success': True, 'message': 'Hak akses role berhasil disimpan'})
            except Exception as e:
                db.session.rollback()
                return jsonify({'success': False, 'message': str(e)}), 500

    # ---------------------------------------------------------
    # 2. METHOD GET: AMBIL MASTER ROLES/MENUS ATAU DETAIL ROLE
    # ---------------------------------------------------------
    role_id = request.args.get('role_id')

    if role_id:
        try:
            perms = RoleMenuPermission.query.filter_by(role_id=role_id).all()
            return jsonify({
                'success': True,
                'data': {
                    'permissions': [{
                        'menu_id': p.menu_id,
                        'can_view': p.can_view,
                        'can_create': p.can_create,
                        'can_edit': p.can_edit,
                        'can_delete': p.can_delete
                    } for p in perms]
                }
            })
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500

    try:
        roles = Role.query.order_by(Role.id.asc()).all()
        menus = AppMenu.query.order_by(AppMenu.group_no.asc(), AppMenu.order_no.asc()).all()

        return jsonify({
            'success': True,
            'data': {
                'roles': [{'id': r.id, 'role_name': r.role_name} for r in roles],
                'menus': [{
                    'id': m.id, 
                    'title': m.title, 
                    'path': m.path, 
                    'icon': m.icon, 
                    'parent_id': m.parent_id
                } for m in menus]
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500