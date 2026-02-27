from extensions import db
from datetime import datetime, timezone, timedelta

class training_m(db.Model):
    __tablename__ = 'training_master'
    training_id = db.Column(db.String(10), primary_key=True)
    training_name = db.Column(db.String(200))
    organizer = db.Column(db.String(200))

    created_date = db.Column(db.DateTime, default=datetime.now(timezone(timedelta(hours=7)))) 
    modified_date = db.Column(db.DateTime, default=datetime.now(timezone(timedelta(hours=7))), onupdate=datetime.now(timezone(timedelta(hours=7))))
    created_by = db.Column(db.String(50))
    modified_by = db.Column(db.String(50))

    def to_dict(self):
        return {
            'training_id': self.training_id,
            'training_name': self.training_name,
            'organizer': self.organizer
        }