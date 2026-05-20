import requests as http
from flask import Blueprint, request, session, jsonify, redirect, current_app
from functools import wraps

auth_bp = Blueprint('auth_bp', __name__)

def _cfg(key):
    """Ambil config dari Flask app config"""
    return current_app.config.get(key, '')

# HELPER
def _verify_sso_token(access_token: str):
    try:
        resp = http.post(
            f"{_cfg('SSO_URL')}/api/verify",
            json={'access_token': access_token},
            headers={
                'X-App-ID':     _cfg('SSO_APP_ID'),
                'X-App-Secret': _cfg('SSO_APP_SECRET'),
            },
            timeout=5
        )
        data = resp.json()
        if resp.ok and data.get('valid'):
            return data['user']
    except Exception as e:
        print(f'[SSO] verify error: {e}')
    return None

# DECORATOR
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)

        access_token = session.get('access_token')
        if not access_token:
            return jsonify({
                'isAuthenticated': False,
                'code': 'NOT_LOGGED_IN',
                'message': 'Silakan login terlebih dahulu'
            }), 401

        user = _verify_sso_token(access_token)

        if not user:
            session.clear()
            return jsonify({
                'isAuthenticated': False,
                'code': 'TOKEN_EXPIRED',
                'message': 'Sesi habis atau tidak valid, silakan login kembali'
            }), 401

        request.current_user = user
        return f(*args, **kwargs)
    return decorated

def role_required(*roles):
    def decorator(f):
        @wraps(f)
        @login_required
        def decorated(*args, **kwargs):
            # request.current_user diisi oleh decorator login_required
            role = request.current_user.get('role')
            if role not in roles:
                return jsonify({
                    'error': 'Akses ditolak',
                    'your_role': role,
                    'required': list(roles)
                }), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


# ROUTES
@auth_bp.route('/auth/sso-url', methods=['GET'])
def get_sso_url():
    url = f"{_cfg('SSO_URL')}/sso/login?app_id={_cfg('SSO_APP_ID')}"
    return jsonify({'url': url})

@auth_bp.route('/auth/callback', methods=['GET'])
def sso_callback():
    access_token = request.args.get('access_token')
    frontend_url = _cfg('FRONTEND_URL')

    if not access_token:
        return redirect(f'{frontend_url}/?error=login_failed')

    user = _verify_sso_token(access_token)
    if not user:
        return redirect(f'{frontend_url}/?error=invalid_token')

    session['access_token']    = access_token
    session['user']            = user
    session['isAuthenticated'] = True

    print(f"[SSO] Login Success: {user.get('username')}")
    return redirect(f'{frontend_url}/')

@auth_bp.route('/auth/me', methods=['GET'])
def auth_me():
    access_token = session.get('access_token')
    if not access_token:
        return jsonify({'logged_in': False}), 401

    user = _verify_sso_token(access_token)
    
    if not user:
        session.clear()
        return jsonify({'logged_in': False}), 401

    session['user'] = user
    return jsonify({'logged_in': True, 'user': user})

@auth_bp.route('/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})