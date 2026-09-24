from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from extensions import db
from model.hr_models import User, Role, UserSubcompanyAccess, UserCostCenterAccess
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