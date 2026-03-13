from flask import Blueprint, request, jsonify
from extensions import db
from model.person import OsPerson
from model.blacklist import OsBlacklist
from .auth_bp import login_required

person_bp = Blueprint('person_bp', __name__)

@person_bp.route('/person/search')
def search_person():
    query_str = request.args.get('q', '')
    if len(query_str) < 3:
        return jsonify({"status": "success", "data": []})
    persons = OsPerson.query.outerjoin(OsBlacklist, OsPerson.person_id == OsBlacklist.person_id).filter(
            OsPerson.name.ilike(f"%{query_str}%")).limit(10).all() 
    data_result = []
    for p in persons:
        blist = p.OsBlist[0] if (p.OsBlist and len(p.OsBlist) > 0) else None
        data_result.append({
            "person_id": p.person_id, 
            "name": p.name,
            "gender": p.gender,
            "religion": p.religion,
            "pob": p.pob,
            "dob": str(p.dob),
            "resident_id": p.resident_id,
            "address": p.address,

            "is_blacklist": "Blacklist" if (blist and blist.status == 1) else "No in Blacklist",
        })

    return jsonify({
        "status": "success",
        "data": data_result
    })

@person_bp.before_request
@login_required
def before_request():
    pass