from flask import session
from sqlalchemy import event
from datetime import datetime, timezone, timedelta
from extensions import db

def get_wib_now():
    return datetime.now(timezone(timedelta(hours=7)))

class AuditMixin(object):
    created_date = db.Column(db.DateTime, default=get_wib_now) 
    modified_date = db.Column(db.DateTime, onupdate=get_wib_now)
    created_by = db.Column(db.String(50))
    modified_by = db.Column(db.String(50))

    @staticmethod
    def register_audit_events(cls):
        @event.listens_for(cls, 'before_insert')
        def before_insert(mapper, connection, target):
            curr_user = session.get('user', {}).get('username', 'System')
            target.created_by = curr_user

        @event.listens_for(cls, 'before_update')
        def before_update(mapper, connection, target):
            target.modified_by = session.get('user', {}).get('username', 'System')