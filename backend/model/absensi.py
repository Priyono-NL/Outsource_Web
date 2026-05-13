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
            "date_clocking": self.date_clocking.strftime('%Y-%m-%d') if self.date_clocking else None,
            "clocking_in": self.clocking_in.strftime('%Y-%m-%d %H:%M:%S') if self.clocking_in else None,
            "clocking_out": self.clocking_out.strftime('%Y-%m-%d %H:%M:%S') if self.clocking_out else None,
        }

class BAC_os(db.Model, AuditMixin):
    __tablename__ = 'bac_os'
    id = db.Column(db.Integer, primary_key=True)
    absensi_id = db.Column(db.Integer, db.ForeignKey('absensi_temp.id'))
    employee_id = db.Column(db.Integer)
    bac_no = db.Column(db.String(50))
    bac_ket = db.Column(db.String(200))

AuditMixin.register_audit_events(Absensi)