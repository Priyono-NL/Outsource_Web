from extensions import db
from model.base import AuditMixin

class osTraining(db.Model, AuditMixin):
    __tablename__ = 'os_employee_training'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('os_employment.id'))
    training_id = db.Column(db.String(10), db.ForeignKey('training_master.training_id'))
    training_date_from = db.Column(db.Date)
    training_date_to = db.Column(db.Date)
    training_result = db.Column(db.Integer)
    training_score = db.Column(db.Integer)    
    
    employement = db.relationship('OsEmployment', backref='training_records', lazy=True)
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

            "employee_code": self.employement.employee_code,
            "training_name": self.training_m.training_name,
            "employee_name": self.employement.person.name,            
            'v_training_date_from': self.training_date_from.strftime('%d %b %Y') if hasattr(self.training_date_from, 'strftime') else None,
            'v_training_date_to': self.training_date_to.strftime('%d %b %Y') if hasattr(self.training_date_to, 'strftime') else None,
            'status_result': "Lulus" if self.training_result == 1 else "Tidak Lulus",
        }

AuditMixin.register_audit_events(osTraining)