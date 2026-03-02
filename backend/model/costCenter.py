from extensions import db
from datetime import datetime, timedelta, timezone

def get_wib_now():
    return datetime.now(timezone(timedelta(hours=7)))

class costCenter(db.Model):
    __tablename__ = 'org_cost_center'
    cost_center = db.Column(db.Integer, primary_key=True)
    org_name = db.Column(db.String(200))
    company_id = db.Column(db.Integer)
    org_id = db.Column(db.Integer)
    
    created_date = db.Column(db.DateTime, default=get_wib_now) 
    modified_date = db.Column(db.DateTime, onupdate=get_wib_now)
    created_by = db.Column(db.String(50))
    modified_by = db.Column(db.String(50))

    def to_dict(self):
        return {
            'company_id': self.company_id,
            'org_id': self.org_id,
            'org_name': self.org_name,
            'cost_center': self.cost_center,            
        }