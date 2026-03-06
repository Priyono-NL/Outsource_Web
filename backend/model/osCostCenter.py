from extensions import db
from datetime import datetime, timezone, timedelta

def get_wib_now():
    return datetime.now(timezone(timedelta(hours=7)))

class OsCostCenter(db.Model):
    __tablename__ = 'os_org'
    id = db.Column(db.Integer, primary_key=True)
    valid_from = db.Column(db.Date)
    valid_to = db.Column(db.Date)
    
    created_date = db.Column(db.DateTime, default=get_wib_now) 
    modified_date = db.Column(db.DateTime, onupdate=get_wib_now)
    created_by = db.Column(db.String(50))
    modified_by = db.Column(db.String(50))

    employee_id = db.Column(db.Integer, db.ForeignKey('os_employment.employee_id'))
    cc_id = db.Column(db.Integer, db.ForeignKey('org_cost_center.cost_center'))

    employement = db.relationship('OsEmployment', backref='OsCC', lazy=True)
    cc_master = db.relationship('costCenter', backref='tr_cc', lazy=True)

    def to_dict(self):
        return {
            "id_oscc": self.id,
            "employee_id": self.employee_id,
            "cc_id": self.cc_id,            
            'valid_from': self.valid_from.strftime('%Y-%m-%d') if hasattr(self.valid_from, 'strftime') else None,
            'valid_to': self.valid_to.strftime('%Y-%m-%d') if hasattr(self.valid_to, 'strftime') else None,

            "employee_name": self.employement.person.name,
            'cc_name': self.cc_master.org_name,
            'v_valid_from': self.valid_from.strftime('%d %b %Y') if self.valid_from else None,
            'v_valid_to': self.valid_to.strftime('%d %b %Y') if self.valid_to else None
        }