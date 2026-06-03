from extensions import db
from model.base import AuditMixin

class Absensi(db.Model, AuditMixin):
    __tablename__ = 'absensi_temp'
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('os_employment.id'))
    date_clocking = db.Column(db.Date)
    clocking_in = db.Column(db.DateTime)
    clocking_out = db.Column(db.DateTime)

    employement = db.relationship('OsEmployment', backref='OsAbsen', lazy=True)
    bac_os_data = db.relationship('BAC_os', backref='absensi_ref', lazy=True)

    def to_dict(self):
        emp = self.employement

        emp_subcom = emp.sub_con.sub_company_name if (emp and emp.sub_con) else None
        emp_card = emp.OsCard[0].card_number if (emp and emp.OsCard and len(emp.OsCard) > 0) else None
        emp_cc = emp.OsCC[0].cc_master.org_name if (emp and emp.OsCC and len(emp.OsCC) > 0) else None
        emp_type = emp.OsType[0].type_worker if (emp and emp.OsType and len(emp.OsType) > 0) else None

        bac = self.bac_os_data[0] if self.bac_os_data and len(self.bac_os_data) > 0 else None

        return {
            "absensi_id": self.id,
            "employee_id": self.employee_id,
            "employee_code": emp.employee_code if emp else None,
            "employee_name": emp.person.name if (emp and emp.person) else None,
            "gender": emp.person.gender if (emp and emp.person) else None,
            "subCom": emp_subcom,
            "card": emp_card,
            "cc": emp_cc,
            "type": emp_type,
            "v_date_clocking": self.date_clocking.strftime('%d %b %Y') if self.date_clocking else None,
            "date_clocking": self.date_clocking.strftime('%Y-%m-%d') if self.date_clocking else None,
            "clocking_in": self.clocking_in.strftime('%H:%M') if self.clocking_in else None,
            "clocking_out": self.clocking_out.strftime('%H:%M') if self.clocking_out else None,

            "bac_id": bac.id if bac else None,
            "bac_no": bac.bac_no if bac else None,
            "bac_ket": bac.bac_ket if bac else None,
            "bac_clock_in": bac.clock_in.strftime('%Y-%m-%dT%H:%M') if (bac and bac.clock_in) else None,
            "bac_clock_out": bac.clock_out.strftime('%Y-%m-%dT%H:%M') if (bac and bac.clock_out) else None,
            "bac_updated_by": bac.modified_by if bac else None,
            "bac_updated_date": bac.modified_date.strftime('%d %b %Y') if (bac and bac.modified_date) else None,
        }

class BAC_os(db.Model, AuditMixin):
    __tablename__ = 'bac_os'
    id = db.Column(db.Integer, primary_key=True)
    absensi_id = db.Column(db.Integer, db.ForeignKey('absensi_temp.id'))
    employee_id = db.Column(db.Integer)
    bac_no = db.Column(db.String(50))
    bac_ket = db.Column(db.String(255))
    clock_date = db.Column(db.Date)
    clock_in = db.Column(db.DateTime, nullable=True)
    clock_out = db.Column(db.DateTime, nullable=True)

AuditMixin.register_audit_events(Absensi)
AuditMixin.register_audit_events(BAC_os)