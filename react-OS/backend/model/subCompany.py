from extensions import db
from datetime import datetime, timedelta, timezone

class SubCompany(db.Model):
    __tablename__ = 'sub_company'
    sub_company_id = db.Column(db.String(10), primary_key=True)
    sub_company_name = db.Column(db.String(200))
    type_company = db.Column(db.Enum('OS', 'Vendor'))

    created_date = db.Column(db.DateTime, default=datetime.now(timezone(timedelta(hours=7)))) 
    modified_date = db.Column(db.DateTime, default=datetime.now(timezone(timedelta(hours=7))), onupdate=datetime.now(timezone(timedelta(hours=7))))
    created_by = db.Column(db.String(50))
    modified_by = db.Column(db.String(50))

    def to_dict(self):
        return {
            'sub_company_id': self.sub_company_id,
            'sub_company_name': self.sub_company_name,
            'type_company': self.type_company
        }