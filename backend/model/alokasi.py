from extensions import db
from model.base import AuditMixin

class Alokasi(db.Model, AuditMixin):
    __tablename__ = 'os_employee_canteen'
    
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.String(50)) 
    canteen_id = db.Column(db.String(10), db.ForeignKey('canteen_master.canteen_id'))
    valid_from = db.Column(db.Date)
    valid_to = db.Column(db.Date)

    employement = db.relationship(
        'OsEmployment', 
        primaryjoin="cast(Alokasi.employee_id, String) == cast(OsEmployment.id, String)",
        foreign_keys=[employee_id],
        lazy=True,
        uselist=False,
        viewonly=True
    )
    
    ob_employee = db.relationship(
        'ObEmployee',
        primaryjoin="cast(Alokasi.employee_id, String) == cast(ObEmployee.employee_id, String)",
        foreign_keys=[employee_id],
        lazy=True,
        uselist=False,
        viewonly=True,
        overlaps="employement"
    )

    canteen_master = db.relationship('canteen', backref='tr_kantin', lazy=True)

    def to_dict(self):
        emp_code = self.employee_id
        emp_name = "-"

        if self.employement:
            emp_code = self.employement.employee_code
            emp_name = self.employement.person.name if self.employement.person else "-"
            
        elif self.ob_employee:
            emp_code = self.ob_employee.employee_id
            emp_name = self.ob_employee.employee_name

        return {
            "alokasi_id": self.id,
            "canteen_id": self.canteen_id,
            "employee_id": self.employee_id,
            "employee_code": emp_code,
            "employee_name": emp_name,
            
            'valid_from': self.valid_from.strftime('%Y-%m-%d') if self.valid_from else None,
            'valid_to': self.valid_to.strftime('%Y-%m-%d') if self.valid_to else None,

            "canteen_name": self.canteen_master.canteen_name if self.canteen_master else "-",
            'v_valid_from': self.valid_from.strftime('%d %b %Y') if self.valid_from else None,
            'v_valid_to': self.valid_to.strftime('%d %b %Y') if self.valid_to else None
        }

AuditMixin.register_audit_events(Alokasi)