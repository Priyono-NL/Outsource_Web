from extensions import db
from datetime import datetime, timedelta, timezone

def get_wib_now():
    return datetime.now(timezone(timedelta(hours=7)))

class osTraining(db.Model):
    __tablename__ = 'os_employee_training'
    id = db.Column(db.Integer, primary_key=True)
    training_date_from = db.Column(db.Date)
    training_date_to = db.Column(db.Date)
    training_result = db.Column(db.Integer)
    training_score = db.Column(db.Integer)

    created_date = db.Column(db.DateTime, default=get_wib_now) 
    modified_date = db.Column(db.DateTime, onupdate=get_wib_now)
    created_by = db.Column(db.String(50))
    modified_by = db.Column(db.String(50))

    employee_id = db.Column(db.Integer, db.ForeignKey('os_employment.employee_id'))
    training_id = db.Column(db.String(10), db.ForeignKey('training_master.training_id'))
    
    employement = db.relationship('OsEmployment', backref='tr_training', lazy=True)
    training_m = db.relationship('training_m', backref='tr_training', lazy=True)

    def to_dict(self):
        return {
            "osTraining_id": self.id,
            "employee_id": self.employee_id,
            "training_id": self.training_id,            
            'training_date_from': self.training_date_from.strftime('%Y-%m-%d') if hasattr(self.training_date_from, 'strftime') else None,
            'training_date_to': self.training_date_to.strftime('%Y-%m-%d') if hasattr(self.training_date_to, 'strftime') else None,
            'training_result': self.training_result,
            'training_score': self.training_score,

            "training_name": self.training_m.training_name,
            "employee_name": self.employement.person_detail.name,            
            'v_training_date_from': self.training_date_from.strftime('%d %b %Y') if hasattr(self.training_date_from, 'strftime') else None,
            'v_training_date_to': self.training_date_to.strftime('%d %b %Y') if hasattr(self.training_date_to, 'strftime') else None
        }