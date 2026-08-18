from extensions import db
from datetime import date
from sqlalchemy import and_
from sqlalchemy.orm import foreign

class Absensi_all(db.Model):
    __table_args__ = {'schema': 'db-webapps'}
    __tablename__ = 'TBL_ATTENDANCE'

    employee_id = db.Column(db.Integer, primary_key=True)
    card_id = db.Column(db.String(15))
    clocking_date = db.Column(db.Date, primary_key=True)

    clock_in = db.Column(db.DateTime, primary_key=True) 
    clock_out = db.Column(db.DateTime, primary_key=True)
    flag_anomaly = db.Column('flag', db.Integer, primary_key=True)

    # RELASI BARU: Langsung tembak ke View yang sudah bersih dari data kadaluarsa
    os_active = db.relationship(
        'VwMasterOsActive', 
        primaryjoin="cast(Absensi_all.employee_id, String) == cast(VwMasterOsActive.employee_code, String)",
        foreign_keys=[employee_id],
        lazy=True,
        uselist=False,
        viewonly=True
    )
    
    # Relasi ke Organic / Internal (OB) tetap dipertahankan
    ob_employee = db.relationship(
        'ObEmployee',
        primaryjoin="cast(Absensi_all.employee_id, String) == cast(ObEmployee.employee_id, String)",
        foreign_keys=[employee_id],
        lazy=True,
        uselist=False,
        viewonly=True,
        overlaps="os_active"
    )

    bac_os_data = db.relationship(
        'BAC_os',
        primaryjoin="and_("
                    "foreign(BAC_os.employee_id) == Absensi_all.employee_id, "
                    "foreign(BAC_os.clock_date) == Absensi_all.clocking_date"
                    ")",
        lazy=True,
        uselist=True,
        viewonly=True
    )

    def to_dict(self):
        def format_time_str(dt_obj):
            if not dt_obj: return None
            if hasattr(dt_obj, 'strftime'): return dt_obj.strftime('%H:%M')
            dt_str = str(dt_obj)
            return dt_str[11:16] if ' ' in dt_str else dt_str[:5]

        def format_date_str(date_obj, fmt='%Y-%m-%d'):
            if not date_obj: return None
            if hasattr(date_obj, 'strftime'): return date_obj.strftime(fmt)
            return str(date_obj)[:10]

        def format_full_datetime(dt_obj):
            if not dt_obj: return "null" 
            if hasattr(dt_obj, 'strftime'): return dt_obj.strftime('%Y-%m-%d %H:%M:%S')
            return str(dt_obj)

        emp_os = self.os_active
        emp_ob = self.ob_employee

        emp_code = str(self.employee_id)
        emp_name = None
        gender = None
        subcom = None
        cc = None
        emp_type = None

        if emp_os:
            emp_code = emp_os.employee_code or str(self.employee_id)
            emp_name = emp_os.employee_name
            gender = emp_os.gender
            subcom = emp_os.sub_company_name
            cc = emp_os.cc_name
            emp_type = emp_os.type_worker or 'OS'

        elif emp_ob:
            emp_code = getattr(emp_ob, 'employee_id', str(self.employee_id))
            emp_name = getattr(emp_ob, 'employee_name', None)
            gender = getattr(emp_ob, 'gender', None)
            subcom = getattr(emp_ob, 'company_name', 'CRS')

            if getattr(emp_ob, 'cc_master', None) and getattr(emp_ob.cc_master, 'org_name', None):
                cc = emp_ob.cc_master.org_name
            else:
                cc = getattr(emp_ob, 'cost_center', None)
            emp_type = 'TETAP/KONTRAK'

        bac = self.bac_os_data[-1] if self.bac_os_data and len(self.bac_os_data) > 0 else None

        return {
            "employee_id": self.employee_id,
            "employee_code": emp_code,
            "employee_name": emp_name,
            "gender": gender,
            "subCom": subcom,
            "card": self.card_id,
            "cc": cc,
            "type": emp_type,
            "v_clocking_date": format_date_str(self.clocking_date, '%d %b %Y'),
            "clocking_date": format_date_str(self.clocking_date, '%Y-%m-%d'),
            "clock_in": format_time_str(self.clock_in),
            "clock_out": format_time_str(self.clock_out),
            
            # ---> DITAMBAHKAN KEMBALI AGAR REACT BISA MERENDER TIMESTAMP LENGKAP <---
            "full_clock_in": format_full_datetime(self.clock_in),
            "full_clock_out": format_full_datetime(self.clock_out),            
            "is_anomaly": self.flag_anomaly,

            "bac_id": bac.id if bac else None,
            "bac_no": bac.bac_no if bac else None,
            "bac_ket": bac.bac_ket if bac else None,
            "bac_clock_in": bac.clock_in.strftime('%Y-%m-%dT%H:%M') if (bac and bac.clock_in) else None,
            "bac_clock_out": bac.clock_out.strftime('%Y-%m-%dT%H:%M') if (bac and bac.clock_out) else None,
            "bac_status": bac.status if bac else None,
            "bac_updated_by": bac.created_by if bac else None,
            "bac_updated_date": bac.created_date.strftime('%d %b %Y') if (bac and bac.created_date) else None,
        }