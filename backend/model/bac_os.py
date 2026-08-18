from extensions import db
from model.base import AuditMixin # atau gunakan kolom manual sesuai gambar

class BAC_os(db.Model, AuditMixin):
    __tablename__ = 'bac_os'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    employee_id = db.Column(db.Integer, nullable=False)
    bac_no = db.Column(db.String(50))
    bac_ket = db.Column(db.String(255))
    clock_date = db.Column(db.Date, nullable=False)
    clock_in = db.Column(db.DateTime, nullable=True)
    clock_out = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.SmallInteger, default=0)

    def to_dict(self):
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "bac_no": self.bac_no,
            "bac_ket": self.bac_ket,
            "clock_date": self.clock_date.strftime('%Y-%m-%d') if self.clock_date else None,
            "clock_in": self.clock_in.strftime('%Y-%m-%d %H:%M:%S') if self.clock_in else None,
            "clock_out": self.clock_out.strftime('%Y-%m-%d %H:%M:%S') if self.clock_out else None,
            "status": self.status,
            "created_by": self.created_by,
            "created_date": self.created_date.strftime('%d %b %Y') if self.created_date else None
        }

AuditMixin.register_audit_events(BAC_os)