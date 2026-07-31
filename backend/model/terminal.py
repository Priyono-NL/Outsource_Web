from extensions import db
from model.base import AuditMixin

class terminal(db.Model, AuditMixin):
    __tablename__ = 'terminal_master'
    id = db.Column(db.Integer, primary_key=True)
    node_id = db.Column(db.Integer)
    cost_center = db.Column(db.Integer)
    terminal_id = db.Column(db.String(10))
    terminal_name = db.Column(db.String(255))
    company_id = db.Column(db.String(50))
    direction = db.Column(db.String(10))
    terminal_type = db.Column(db.String(50))
    server_loc = db.Column(db.String(20))

    def to_dict(self):
        return {
            'id': self.id,
            'terminal_id': self.terminal_id,
            'terminal_name': self.terminal_name,
            'company_id': self.company_id,
            'direction': self.direction,
            'terminal_type': self.terminal_type,
            'node_id': self.node_id,
            'cost_center': self.cost_center,
            'server_loc': self.server_loc
        }

AuditMixin.register_audit_events(terminal)