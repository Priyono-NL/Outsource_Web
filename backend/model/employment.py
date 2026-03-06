from extensions import db
from datetime import datetime, timezone, timedelta

def get_wib_now():
    return datetime.now(timezone(timedelta(hours=7)))

class OsEmployment(db.Model):
    __tablename__ = 'os_employment'
    employee_id = db.Column(db.Integer, primary_key=True)
    valid_from = db.Column(db.Date)
    valid_to = db.Column(db.Date)
    
    created_date = db.Column(db.DateTime, default=get_wib_now) 
    modified_date = db.Column(db.DateTime, onupdate=get_wib_now)
    created_by = db.Column(db.String(50))
    modified_by = db.Column(db.String(50))

    person_id = db.Column(db.Integer, db.ForeignKey('os_person.person_id'))
    sub_company_id = db.Column(db.String(10), db.ForeignKey('sub_company.sub_company_id'))    
    
    person = db.relationship('OsPerson', backref='employments', lazy=True)
    sub_con = db.relationship('SubCompany', backref='subcon', lazy=True)

    def to_dict(self):
        return {
            'employee_id': self.employee_id,
            'sub_company_id': self.sub_company_id,            
            'person_id': self.person_id,
            'valid_from': self.valid_from.strftime('%Y-%m-%d') if hasattr(self.valid_from, 'strftime') else None,
            'valid_to': self.valid_to.strftime('%Y-%m-%d') if hasattr(self.valid_to, 'strftime') else None,

            'v_valid_from': self.valid_from.strftime('%d %b %Y') if self.valid_from else None,
            'v_valid_to': self.valid_to.strftime('%d %b %Y') if self.valid_to else None,
            'person_name': self.person.name,
            'sub_con_name': self.sub_con.sub_company_name,
        }