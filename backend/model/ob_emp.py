from extensions import db

class ObEmployee(db.Model):
    __tablename__ = 'vw_master_karyawan'
    employee_id = db.Column(db.String(50), primary_key=True)
    employee_name = db.Column(db.String(200))
    cost_center = db.Column(db.Integer, db.ForeignKey('org_cost_center.cost_center'))
    card_no = db.Column(db.String(50))
    grade = db.Column(db.String(5))

    def to_dict(self):
        return {
            'employee_id': self.employee_id,
            'employee_name': self.employee_name,
            'cost_center': self.cost_center,
            'card_no': self.card_no,
            'grade': self.grade
        }