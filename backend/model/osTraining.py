from extensions import db
from model.base import AuditMixin
from sqlalchemy import cast, String

class osTraining(db.Model, AuditMixin):
    __tablename__ = 'os_employee_training'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.String(20)) 
    training_id = db.Column(db.String(10), db.ForeignKey('training_master.training_id'))
    training_date_from = db.Column(db.Date)
    training_date_to = db.Column(db.Date)
    training_result = db.Column(db.Integer)
    training_score = db.Column(db.Integer)    
    
    # Relasi ke OS Employment
    employement = db.relationship(
        'OsEmployment',
        primaryjoin="cast(osTraining.employee_id, String) == cast(OsEmployment.id, String)",
        foreign_keys=[employee_id], 
        lazy=True,
        uselist=False,
        viewonly=True
    )

    # Relasi ke OB Employee (Disesuaikan ke ObEmployee.employee_id)
    ob_employee = db.relationship(
        'ObEmployee',
        primaryjoin="cast(osTraining.employee_id, String) == cast(ObEmployee.employee_id, String)",
        foreign_keys=[employee_id], 
        lazy=True,
        uselist=False,
        viewonly=True,
        overlaps="employement"
    )

    training_m = db.relationship('training_m', backref='tr_training', lazy=True)

    def to_dict(self):
        emp_code = self.employee_id
        emp_name = "-"

        # 1. Cek Karyawan OS
        if self.employement:
            emp_code = self.employement.employee_code
            emp_name = self.employement.person.name if self.employement.person else "-"
            
        # 2. Cek Karyawan OB
        elif self.ob_employee:
            emp_code = self.ob_employee.employee_id
            emp_name = self.ob_employee.employee_name

        return {
            "osTraining_id": self.id,
            "employee_id": self.employee_id,
            "employee_code": emp_code,
            "employee_name": emp_name,

            "training_id": self.training_id,            
            'training_date_from': self.training_date_from.strftime('%Y-%m-%d') if self.training_date_from else None,
            'training_date_to': self.training_date_to.strftime('%Y-%m-%d') if self.training_date_to else None,
            'training_result': self.training_result,
            'training_score': self.training_score,

            "training_name": self.training_m.training_name,         
            'v_training_date_from': self.training_date_from.strftime('%d %b %Y') if self.training_date_from else None,
            'v_training_date_to': self.training_date_to.strftime('%d %b %Y') if self.training_date_to else None,
            'status_result': "Lulus" if self.training_result == 1 else "Tidak Lulus",
        }

AuditMixin.register_audit_events(osTraining)