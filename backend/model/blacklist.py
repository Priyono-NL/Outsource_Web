from extensions import db
from model.base import AuditMixin

class OsBlacklist(db.Model, AuditMixin):
    __tablename__ = 'os_blacklist'
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.Integer, db.ForeignKey('os_person.person_id'))
    status = db.Column(db.Integer)
    block_status = db.Column(db.String(200))

    person = db.relationship('OsPerson', backref='OsBlist', lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "person_id": self.person_id,
            "status": self.status,
            "block_status": self.block_status,
            "person_name": self.person.name,
            "resident_id": self.person.resident_id,
            'status_text': "Blacklist" if self.status == 1 else "No in Blacklist",
        }
    
AuditMixin.register_audit_events(OsBlacklist)