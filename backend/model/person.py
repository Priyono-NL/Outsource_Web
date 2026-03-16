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
    photo = db.Column(db.String(255), nullable=True)

    def to_dict(self):
        return {
            'person_id': self.person_id,
            'name': self.name,
            'gender': self.gender,
            'address': self.address,
            'pob': self.pob,
            'dob': self.dob.strftime('%Y-%m-%d') if hasattr(self.dob, 'strftime') else None,
            'v_dob': self.dob.strftime('%d %b %Y') if self.dob else None,
            'religion': self.religion,
            'resident_id': self.resident_id,
            "photo": self.photo,
        }

AuditMixin.register_audit_events(OsPerson)