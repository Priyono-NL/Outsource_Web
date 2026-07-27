from extensions import db
from model.base import AuditMixin
from sqlalchemy import cast, String

class osMedical(db.Model, AuditMixin):
    __tablename__ = 'os_employee_medical'
    
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.String(20)) 
    medical_id = db.Column(db.String(10), db.ForeignKey('medical_master.medical_id'))
    medical_date = db.Column(db.Date)
    medical_result = db.Column(db.String(50))
    medical_notes = db.Column(db.String(200))    
    
    # Relasi ke OS Employment
    employement = db.relationship(
        'OsEmployment',
        primaryjoin="cast(osMedical.employee_id, String) == cast(OsEmployment.id, String)",
        foreign_keys=[employee_id], 
        lazy=True,
        uselist=False,
        viewonly=True
    )

    # Relasi ke OB Employee (Disesuaikan ke ObEmployee.employee_id)
    ob_employee = db.relationship(
        'ObEmployee',
        primaryjoin="cast(osMedical.employee_id, String) == cast(ObEmployee.employee_id, String)",
        foreign_keys=[employee_id], 
        lazy=True,
        uselist=False,
        viewonly=True,
        overlaps="employement"
    )
    
    medical_m = db.relationship('medical', backref='tr_medical', lazy=True)

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
            "osMedical_id": self.id,
            "employee_id": self.employee_id,
            "employee_code": emp_code,
            "employee_name": emp_name,

            "medical_id": self.medical_id,            
            'medical_date': self.medical_date.strftime('%Y-%m-%d') if self.medical_date else None,
            'medical_result': self.medical_result or "-",
            'medical_notes': self.medical_notes or "-",
            
            # Pengaman NoneType untuk master medical
            "medical_name": self.medical_m.medical_name if self.medical_m else "-",           
            'v_medical_date': self.medical_date.strftime('%d %b %Y') if self.medical_date else None
        }

AuditMixin.register_audit_events(osMedical)