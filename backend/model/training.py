from extensions import db
from model.base import AuditMixin

class training_m(db.Model, AuditMixin):
    __tablename__ = 'training_master'
    training_id = db.Column(db.String(10), primary_key=True)
    training_name = db.Column(db.String(200))
    organizer = db.Column(db.String(200))

    def to_dict(self):
        return {
            'training_id': self.training_id,
            'training_name': self.training_name,
            'organizer': self.organizer
        }
    
AuditMixin.register_audit_events(training_m)