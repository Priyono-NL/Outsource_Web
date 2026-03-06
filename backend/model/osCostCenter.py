from extensions import db
from datetime import datetime, timezone, timedelta

def get_wib_now():
    return datetime.now(timezone(timedelta(hours=7)))

class OsCostCenter(db.Model):
    __tablename__ = 'os_org'
    id = db.Column(db.Integer, primary_key=True)
    cc_id = db.Column(db.Integer)
    valid_from = db.Column(db.Date)
    valid_to = db.Column(db.Date)
    
    created_date = db.Column(db.DateTime, default=get_wib_now) 
    modified_date = db.Column(db.DateTime, onupdate=get_wib_now)
    created_by = db.Column(db.String(50))
    modified_by = db.Column(db.String(50))

    employee_id = db.Column(db.Integer, db.ForeignKey('os_employment.employee_id'))
    employement = db.relationship('OsEmployment', backref='OsCard', lazy=True)