from flask import Blueprint, request, jsonify
from extensions import db
from model.person import OsPerson
from .auth_bp import login_required

person_bp = Blueprint('person_bp', __name__)

@person_bp.route('/person/search')
def search_person():
    query_str = request.args.get('q', '')
    if len(query_str) < 3:
        return jsonify({"status": "success", "data": []})
    persons = OsPerson.query.filter(OsPerson.name.ilike(f"%{query_str}%")).limit(10).all()
    return jsonify({
        "status": "success",
        "data": [{"person_id": p.person_id, "name": p.name} for p in persons]
    })

@person_bp.before_request
@login_required
def before_request():
    pass