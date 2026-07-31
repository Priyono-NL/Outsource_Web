from extensions import db

class Absensi_all(db.Model):
    __table_args__ = {'schema': 'db-webapps'}
    __tablename__ = 'TBL_ATTENDANCE'
    
    # Composite Primary Key untuk ORM mapping
    employee_id = db.Column(db.Integer, primary_key=True)
    clocking_date = db.Column(db.Date, primary_key=True)    
    
    clock_in = db.Column(db.DateTime)
    clock_out = db.Column(db.DateTime)

    # 1. Relasi ke OS / Outsource
    employement = db.relationship(
        'OsEmployment', 
        primaryjoin="cast(Absensi_all.employee_id, String) == cast(OsEmployment.employee_code, String)",
        foreign_keys=[employee_id],
        lazy=True,
        uselist=False,
        viewonly=True
    )
    
    # 2. Relasi ke Organic / Internal (Sesuaikan nama kolom NRP jika di ObEmployee menggunakan employee_code)
    ob_employee = db.relationship(
        'ObEmployee',
        primaryjoin="cast(Absensi_all.employee_id, String) == cast(ObEmployee.employee_id, String)",
        foreign_keys=[employee_id],
        lazy=True,
        uselist=False,
        viewonly=True,
        overlaps="employement"
    )

    def to_dict(self):
        emp_os = self.employement
        emp_ob = self.ob_employee

        # Variable penampung
        emp_code = str(self.employee_id)
        emp_name = None
        gender = None
        subcom = None
        card = None
        cc = None
        emp_type = None

        # ---------------------------------------------------------------------
        # LOGIKA FALLBACK: Cek OS Karyawan dulu, jika Kosong Baru Cek Organic
        # ---------------------------------------------------------------------
        if emp_os:
            emp_code = emp_os.employee_code or str(self.employee_id)
            emp_name = emp_os.person.name if getattr(emp_os, 'person', None) else None
            gender = emp_os.person.gender if getattr(emp_os, 'person', None) else None
            subcom = emp_os.sub_con.sub_company_name if getattr(emp_os, 'sub_con', None) else None
            card = emp_os.OsCard[0].card_number if (getattr(emp_os, 'OsCard', None) and len(emp_os.OsCard) > 0) else None
            cc = emp_os.OsCC[0].cc_master.org_name if (getattr(emp_os, 'OsCC', None) and len(emp_os.OsCC) > 0 and getattr(emp_os.OsCC[0], 'cc_master', None)) else None
            emp_type = emp_os.OsType[0].type_worker if (getattr(emp_os, 'OsType', None) and len(emp_os.OsType) > 0) else 'OS'

        elif emp_ob:
            # Ambil properti dari ObEmployee (Safe Navigation pakai getattr)
            emp_code = getattr(emp_ob, 'employee_id', None)
            emp_name = getattr(emp_ob, 'employee_name', None)
            gender = getattr(emp_ob, 'gender', None)
            subcom = getattr(emp_ob, 'company_name', 'CRS')
            card = getattr(emp_ob, 'card_no', None)
            cc = getattr(emp_ob, 'cost_center', None)
            emp_type = 'TETAP/KONTRAK'

        # Helper pemformatan waktu (HH:mm)
        def format_time_str(dt_obj):
            if not dt_obj:
                return None
            if hasattr(dt_obj, 'strftime'):
                return dt_obj.strftime('%H:%M')
            dt_str = str(dt_obj)
            return dt_str[11:16] if ' ' in dt_str else dt_str[:5]

        # Helper pemformatan tanggal
        def format_date_str(date_obj, fmt='%Y-%m-%d'):
            if not date_obj:
                return None
            if hasattr(date_obj, 'strftime'):
                return date_obj.strftime(fmt)
            return str(date_obj)

        return {
            "employee_id": self.employee_id,
            "employee_code": emp_code,
            "employee_name": emp_name,
            "gender": gender,
            "subCom": subcom,
            "card": card,
            "cc": cc,
            "type": emp_type,
            "v_clocking_date": format_date_str(self.clocking_date, '%d %b %Y'),
            "clocking_date": format_date_str(self.clocking_date, '%Y-%m-%d'),
            "clock_in": format_time_str(self.clock_in),
            "clock_out": format_time_str(self.clock_out),
        }