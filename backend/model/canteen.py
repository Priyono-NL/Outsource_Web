from extensions import db
from model.base import AuditMixin

class canteenDetail(db.Model):
    __tablename__ = 'canteen_detail'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    canteen_id = db.Column(db.String(50), db.ForeignKey('canteen_master.canteen_id'))
    cc_id = db.Column(db.String(50))
    org_cc_id = db.Column(db.Integer) 

class canteen(db.Model, AuditMixin):
    __tablename__ = 'canteen_master'
    canteen_id = db.Column(db.String(10), primary_key=True)
    canteen_name = db.Column(db.String(200))

    details = db.relationship('canteenDetail', backref='canteen_parent', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'canteen_id': self.canteen_id,
            'canteen_name': self.canteen_name,
            'cc_ids': [d.org_cc_id for d in self.details if d.org_cc_id is not None]
        }
    
AuditMixin.register_audit_events(canteen)