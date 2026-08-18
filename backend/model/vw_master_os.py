from extensions import db

class VwMasterOsActive(db.Model):
    __tablename__ = 'vw_master_os_active'
    
    employee_code = db.Column(db.String(50), primary_key=True)
    employee_name = db.Column(db.String(255))
    gender = db.Column(db.String(10))    
    sub_company_id = db.Column(db.String(50))
    sub_company_name = db.Column(db.String(100))    
    card_number = db.Column(db.String(50))
    cost_center_id = db.Column(db.String(50))
    cc_name = db.Column(db.String(50))    
    type_worker = db.Column(db.String(50))
    position = db.Column(db.String(100))    
    join_date = db.Column(db.Date)
    termination_date = db.Column(db.Date)