import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { Toast } from '../utils/sweetalert'; // Menggunakan standar UX Enterprise

const RolePermission = () => {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [menuList, setMenuList] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});

  const [loading, setLoading] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');

  // 1. Load Master Data (Roles & Menus)
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/roles');
      if (res.data.success) {
        setRoles(res.data.data.roles || []);
        setMenuList(res.data.data.menus || []);
      }
    } catch (err) {
      Toast.fire({ icon: 'error', title: 'Gagal memuat master data', text: err.response?.data?.message || err.message });
    } finally {
      setLoading(false);
    }
  };

  // 2. Load Permissions per Role
  const handleSelectRole = async (role) => {
    setSelectedRole(role);
    setLoading(true);

    try {
      const res = await api.get(`/roles?role_id=${role.id}`);
      if (res.data.success) {
        const permissions = res.data.data.permissions || [];
        const permMap = {};
        permissions.forEach(p => {
          permMap[p.menu_id] = {
            can_view: Boolean(p.can_view),
            can_create: Boolean(p.can_create),
            can_edit: Boolean(p.can_edit),
            can_delete: Boolean(p.can_delete)
          };
        });
        setRolePermissions(permMap);
      }
    } catch (err) {
      Toast.fire({ icon: 'error', title: 'Gagal mengambil detail hak akses' });
    } finally {
      setLoading(false);
    }
  };

  // 3. Toggle Checkbox (Dengan Logika Top-Down & Bottom-Up IMMUTABLE)
  const handlePermissionChange = (menuId, field, isChecked) => {
    setRolePermissions(prev => {
      const updated = { ...prev };
      
      // ENTERPRISE FIX: Helper untuk Deep Copy agar Immutability React terjaga
      const ensureDeepCopy = (id) => {
        updated[id] = updated[id] 
            ? { ...updated[id] } 
            : { can_view: false, can_create: false, can_edit: false, can_delete: false };
      };

      ensureDeepCopy(menuId);
      updated[menuId][field] = isChecked;

      const currentMenu = menuList.find(m => m.id === menuId);
      const isFolder = !currentMenu.path;

      // LOGIKA 1 (TOP-DOWN): Jika FOLDER di-klik 'View'-nya
      if (isFolder && field === 'can_view') {
        const children = menuList.filter(m => m.parent_id === menuId);
        children.forEach(child => {
          ensureDeepCopy(child.id);
          updated[child.id] = {
            can_view: isChecked,
            can_create: isChecked,
            can_edit: isChecked,
            can_delete: isChecked
          };
        });
      }

      // LOGIKA 2: Jika View dimatikan pada menu biasa, matikan semua aksi CRUD
      if (field === 'can_view' && !isChecked) {
        updated[menuId].can_create = false;
        updated[menuId].can_edit = false;
        updated[menuId].can_delete = false;
      }

      // LOGIKA 3 (BOTTOM-UP): Jika centang Create/Edit/Delete, pastikan View menu tersebut aktif
      if (field !== 'can_view' && isChecked) {
        updated[menuId].can_view = true;
      }

      // LOGIKA 4 (BOTTOM-UP FOLDER): Jika anak menu dicentang apapun, Folder Induknya ikut tercentang View
      if (isChecked && currentMenu.parent_id) {
        ensureDeepCopy(currentMenu.parent_id);
        updated[currentMenu.parent_id].can_view = true;
      }

      return updated;
    });
  };

  // 4. LOGIKA CHECKLIST ALL PER KOLOM (IMMUTABLE)
  const handleSelectAllColumn = (field, isChecked) => {
    const updated = { ...rolePermissions };
    
    menuList.forEach(m => {
      updated[m.id] = updated[m.id] 
          ? { ...updated[m.id] } 
          : { can_view: false, can_create: false, can_edit: false, can_delete: false };

      const isFolder = !m.path;

      if (field === 'can_view') {
        updated[m.id].can_view = isChecked;
        if (!isChecked) {
          updated[m.id].can_create = false;
          updated[m.id].can_edit = false;
          updated[m.id].can_delete = false;
        }
      } else if (!isFolder) {
        if (isChecked) updated[m.id].can_view = true;
        updated[m.id][field] = isChecked;
      }
    });
    setRolePermissions(updated);
  };

  // Status Checklist All Header
  const getColumnCheckStatus = (field) => {
    const targetMenus = field === 'can_view' ? menuList : menuList.filter(m => m.path);
    if (targetMenus.length === 0) return { checked: false, indeterminate: false };

    const checkedCount = targetMenus.filter(m => rolePermissions[m.id]?.[field]).length;
    return {
      checked: checkedCount === targetMenus.length,
      indeterminate: checkedCount > 0 && checkedCount < targetMenus.length
    };
  };

  // 5. Simpan Perubahan
  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    
    try {
      setLoading(true);
      const res = await api.post('/roles', {
        action: 'save_permissions',
        role_id: selectedRole.id,
        permissions: rolePermissions
      });

      if (res.data.success) {
        Toast.fire({ icon: 'success', title: 'Hak akses berhasil diperbarui!' });
      }
    } catch (err) {
      Toast.fire({ icon: 'error', title: 'Gagal menyimpan konfigurasi', text: err.response?.data?.message || err.message });
    } finally {
      setLoading(false);
    }
  };

  // 6. Tambah Role Baru
  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    try {
      const res = await api.post('/roles', {
        action: 'create_role',
        role_name: newRoleName
      });

      if (res.data.success) {
        setRoles([...roles, res.data.data]);
        setNewRoleName('');
        Toast.fire({ icon: 'success', title: 'Role berhasil dibuat!' });
      }
    } catch (err) {
      Toast.fire({ icon: 'error', title: 'Gagal membuat role baru' });
    }
  };

  return (
    <div className="container-fluid py-3">
      <div className="row g-3">
        {/* PANEL KIRI: DAFTAR ROLE */}
        <div className="col-md-4 col-lg-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-dark text-white py-3">
              <h6 className="mb-0 fw-bold"><i className="bi bi-shield-lock me-2"></i>Daftar Role</h6>
            </div>
            <div className="card-body p-2">
              <form onSubmit={handleCreateRole} className="mb-3 p-2">
                <div className="input-group input-group-sm">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Nama Role Baru..."
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                  />
                  <button className="btn btn-primary" type="submit" disabled={!newRoleName.trim()}>
                    <i className="bi bi-plus-lg"></i>
                  </button>
                </div>
              </form>

              <div className="list-group list-group-flush" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                {roles.map(role => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleSelectRole(role)}
                    className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2 px-3 border-0 rounded-2 mb-1 ${selectedRole?.id === role.id ? 'active fw-bold' : ''}`}
                  >
                    <span><i className="bi bi-person-badge me-2"></i>{role.role_name}</span>
                    <i className="bi bi-chevron-right small"></i>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* PANEL KANAN: MATRIKS PERMISSION */}
        <div className="col-md-8 col-lg-9">
          {selectedRole ? (
            <div className="card shadow-sm border-0">
              <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center border-bottom">
                <div>
                  <h5 className="mb-0 fw-bold text-primary">
                    Konfigurasi Hak Akses: <span className="text-dark">{selectedRole.role_name}</span>
                  </h5>
                  <small className="text-muted">Kelola matriks menu dan tombol aksi (CRUD) untuk role ini.</small>
                </div>
                <button 
                  className="btn btn-success fw-bold px-4" 
                  onClick={handleSavePermissions}
                  disabled={loading}
                >
                  {loading ? (
                    <><span className="spinner-border spinner-border-sm me-2"></span>Menyimpan...</>
                  ) : (
                    <><i className="bi bi-floppy me-2"></i>Simpan Perubahan</>
                  )}
                </button>
              </div>

              <div className="card-body p-4">
                <div className="table-responsive">
                  <table className="table table-hover align-middle border">
                    <thead className="table-dark">
                      <tr>
                        <th>Modul / Menu Aplikasi</th>
                        {['can_view', 'can_create', 'can_edit', 'can_delete'].map(action => (
                          <th key={action} className="text-center" style={{ width: '100px' }}>
                            {action.replace('can_', '').charAt(0).toUpperCase() + action.replace('can_', '').slice(1)} <br />
                            <input 
                              type="checkbox" 
                              className="form-check-input mt-1" 
                              checked={getColumnCheckStatus(action).checked}
                              ref={el => el && (el.indeterminate = getColumnCheckStatus(action).indeterminate)}
                              onChange={(e) => handleSelectAllColumn(action, e.target.checked)} 
                              title={`Checklist All ${action}`}
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {menuList.map(menu => {
                        const perm = rolePermissions[menu.id] || { can_view: false, can_create: false, can_edit: false, can_delete: false };
                        const isFolder = !menu.path;

                        return (
                          <tr key={menu.id} className={isFolder ? 'table-secondary fw-bold' : ''}>
                            <td style={{ paddingLeft: menu.parent_id ? '2.5rem' : '1rem' }}>
                              <i className={`bi ${menu.icon || 'bi-folder'} me-2 text-primary`}></i>
                              {menu.title}
                              {isFolder && <span className="badge bg-secondary ms-2">Folder</span>}
                            </td>
                            {/* FIX PADA PARAMETER KETIGA UNTUK MENGIRIMKAN BOOLEAN CHECKED-NYA */}
                            <td className="text-center">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={perm.can_view}
                                onChange={(e) => handlePermissionChange(menu.id, 'can_view', e.target.checked)}
                              />
                            </td>
                            <td className="text-center">
                              {!isFolder && (
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  disabled={!perm.can_view}
                                  checked={perm.can_create}
                                  onChange={(e) => handlePermissionChange(menu.id, 'can_create', e.target.checked)}
                                />
                              )}
                            </td>
                            <td className="text-center">
                              {!isFolder && (
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  disabled={!perm.can_view}
                                  checked={perm.can_edit}
                                  onChange={(e) => handlePermissionChange(menu.id, 'can_edit', e.target.checked)}
                                />
                              )}
                            </td>
                            <td className="text-center">
                              {!isFolder && (
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  disabled={!perm.can_view}
                                  checked={perm.can_delete}
                                  onChange={(e) => handlePermissionChange(menu.id, 'can_delete', e.target.checked)}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="card shadow-sm border-0 text-center p-5 h-100 d-flex justify-content-center align-items-center bg-light">
              <div className="card-body">
                <i className="bi bi-person-gear text-secondary display-1 mb-3 d-block"></i>
                <h4 className="text-dark fw-bold">Pilih Role Terlebih Dahulu</h4>
                <p className="text-muted">Klik salah satu role di panel sebelah kiri untuk mengatur matrikulasi hak akses modul sistem.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RolePermission;