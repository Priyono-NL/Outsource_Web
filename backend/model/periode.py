from extensions import db
from model.base import AuditMixin

# 1. TABEL HEADER (PARENT)
class periode(db.Model, AuditMixin):
    __tablename__ = 'periode_puasa'
    periode_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    periode_name = db.Column(db.String(100))
    tahun = db.Column(db.Integer)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)

    def to_dict(self):
        return {
            'periode_id': self.periode_id,
            'periode_name': self.periode_name,
            'tahun': self.tahun,
            'start_date': self.start_date.strftime('%Y-%m-%d') if hasattr(self.start_date, 'strftime') else None,
            'v_start_date': self.start_date.strftime('%d %b %Y') if hasattr(self.start_date, 'strftime') else None,
            'end_date': self.end_date.strftime('%Y-%m-%d') if hasattr(self.end_date, 'strftime') else None,
            'v_end_date': self.end_date.strftime('%d %b %Y') if hasattr(self.end_date, 'strftime') else None,
        }

# 2. TABEL FASE (CHILD 1)
class PeriodePhase(db.Model):
    __tablename__ = 'periode_puasa_phases'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    periode_id = db.Column(db.Integer, db.ForeignKey('periode_puasa.periode_id', ondelete='CASCADE'))
    name = db.Column(db.String(100))
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)

# 3. TABEL JADWAL/SHIFT (CHILD 2)
class PeriodeSchedule(db.Model):
    __tablename__ = 'periode_puasa_schedules'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    periode_id = db.Column(db.Integer, db.ForeignKey('periode_puasa.periode_id', ondelete='CASCADE'))
    shift_type = db.Column(db.String(50))
    target_shift = db.Column(db.String(50))

# 4. TABEL JAM / MAPPING WAKTU (CUCU)
class PeriodeTime(db.Model):
    __tablename__ = 'periode_puasa_times'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    schedule_id = db.Column(db.Integer, db.ForeignKey('periode_puasa_schedules.id', ondelete='CASCADE'))
    phase_id = db.Column(db.Integer, db.ForeignKey('periode_puasa_phases.id', ondelete='CASCADE'))
    start_time = db.Column(db.String(10)) # Format HH:MM
    end_time = db.Column(db.String(10))   # Format HH:MM

AuditMixin.register_audit_events(periode)