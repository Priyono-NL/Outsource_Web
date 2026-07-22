from extensions import db
from model.base import AuditMixin

class ObEmployee(db.Model, AuditMixin):
    __tablename__ = 'ob_emp'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer)
    employee_name = db.Column(db.String(200))
    company_id = db.Column(db.String(10))
    cost_center = db.Column(db.String(50))    
    card_no = db.Column(db.String(50))
    grade = db.Column(db.String(10))
    valid_from = db.Column(db.Date)
    valid_to = db.Column(db.Date)

    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'employee_name': self.employee_name,
            'company_id': self.company_id,
            'cost_center': self.cost_center,
            'card_no': self.card_no,
            'grade': self.grade,
            'valid_from': self.valid_from.strftime('%d %b %Y') if self.valid_from else None,
            'valid_to': self.valid_to.strftime('%d %b %Y') if self.valid_to else None,
        }

AuditMixin.register_audit_events(ObEmployee)