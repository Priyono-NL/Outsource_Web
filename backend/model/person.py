from extensions import db
from model.base import AuditMixin

class OsPerson(db.Model, AuditMixin):
    __tablename__ = 'os_person'
    person_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))
    gender = db.Column(db.Enum('L', 'P'))
    address = db.Column(db.Text)
    pob = db.Column(db.String(100))
    dob = db.Column(db.Date)
    religion = db.Column(db.String(50))
    resident_id = db.Column(db.String(50))

AuditMixin.register_audit_events(OsPerson)