from datetime import date
from extensions import db
from model.base import AuditMixin

class OsEmployment(db.Model, AuditMixin):
    __tablename__ = 'os_employment'
    id = db.Column(db.Integer, primary_key=True)
    employee_code = db.Column(db.Integer)
    person_id = db.Column(db.Integer, db.ForeignKey('os_person.person_id'))
    sub_company_id = db.Column(db.String(10), db.ForeignKey('sub_company.sub_company_id')) 
    valid_from = db.Column(db.Date)
    valid_to = db.Column(db.Date)       
    
    person = db.relationship('OsPerson', backref='employments', lazy=True)
    sub_con = db.relationship('SubCompany', backref='subcon', lazy=True)

    def to_dict(self):
        today = date.today()

        card = None
        if self.OsCard:
            for c in self.OsCard:
                is_from_valid = c.valid_from <= today if c.valid_from else True
                is_to_valid = c.valid_to >= today if c.valid_to else True
                
                if is_from_valid and is_to_valid:
                    card = c
                    break

        type_work_data = None
        if self.OsType:
            for t in self.OsType:
                is_from_valid = t.valid_from <= today if t.valid_from else True
                is_to_valid = t.valid_to >= today if t.valid_to else True
                if is_from_valid and is_to_valid:
                    type_work_data = t
                    break

        cc_data = None
        if self.OsCC:
            for cc in self.OsCC:
                is_from_valid = cc.valid_from <= today if cc.valid_from else True
                is_to_valid = cc.valid_to >= today if cc.valid_to else True
                if is_from_valid and is_to_valid:
                    cc_data = cc
                    break
        
        blacklist_data = self.person.OsBlist[0] if (self.person and self.person.OsBlist) else None
        card_from = card.valid_from if card else None
        card_to = card.valid_to if card else None
        return {
            'id': self.id,
            'employee_code': self.employee_code,
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
            'photo': self.person.photo,
            'v_dob': self.person.dob.strftime('%d %b %Y') if self.person.dob else None,

            'grade': self.OsGrade[0].grade if self.OsGrade else None,
            'sub_con_name': self.sub_con.sub_company_name,
            'type_company': self.sub_con.type_company,
            'cc_id': cc_data.cc_id if cc_data else None,
            'cc_name': cc_data.cc_master.org_name if (cc_data and cc_data.cc_master) else None,

            'card_number': card.card_number if card else None,
            'c_valid_from': card_from.strftime('%Y-%m-%d') if card_from else None,
            'c_valid_to': card_to.strftime('%Y-%m-%d') if card_to else None,
            'card_number_from': card_from.strftime('%d %b %Y') if card_from else None,
            'card_number_to': card_to.strftime('%d %b %Y') if card_to else None,
            
            'type_worker': type_work_data.type_worker if type_work_data else None,
            'posisi': type_work_data.posisi if type_work_data else None,

            "is_blacklist": blacklist_data.to_dict()['status_text'] if blacklist_data else "No in Blacklist",

            'created_date': self.created_date.strftime('%d %b %Y') if hasattr(self.created_date, 'strftime') else None,
            'created_by': self.created_by,
            'modified_date': self.modified_date.strftime('%d %b %Y') if hasattr(self.modified_date, 'strftime') else None,
            'modified_by': self.modified_by,
        }
    
AuditMixin.register_audit_events(OsEmployment)