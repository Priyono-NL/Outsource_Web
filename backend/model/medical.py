from extensions import db
from model.base import AuditMixin

class medical(db.Model, AuditMixin):
    __tablename__ = 'medical_master'
    medical_id = db.Column(db.String(10), primary_key=True)
    medical_name = db.Column(db.String(200))
    faskes = db.Column(db.String(200))

    def to_dict(self):
        return {
            'medical_id': self.medical_id,
            'medical_name': self.medical_name,
            'faskes': self.faskes
        }

AuditMixin.register_audit_events(medical)