from flask import Blueprint, request, session, jsonify
import requests
from functools import wraps

auth_bp = Blueprint('auth_bp', __name__)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 1. Cek apakah status login ada di session Flask
        if not session.get('isAuthenticated'):
            # 2. Kirim 401 agar Interceptor di React langsung "bangun"
            return jsonify({"message": "Sesi habis, silakan login ulang"}), 401
        return f(*args, **kwargs)
    return decorated_function

@auth_bp.route('/api/validate-token-storage', methods=['POST'])
def validate_token_storage():
    data = request.json
    token = data.get('token')
    
    if token:
        token = token.strip('"')

    if not token:
        return jsonify({"isAuthenticated": False}), 400

    try:
        # SSO meminta token dalam JSON Body
        sso_url = "https://sso.ceresnl.com:50443/api/validate-token"
        response = requests.post(
            sso_url, 
            json={"token": token}, 
            timeout=10, 
            verify=False
        )
        
        if response.status_code == 200:
            user_data = response.json()
            session.permanent = True
            session['user'] = user_data
            session['isAuthenticated'] = True
            return jsonify({"isAuthenticated": True, "user": user_data}), 200
        
        return jsonify({"isAuthenticated": False}), 401
    except Exception as e:
        return jsonify({"message": str(e)}), 500
    
@auth_bp.route('/api/check-session', methods=['GET'])
def check_session():
    if session.get('isAuthenticated'):
        return jsonify({
            "isAuthenticated": True, 
            "user": session.get('user')
        }), 200
    return jsonify({"isAuthenticated": False}), 401

@auth_bp.route('/api/logout', methods=['GET'])
def logout():
    session.clear() 
    return jsonify({"message": "Logged out from local session"}), 200