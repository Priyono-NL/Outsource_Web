from extensions import db
from model.base import AuditMixin

class Alokasi(db.Model, AuditMixin):
    __tablename__ = 'os_employee_canteen'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('os_employment.employee_id'))
    canteen_id = db.Column(db.String(10), db.ForeignKey('canteen_master.canteen_id'))
    valid_from = db.Column(db.Date)
    valid_to = db.Column(db.Date)

    employement = db.relationship('OsEmployment', backref='alokasi_kantin', lazy=True)
    canteen_master = db.relationship('canteen', backref='tr_kantin', lazy=True)

    def to_dict(self):
        return {
            "alokasi_id": self.id,
            "canteen_id": self.canteen_id,
            "employee_id": self.employee_id,
            'valid_from': self.valid_from.strftime('%Y-%m-%d'),
            'valid_to': self.valid_to.strftime('%Y-%m-%d') if self.valid_to else None,

            "canteen_name": self.canteen_master.canteen_name,
            "employee_name": self.employement.person.name,            
            'v_valid_from': self.valid_from.strftime('%d %b %Y') if self.valid_from else None,
            'v_valid_to': self.valid_to.strftime('%d %b %Y') if self.valid_to else None
        }

AuditMixin.register_audit_events(Alokasi)