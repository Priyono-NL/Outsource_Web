from flask import Blueprint, request, jsonify
from extensions import db
from model.hr_models import User, Role, UserSubcompanyAccess
from model.subCompany import SubCompany

userApproval_bp = Blueprint('user_approval', __name__)

@userApproval_bp.route('/users/pending', methods=['GET'])
def get_pending_users():
    try:
        pending_users = User.query.filter(User.local_role_id.is_(None)).all()
        roles = Role.query.order_by(Role.role_name.asc()).all()
        subcompanies = SubCompany.query.all()

        return jsonify({
            'success': True,
            'data': {
                'users': [{'id': u.id, 'nama': u.nama, 'email': u.email, 'department': u.department} for u in pending_users],
                'roles': [{'id': r.id, 'role_name': r.role_name} for r in roles],
                'subcompanies': [{'sub_company_id': s.sub_company_id, 'sub_company_name': s.sub_company_name} for s in subcompanies]
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@userApproval_bp.route('/users/approve', methods=['POST'])
def approve_user():
    data = request.json or {}
    user_id = data.get('user_id')
    role_id = data.get('role_id')
    subcompanies = data.get('subcompanies', [])

    if not user_id or not role_id:
        return jsonify({'success': False, 'message': 'User dan Role wajib dipilih'}), 400

    try:
        user = User.query.get(user_id)
        if user:
            user.local_role_id = role_id

        UserSubcompanyAccess.query.filter_by(user_id=user_id).delete()
        
        for subco_id in subcompanies:
            new_access = UserSubcompanyAccess(user_id=user_id, sub_company_id=subco_id)
            db.session.add(new_access)

        db.session.commit()
        return jsonify({'success': True, 'message': 'User berhasil disetujui!'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500