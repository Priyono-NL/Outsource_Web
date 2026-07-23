from extensions import db
from model.base import AuditMixin

class periode(db.Model, AuditMixin):
    __tablename__ = 'periode_puasa'
    periode_id = db.Column(db.Integer, primary_key=True)
    periode_name = db.Column(db.String(100))
    tahun = db.Column(db.Integer)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)

    def to_dict(self):
        return {
            'periode_id': self.periode_id,
            'periode_name': self.periode_name,
            'tahun': self.tahun,
            'start_date':  self.start_date.strftime('%Y-%m-%d') if hasattr(self.start_date, 'strftime') else None,
            'v_start_date': self.start_date.strftime('%d %b %Y') if self.start_date else None,
            'end_date': self.end_date.strftime('%Y-%m-%d') if hasattr(self.end_date, 'strftime') else None,
            'v_end_date': self.end_date.strftime('%d %b %Y') if self.end_date else None,
        }
    
AuditMixin.register_audit_events(periode)