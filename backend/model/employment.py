from extensions import db
from model.base import AuditMixin

class OsEmployment(db.Model, AuditMixin):
    __tablename__ = 'os_employment'
    employee_id = db.Column(db.Integer, primary_key=True)
    person_id = db.Column(db.Integer, db.ForeignKey('os_person.person_id'))
    sub_company_id = db.Column(db.String(10), db.ForeignKey('sub_company.sub_company_id')) 
    valid_from = db.Column(db.Date)
    valid_to = db.Column(db.Date)       
    
    person = db.relationship('OsPerson', backref='employments', lazy=True)
    sub_con = db.relationship('SubCompany', backref='subcon', lazy=True)   

    def to_dict(self):
        card = self.OsCard[0] if self.OsCard and len(self.OsCard) > 0 else None
        card_from = card.valid_from if card else None
        card_to = card.valid_to if card else None
        return {
            'employee_id': self.employee_id,
            'sub_company_id': self.sub_company_id,            
            'person_id': self.person_id,
            'valid_from': self.valid_from.strftime('%Y-%m-%d') if hasattr(self.valid_from, 'strftime') else None,
            'valid_to': self.valid_to.strftime('%Y-%m-%d') if hasattr(self.valid_to, 'strftime') else None,

            'v_valid_from': self.valid_from.strftime('%d %b %Y') if self.valid_from else None,
            'v_valid_to': self.valid_to.strftime('%d %b %Y') if self.valid_to else None,
            

            'person_name': self.person.name,
            'gender': self.person.gender,
            'pob': self.person.pob,
            'dob': self.person.dob.strftime('%Y-%m-%d') if hasattr(self.person.dob, 'strftime') else None,            
            'religion': self.person.religion,
            'resident_id': self.person.resident_id,
            'address': self.person.address,

            'v_dob': self.person.dob.strftime('%d %b %Y') if self.person.dob else None,
            'sub_con_name': self.sub_con.sub_company_name,
            'type_company': self.sub_con.type_company,            
            'cc_name': self.OsCC[0].cc_master.org_name if self.OsCC else None,

            'card_number': self.OsCard[0].card_number if self.OsCard else None,
            'card_number_from': card_from.strftime('%d %b %Y') if card_from else None,
            'card_number_to': card_to.strftime('%d %b %Y') if card_to else None,
        }
    
AuditMixin.register_audit_events(OsEmployment)