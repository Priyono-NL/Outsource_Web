import React, { useState, useEffect } from 'react';
import api from '../api/api';

const RolePermission = () => {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [menuList, setMenuList] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});

  const [loading, setLoading] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);

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
      alert('Gagal memuat master data: ' + (err.response?.data?.message || err.message));
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
      alert('Gagal mengambil detail hak akses role');
    } finally {
      setLoading(false);
    }
  };

  // 3. Toggle Checkbox (Dengan Logika Top-Down & Bottom-Up)
  const handlePermissionChange = (menuId, field, isChecked) => {
    setRolePermissions(prev => {
      const updated = { ...prev };
      
      // Helper untuk memastikan object state ada
      const ensureInit = (id) => {
        if (!updated[id]) updated[id] = { can_view: false, can_create: false, can_edit: false, can_delete: false };
      };

      ensureInit(menuId);
      updated[menuId] = { ...updated[menuId], [field]: isChecked };

      const currentMenu = menuList.find(m => m.id === menuId);
      const isFolder = !currentMenu.path;

      // LOGIKA 1 (TOP-DOWN): Jika FOLDER di-klik 'View'-nya
      if (isFolder && field === 'can_view') {
        // Cari semua sub-menu di bawah folder ini
        const children = menuList.filter(m => m.parent_id === menuId);
        
        children.forEach(child => {
          ensureInit(child.id);
          // Jika folder dicentang -> centang SEMUA aksi anaknya. Jika dihapus -> hapus semua.
          updated[child.id] = {
            can_view: isChecked,
            can_create: isChecked,
            can_edit: isChecked,
            can_delete: isChecked
          };
        });
      }

      // LOGIKA 2: Jika View dimatikan pada menu biasa, matikan semua aksi CRUD lainnya
      if (field === 'can_view' && !isChecked) {
        updated[menuId].can_create = false;
        updated[menuId].can_edit = false;
        updated[menuId].can_delete = false;
      }

      // LOGIKA 3 (BOTTOM-UP): Jika centang Create/Edit/Delete, pastikan View menu tersebut aktif
      if (field !== 'can_view' && isChecked) {
        updated[menuId].can_view = true;
      }

      // LOGIKA 4 (BOTTOM-UP FOLDER): Jika anak menu dicentang apapun, pastikan Folder Induknya ikut tercentang View-nya!
      if (isChecked && currentMenu.parent_id) {
        ensureInit(currentMenu.parent_id);
        updated[currentMenu.parent_id].can_view = true;
      }

      return updated;
    });
  };

  // 4. LOGIKA CHECKLIST ALL PER KOLOM (View, Create, Edit, Delete)
  const handleSelectAllColumn = (field, isChecked) => {
    const updated = { ...rolePermissions };
    menuList.forEach(m => {
      if (!updated[m.id]) {
        updated[m.id] = { can_view: false, can_create: false, can_edit: false, can_delete: false };
      }

      // Khusus folder (tidak ada path), hanya bisa View
      const isFolder = !m.path;

      if (field === 'can_view') {
        updated[m.id].can_view = isChecked;
        if (!isChecked) {
          updated[m.id].can_create = false;
          updated[m.id].can_edit = false;
          updated[m.id].can_delete = false;
        }
      } else if (!isFolder) {
        // Jika centang Create/Edit/Delete, pastikan View-nya ikut aktif
        if (isChecked) updated[m.id].can_view = true;
        updated[m.id][field] = isChecked;
      }
    });
    setRolePermissions(updated);
  };

  // Status Checklist All Header (Checked / Unchecked / Indeterminate)
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
        setShowSuccessAlert(true);
        setTimeout(() => setShowSuccessAlert(false), 3000);
      }
    } catch (err) {
      alert('Gagal menyimpan konfigurasi: ' + (err.response?.data?.message || err.message));
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
      }
    } catch (err) {
      alert('Gagal membuat role baru');
    }
  };

  return (
    <div className="container-fluid py-3">
      {showSuccessAlert && (
        <div className="alert alert-success border-0 shadow-sm mb-3 d-flex align-items-center fade show" role="alert">
          <i className="bi bi-check-circle-fill me-2 fs-5"></i>
          <div>Hak akses role berhasil diperbarui!</div>
        </div>
      )}

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
                  <button className="btn btn-primary" type="submit">
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
                  <i className="bi bi-floppy me-2"></i>
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>

              <div className="card-body p-4">
                <div className="table-responsive">
                  <table className="table table-hover align-middle border">
                    <thead className="table-dark">
                      <tr>
                        <th>Modul / Menu Aplikasi</th>

                        {/* HEADER CHECKLIST ALL: VIEW */}
                        <th className="text-center" style={{ width: '100px' }}>
                          View <br />
                          <input 
                            type="checkbox" 
                            className="form-check-input mt-1" 
                            checked={getColumnCheckStatus('can_view').checked}
                            ref={el => el && (el.indeterminate = getColumnCheckStatus('can_view').indeterminate)}
                            onChange={(e) => handleSelectAllColumn('can_view', e.target.checked)} 
                            title="Checklist All View"
                          />
                        </th>

                        {/* HEADER CHECKLIST ALL: CREATE */}
                        <th className="text-center" style={{ width: '100px' }}>
                          Create <br />
                          <input 
                            type="checkbox" 
                            className="form-check-input mt-1" 
                            checked={getColumnCheckStatus('can_create').checked}
                            ref={el => el && (el.indeterminate = getColumnCheckStatus('can_create').indeterminate)}
                            onChange={(e) => handleSelectAllColumn('can_create', e.target.checked)} 
                            title="Checklist All Create"
                          />
                        </th>

                        {/* HEADER CHECKLIST ALL: EDIT */}
                        <th className="text-center" style={{ width: '100px' }}>
                          Edit <br />
                          <input 
                            type="checkbox" 
                            className="form-check-input mt-1" 
                            checked={getColumnCheckStatus('can_edit').checked}
                            ref={el => el && (el.indeterminate = getColumnCheckStatus('can_edit').indeterminate)}
                            onChange={(e) => handleSelectAllColumn('can_edit', e.target.checked)} 
                            title="Checklist All Edit"
                          />
                        </th>

                        {/* HEADER CHECKLIST ALL: DELETE */}
                        <th className="text-center" style={{ width: '100px' }}>
                          Delete <br />
                          <input 
                            type="checkbox" 
                            className="form-check-input mt-1" 
                            checked={getColumnCheckStatus('can_delete').checked}
                            ref={el => el && (el.indeterminate = getColumnCheckStatus('can_delete').indeterminate)}
                            onChange={(e) => handleSelectAllColumn('can_delete', e.target.checked)} 
                            title="Checklist All Delete"
                          />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {menuList.map(menu => {
                        const perm = rolePermissions[menu.id] || { can_view: false, can_create: false, can_edit: false, can_delete: false };
                        const isFolder = !menu.path;

                        return (
                          <tr key={menu.id} className={isFolder ? 'table-secondary fw-bold' : ''}>
                            <td style={{ paddingLeft: menu.parent_id ? '2.5rem' : '1rem' }}>
                              <i className={`bi ${menu.icon || 'bi-folder'} me-2`}></i>
                              {menu.title}
                              {isFolder && <span className="badge bg-secondary ms-2">Folder</span>}
                            </td>
                            <td className="text-center">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={perm.can_view}
                                onChange={() => handlePermissionChange(menu.id, 'can_view')}
                              />
                            </td>
                            <td className="text-center">
                              {!isFolder && (
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  disabled={!perm.can_view}
                                  checked={perm.can_create}
                                  onChange={() => handlePermissionChange(menu.id, 'can_create')}
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
                                  onChange={() => handlePermissionChange(menu.id, 'can_edit')}
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
                                  onChange={() => handlePermissionChange(menu.id, 'can_delete')}
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
            <div className="card shadow-sm border-0 text-center p-5">
              <div className="card-body">
                <i className="bi bi-hand-index-thumb text-muted display-4 mb-3 d-block"></i>
                <h5>Pilih Role Terlebih Dahulu</h5>
                <p className="text-muted">Klik salah satu role di panel sebelah kiri untuk mengatur hak akses modul aplikasi.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RolePermission;