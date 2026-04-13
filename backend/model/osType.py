from extensions import db
from model.base import AuditMixin

class osType(db.Model, AuditMixin):
    __tablename__ = 'os_type'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('os_employment.id'))
    type_worker = db.Column(db.Enum('DAILYWAGE', 'PIECERATE'))
    posisi = db.Column(db.String(50))
    valid_from = db.Column(db.Date)
    valid_to = db.Column(db.Date)    

    employement = db.relationship('OsEmployment', backref='OsType', lazy=True)
    
    def to_dict(self):
        return {
            "id_ostype": self.id,
            "employee_id": self.employee_id,
            "type_worker": self.type_worker,
            "posisi": self.posisi,            
            'valid_from': self.valid_from.strftime('%Y-%m-%d') if hasattr(self.valid_from, 'strftime') else None,
            'valid_to': self.valid_to.strftime('%Y-%m-%d') if hasattr(self.valid_to, 'strftime') else None,

            "employee_code": self.employement.employee_code,
            "employee_name": self.employement.person.name,
            'v_valid_from': self.valid_from.strftime('%d %b %Y') if self.valid_from else None,
            'v_valid_to': self.valid_to.strftime('%d %b %Y') if self.valid_to else None
        }
    
AuditMixin.register_audit_events(osType)