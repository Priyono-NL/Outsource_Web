from extensions import db
from datetime import datetime, timezone, timedelta

def get_wib_now():
    return datetime.now(timezone(timedelta(hours=7)))

class OsBlacklist(db.Model):
    __tablename__ = 'os_blacklist'
    id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.Integer, db.ForeignKey('os_person.person_id'))
    status = db.Column(db.Integer)
    block_status = db.Column(db.String(200))
    
    created_date = db.Column(db.DateTime, default=get_wib_now) 
    modified_date = db.Column(db.DateTime, onupdate=get_wib_now)
    created_by = db.Column(db.String(50))
    modified_by = db.Column(db.String(50))

    person = db.relationship('OsPerson', backref='OsBlist', lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "person_id": self.person_id,
            "status": self.status,
            "block_status": self.block_status,
            "person_name": self.person.name,
            'status_text': "Blacklist" if self.status == 1 else "Tidak Diblacklist",
        }