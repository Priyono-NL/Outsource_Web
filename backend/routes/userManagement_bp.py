from flask import Blueprint, request, jsonify
from extensions import db
from model.hr_models import User, Role, UserSubcompanyAccess
from model.subCompany import SubCompany

userManagement_bp = Blueprint('user_management', __name__)

@userManagement_bp.route('/api/users/management', methods=['GET'])
def get_user_management():
    try:
        # 1. Ambil semua data pendukung
        users = User.query.order_by(User.nama.asc()).all()
        roles = Role.query.order_by(Role.role_name.asc()).all()
        subcompanies = SubCompany.query.all()

        # 2. Map role_name untuk memudahkan lookup
        role_map = {r.id: r.role_name for r in roles}

        # 3. Ambil seluruh data akses subcompany sekaligus (mencegah N+1 query problem)
        all_access = UserSubcompanyAccess.query.all()
        user_access_map = {}
        for acc in all_access:
            if acc.user_id not in user_access_map:
                user_access_map[acc.user_id] = []
            user_access_map[acc.user_id].append(acc.sub_company_id)

        # 4. Susun response JSON
        users_data = []
        for u in users:
            users_data.append({
                'id': u.id,
                'nama': u.nama,
                'email': u.email,
                'department': u.department,
                'local_role_id': u.local_role_id,
                'role_name': role_map.get(u.local_role_id, 'Belum di-mapping'),
                'subcompany_access': user_access_map.get(u.id, [])
            })

        return jsonify({
            'success': True,
            'data': {
                'users': users_data,
                'roles': [{'id': r.id, 'role_name': r.role_name} for r in roles],
                'subcompanies': [{'sub_company_id': s.sub_company_id, 'sub_company_name': s.sub_company_name} for s in subcompanies]
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@userManagement_bp.route('/api/users/update-access', methods=['POST'])
def update_user_access():
    data = request.json or {}
    user_id = data.get('user_id')
    role_id = data.get('role_id')
    subcompanies = data.get('subcompanies', [])

    if not user_id or not role_id:
        return jsonify({'success': False, 'message': 'User dan Role wajib dipilih'}), 400

    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': 'User tidak ditemukan'}), 404

        # 1. Update role lokal user
        user.local_role_id = role_id

        # 2. Reset / Hapus akses subcompany lama
        UserSubcompanyAccess.query.filter_by(user_id=user_id).delete()
        
        # 3. Insert akses subcompany baru (jika array kosong, berarti akses ke SEMUA)
        for subco_id in subcompanies:
            new_access = UserSubcompanyAccess(user_id=user_id, sub_company_id=subco_id)
            db.session.add(new_access)

        db.session.commit()
        return jsonify({'success': True, 'message': 'Akses user berhasil diperbarui!'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500