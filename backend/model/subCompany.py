from extensions import db
from model.base import AuditMixin

class SubCompany(db.Model, AuditMixin):
    __tablename__ = 'sub_company'
    sub_company_id = db.Column(db.String(10), primary_key=True)
    sub_company_name = db.Column(db.String(200))
    type_company = db.Column(db.Enum('Intern','OS', 'Vendor'))

    def to_dict(self):
        return {
            'sub_company_id': self.sub_company_id,
            'sub_company_name': self.sub_company_name,
            'type_company': self.type_company
        }
    
AuditMixin.register_audit_events(SubCompany)