from extensions import db
from datetime import datetime

class OsPerson(db.Model):
    __tablename__ = 'os_person'
    person_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    created_date = db.Column(db.DateTime, default=datetime.now)
    modified_date = db.Column(db.DateTime, onupdate=datetime.now)
    created_by = db.Column(db.String(50))
    modified_by = db.Column(db.String(50))