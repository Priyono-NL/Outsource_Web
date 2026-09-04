from extensions import db
from model.base import AuditMixin

class OsCostCenter(db.Model, AuditMixin):
    __tablename__ = 'os_org'
    
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('os_employment.id'))
    cc_id = db.Column(db.Integer)
    org_cc_id = db.Column(db.Integer, db.ForeignKey('org_cost_center.id'))
    valid_from = db.Column(db.Date)
    valid_to = db.Column(db.Date)    

    employement = db.relationship('OsEmployment', backref='OsCC', lazy=True)    
    cc_master = db.relationship('costCenter', foreign_keys=[org_cc_id], backref='tr_cc', lazy=True)

    def to_dict(self):
        return {
            "id_oscc": self.id,
            "employee_id": self.employee_id,
            "cc_id": self.cc_id,
            "org_cc_id": self.org_cc_id,
            'valid_from': self.valid_from.strftime('%Y-%m-%d') if hasattr(self.valid_from, 'strftime') else None,
            'valid_to': self.valid_to.strftime('%Y-%m-%d') if hasattr(self.valid_to, 'strftime') else None,

            "employee_code": self.employement.employee_code if self.employement else None,
            "employee_name": self.employement.person.name if (self.employement and self.employement.person) else None,
            'cc_name': self.cc_master.org_name if self.cc_master else None,
            
            'v_valid_from': self.valid_from.strftime('%d %b %Y') if self.valid_from else None,
            'v_valid_to': self.valid_to.strftime('%d %b %Y') if self.valid_to else None
        }
    
AuditMixin.register_audit_events(OsCostCenter)