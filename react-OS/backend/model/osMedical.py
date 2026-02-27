from extensions import db
from datetime import datetime, timedelta, timezone

def get_wib_now():
    return datetime.now(timezone(timedelta(hours=7)))

class osMedical(db.Model):
    __tablename__ = 'os_employee_medical'
    id = db.Column(db.Integer, primary_key=True)
    medical_date = db.Column(db.Date)
    medical_result = db.Column(db.String(50))
    medical_notes = db.Column(db.String(200))

    created_date = db.Column(db.DateTime, default=get_wib_now) 
    modified_date = db.Column(db.DateTime, onupdate=get_wib_now)
    created_by = db.Column(db.String(50))
    modified_by = db.Column(db.String(50))

    employee_id = db.Column(db.Integer, db.ForeignKey('os_employment.employee_id'))
    medical_id = db.Column(db.String(10), db.ForeignKey('medical_master.medical_id'))
    
    employement = db.relationship('OsEmployment', backref='tr_medical', lazy=True)
    medical_m = db.relationship('medical', backref='tr_medical', lazy=True)

    def to_dict(self):
        return {
            "osMedical_id": self.id,
            "employee_id": self.employee_id,
            "medical_id": self.medical_id,            
            'medical_date': self.medical_date.strftime('%Y-%m-%d') if hasattr(self.medical_date, 'strftime') else None,
            'medical_result': self.medical_result,
            'medical_notes': self.medical_notes,

            "medical_name": self.medical_m.medical_name,
            "employee_name": self.employement.person_detail.name,            
            'v_medical_date': self.medical_date.strftime('%d %b %Y') if hasattr(self.medical_date, 'strftime') else None
        }