from flask import Blueprint, request, session, jsonify
from functools import wraps

auth_bp = Blueprint('auth_bp', __name__)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)
        if not session.get('isAuthenticated'):
            return jsonify({"isAuthenticated": False, "message": "Sesi habis"}), 401
        
        return f(*args, **kwargs)
    return decorated_function


@auth_bp.route('/api/sync-session', methods=['POST'])
def sync_session():
    data = request.json
    if data.get('isAuthenticated'):
        session['isAuthenticated'] = True
        session['user'] = data.get('user')
        return jsonify({"status": "synced"}), 200
    return jsonify({"status": "failed"}), 401

@auth_bp.route('/api/logout', methods=['GET'])
def logout():
    session.clear()
    return jsonify({"message": "Logged out from Flask"}), 200