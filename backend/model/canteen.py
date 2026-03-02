from extensions import db
from datetime import datetime, timedelta, timezone

def get_wib_now():
    return datetime.now(timezone(timedelta(hours=7))).replace(tzinfo=None)

class canteenDetail(db.Model):
    __tablename__ = 'canteen_detail'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    canteen_id = db.Column(db.String(50), db.ForeignKey('canteen_master.canteen_id'))
    cc_id = db.Column(db.String(50))

class canteen(db.Model):
    __tablename__ = 'canteen_master'
    canteen_id = db.Column(db.String(10), primary_key=True)
    canteen_name = db.Column(db.String(200))

    created_date = db.Column(db.DateTime, default=get_wib_now) 
    modified_date = db.Column(db.DateTime, default=get_wib_now, onupdate=get_wib_now)
    created_by = db.Column(db.String(50))
    modified_by = db.Column(db.String(50))

    details = db.relationship('canteenDetail', backref='canteen_parent', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'canteen_id': self.canteen_id,
            'canteen_name': self.canteen_name,
            'cc_ids': [d.cc_id for d in self.details]
        }