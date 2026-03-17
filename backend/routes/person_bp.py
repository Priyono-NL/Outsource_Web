import os, uuid
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify

from extensions import db
from model.person import OsPerson
from model.blacklist import OsBlacklist
from .auth_bp import login_required

person_bp = Blueprint('person_bp', __name__)

UPLOAD_FOLDER = 'static/uploads/photos'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

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
            "photo": p.photo,
            "is_blacklist": "Blacklist" if (blist and blist.status == 1) else "No in Blacklist",
        })

    return jsonify({
        "status": "success",
        "data": data_result
    })

@person_bp.route('/person')
def index():
    try:
        page = request.args.get('page', 1, type=int)
        pageSize = request.args.get('pageSize', 10, type=int)
        search = request.args.get('search', '', type=str)
        query = OsPerson.query
        if search:                    
            query = query.filter(OsPerson.name.ilike(f"%{search}%"))
        pagination = query.paginate(page=page, per_page=pageSize, error_out=False)
        return jsonify({
            "status": "success",
            "data": [persons.to_dict() for persons in pagination.items],
            "total_page": pagination.pages,
            "current_page": pagination.page,
            "total_item": pagination.total
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@person_bp.route('/person/submit', methods=['POST'])
def add():
    try:
        data = request.json if request.is_json else request.form        
        
        new_person = OsPerson(
            name = data.get('nama'),
            gender = data.get('gender'),            
            pob = data.get('pob'),
            dob = data.get('dob'),
            religion = data.get('religion'),
            resident_id = data.get('resident_id'),
            address = data.get('address'),
        )

        if 'photo' in request.files:
            file = request.files['photo']
            if file.filename != '':
                ext = os.path.splitext(file.filename)[1].lower()
                new_filename = f"{uuid.uuid4().hex}{ext}"
                file_path = os.path.join(UPLOAD_FOLDER, new_filename)
                file.save(file_path)
                new_person.photo = f"/{UPLOAD_FOLDER}/{new_filename}"

        db.session.add(new_person)
        db.session.commit()
        return jsonify({
            "status": "success",
            "message": f"Data berhasil disimpan!"
        }), 201     
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "message": "Terjadi kesalahan pada server: " + str(e)
        }), 500

@person_bp.route('/person/<string:id>', methods=['PUT'])
def update(id):
    try:
        persons = OsPerson.query.filter_by(person_id=id).first()
        data = request.json if request.is_json else request.form

        persons.name = data.get('nama', persons.name)
        persons.gender = data.get('gender', persons.gender)
        persons.pob = data.get('pob', persons.pob)
        persons.dob = data.get('dob', persons.dob)
        persons.religion = data.get('religion', persons.religion)
        persons.resident_id = data.get('resident_id', persons.resident_id)
        persons.address = data.get('address', persons.address)

        if 'photo' in request.files:
            file = request.files['photo']
            if file.filename != '':
                ext = os.path.splitext(file.filename)[1].lower()
                new_filename = f"{uuid.uuid4().hex}{ext}"
                file_path = os.path.join(UPLOAD_FOLDER, new_filename)
                file.save(file_path)
                persons.photo = f"/{UPLOAD_FOLDER}/{new_filename}"
    
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil diupdate!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@person_bp.route('/person/<string:id>', methods=['DELETE'])
def delete(id):
    try:
        data_person = OsPerson.query.filter_by(person_id=id).first()        
        db.session.delete(data_person)
        db.session.commit()
        return jsonify({"status": "success", "message": "Data berhasil dihapus!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": "Gagal menghapus: " + str(e)}), 500

# @person_bp.before_request
# @login_required
# def before_request():
#     pass