from extensions import db
from model.base import AuditMixin

class Guest(db.Model, AuditMixin):
    __tablename__ = 'guest_canteen'
    
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.String(50), index=True) 
    canteen_id = db.Column(db.String(10), db.ForeignKey('canteen_master.canteen_id'))
    valid_from = db.Column(db.Date)
    valid_to = db.Column(db.Date)

    periode_puasa_id = db.Column(db.Integer, db.ForeignKey('periode_puasa.periode_id', ondelete='CASCADE'), nullable=True, index=True)
    reason = db.Column(db.String(100), nullable=True)
    
    employement = db.relationship(
        'OsEmployment', 
        primaryjoin="Guest.employee_id == cast(OsEmployment.id, String)",
        foreign_keys=[employee_id],
        lazy=True,
        uselist=False,
        viewonly=True
    )
    
    ob_employee = db.relationship(
        'ObEmployee',
        primaryjoin="Guest.employee_id == cast(ObEmployee.employee_id, String)",
        foreign_keys=[employee_id],
        lazy=True,
        uselist=False,
        viewonly=True,
        overlaps="employement"
    )

    canteen_master = db.relationship('canteen', backref='guest_canteen_refs', lazy=True)

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
            "guest_id": self.id,
            "canteen_id": self.canteen_id,
            "employee_id": self.employee_id,
            "employee_code": emp_code,
            "employee_name": emp_name,
            
            'valid_from': self.valid_from.strftime('%Y-%m-%d') if self.valid_from else None,
            'valid_to': self.valid_to.strftime('%Y-%m-%d') if self.valid_to else None,
            
            "periode_puasa_id": self.periode_puasa_id, 
            "is_puasa_allowlist": True if self.periode_puasa_id else False,
            "reason": self.reason or "-",

            "canteen_name": self.canteen_master.canteen_name if self.canteen_master else "-",
            'v_valid_from': self.valid_from.strftime('%d %b %Y') if self.valid_from else None,
            'v_valid_to': self.valid_to.strftime('%d %b %Y') if self.valid_to else None
        }

AuditMixin.register_audit_events(Guest)