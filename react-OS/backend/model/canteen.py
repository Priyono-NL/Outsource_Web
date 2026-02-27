from extensions import db
from datetime import datetime

class canteen(db.Model):
    __tablename__ = 'canteen_master'
    canteen_id = db.Column(db.String(10), primary_key=True)
    canteen_name = db.Column(db.String(200))

    created_date = db.Column(db.DateTime, default=datetime.now)
    modified_date = db.Column(db.DateTime, onupdate=datetime.now)
    created_by = db.Column(db.String(50))
    modified_by = db.Column(db.String(50))

    def to_dict(self):
        return {
            'canteen_id': self.canteen_id,
            'canteen_name': self.canteen_name,
        }