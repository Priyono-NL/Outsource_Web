from extensions import db
from model.base import AuditMixin

class Absensi(db.Model, AuditMixin):
    __tablename__ = 'absensi_temp'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('os_employment.id'))
    date_clocking = db.Column(db.Date)
    clocking_in = db.Column(db.DateTime)
    clocking_out = db.Column(db.DateTime)

    employement = db.relationship('OsEmployment', backref='OsAbsen', lazy=True)

    def to_dict(self):
        return {
            "absensi_id": self.id,
            "employee_id": self.employee_id,
            "employee_code": self.employement.employee_code,
            "employee_name": self.employement.person.name,
            "date_clocking": self.date_clocking,
            "clocking_in": self.clocking_in,
            "clocking_out": self.clocking_out,
        }

AuditMixin.register_audit_events(Absensi)