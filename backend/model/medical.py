from extensions import db
from datetime import datetime, timedelta, timezone

def get_wib_now():
    return datetime.now(timezone(timedelta(hours=7)))

class medical(db.Model):
    __tablename__ = 'medical_master'
    medical_id = db.Column(db.String(10), primary_key=True)
    medical_name = db.Column(db.String(200))
    faskes = db.Column(db.String(200))

    created_date = db.Column(db.DateTime, default=get_wib_now) 
    modified_date = db.Column(db.DateTime, onupdate=get_wib_now)
    created_by = db.Column(db.String(50))
    modified_by = db.Column(db.String(50))

    def to_dict(self):
        return {
            'medical_id': self.medical_id,
            'medical_name': self.medical_name,
            'faskes': self.faskes
        }