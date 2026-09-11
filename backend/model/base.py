from flask import request, has_request_context
from sqlalchemy import event
from datetime import datetime, timezone, timedelta
from extensions import db

def get_wib_now():
    return datetime.now(timezone(timedelta(hours=7)))

def get_current_user_email():
    if not has_request_context():
        return 'System'
    user_email = request.headers.get('X-User-Email')
    if user_email:
        return user_email        
    return 'System'

class AuditMixin(object):
    created_date = db.Column(db.DateTime, default=get_wib_now) 
    modified_date = db.Column(db.DateTime, onupdate=get_wib_now, default=get_wib_now)
    created_by = db.Column(db.String(100))
    modified_by = db.Column(db.String(100))

    @staticmethod
    def register_audit_events(cls):
        @event.listens_for(cls, 'before_insert')
        def before_insert(mapper, connection, target):
            user_email = get_current_user_email()
            target.created_by = user_email
            target.modified_by = user_email

        @event.listens_for(cls, 'before_update')
        def before_update(mapper, connection, target):
            target.modified_by = get_current_user_email()