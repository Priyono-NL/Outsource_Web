from extensions import db

class Role(db.Model):
    __tablename__ = 'hr_roles'
    id = db.Column(db.Integer, primary_key=True)
    role_name = db.Column(db.String(100), nullable=False)

class UserSubcompanyAccess(db.Model):
    __tablename__ = 'hr_user_subcompany_access'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('hr_users.id'), nullable=False)
    sub_company_id = db.Column(db.String(50), nullable=False)

class UserCostCenterAccess(db.Model):
    __tablename__ = 'hr_user_cost_center_access'    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('hr_users.id'), nullable=False)
    cost_center_id = db.Column(db.Integer, db.ForeignKey('org_cost_center.id'), nullable=False)

class User(db.Model):
    __tablename__ = 'hr_users'
    id = db.Column(db.Integer, primary_key=True)
    sso_user_id = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), nullable=True)
    nama = db.Column(db.String(150), nullable=True)
    department = db.Column(db.String(100), nullable=True)
    role_sso = db.Column(db.String(50), nullable=True)
    local_role_id = db.Column(db.Integer, db.ForeignKey('hr_roles.id'), nullable=True)
    status = db.Column(db.String(20), default='pending')

class AppMenu(db.Model):
    __tablename__ = 'hr_app_menus'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    path = db.Column(db.String(100), nullable=True)
    icon = db.Column(db.String(50), nullable=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('hr_app_menus.id'), nullable=True)
    group_no = db.Column(db.Integer, default=1)
    order_no = db.Column(db.Integer, default=0)

class RoleMenuPermission(db.Model):
    __tablename__ = 'hr_role_menu_permissions'
    id = db.Column(db.Integer, primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey('hr_roles.id'), nullable=False)
    menu_id = db.Column(db.Integer, db.ForeignKey('hr_app_menus.id'), nullable=False)
    can_view = db.Column(db.Boolean, default=True)
    can_create = db.Column(db.Boolean, default=False)
    can_edit = db.Column(db.Boolean, default=False)
    can_delete = db.Column(db.Boolean, default=False)
