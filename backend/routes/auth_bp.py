from flask import Blueprint, request, session, jsonify
import requests

auth_bp = Blueprint('auth_bp', __name__)

@auth_bp.route('/api/validate-token-storage', methods=['POST'])
def validate_token_storage():
    data = request.json
    token = data.get('token')
    try:
        # Kirim token ke SSO untuk dicek apakah masih aktif
        sso_verify_url = f"https://sso.ceresnl.com:50443/api/validate-token?token={token}"
        response = requests.post(
            sso_verify_url, 
            json={"token": token}, 
            timeout=10,
            verify=False )        
        if response.status_code == 200:
            user_data = response.json()
            # Buat session di Flask agar tidak perlu cek token terus-menerus
            session['user'] = user_data
            session['isAuthenticated'] = True
            return jsonify({"isAuthenticated": True, "user": user_data}), 200        
        return jsonify({"isAuthenticated": False}), 401
    except Exception as e:
        return jsonify({"message": str(e)}), 500