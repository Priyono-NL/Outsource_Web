from extensions import db
from model.base import AuditMixin

class costCenter(db.Model, AuditMixin):
    __tablename__ = 'org_cost_center'
    cost_center = db.Column(db.Integer, primary_key=True)
    org_name = db.Column(db.String(200))
    company_id = db.Column(db.Integer)
    org_id = db.Column(db.Integer)
    
    def to_dict(self):
        return {
            'company_id': self.company_id,
            'org_id': self.org_id,
            'org_name': self.org_name,
            'cost_center': self.cost_center,            
        }

AuditMixin.register_audit_events(costCenter)