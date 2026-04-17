// src/pages/RolePermission.jsx
import { useState, useEffect } from 'react';
import api from '../api/api';
import { Toast, Confirm } from '../utils/sweetalert';
import PageHeader from '../components/PageHeader';

const GROUP_LABELS = {
  0: 'Dashboard',
  1: 'Employment',
  2: 'OS Input',
  3: 'Master Data',
};

const ROLE_COLORS = {
  superadmin: { bg: '#fee2e2', text: '#b91c1c' },
  admin:      { bg: '#fef9c3', text: '#a16207' },
  manager:    { bg: '#dcfce7', text: '#15803d' },
  user:       { bg: '#f1f5f9', text: '#475569' },
};

export default function RolePermission() {
  const [permissions, setPermissions] = useState({});
  const [menus, setMenus]             = useState([]);
  const [roles, setRoles]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [activeRole, setActiveRole]   = useState('admin');

  useEffect(() => { fetchPermissions(); }, []);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/permissions');
      setPermissions(res.data.permissions);
      setMenus(res.data.menus);
      setRoles(res.data.roles);
    } catch { Toast.fire({ icon: 'error', title: 'Gagal memuat data permission' }); }
    finally { setLoading(false); }
  };

  const handleToggle = (role, path) => {
    if (role === 'superadmin') return;
    setPermissions(prev => ({
      ...prev,
      [role]: { ...prev[role], [path]: !prev[role][path] },
    }));
  };

  const handleToggleGroup = (role, group, value) => {
    if (role === 'superadmin') return;
    const gMenus = menus.filter(m => m.group === group);
    setPermissions(prev => {
      const updated = { ...prev[role] };
      gMenus.forEach(m => { updated[m.path] = value; });
      return { ...prev, [role]: updated };
    });
  };

  const isGroupAllChecked = (role, group) =>
    menus.filter(m => m.group === group).every(m => permissions[role]?.[m.path]);

  const handleSave = async () => {
    const confirmed = await Confirm.fire({ title: 'Simpan Perubahan?', text: 'Permission yang diubah akan langsung berlaku.', icon: 'question' });
    if (!confirmed.isConfirmed) return;
    setSaving(true);
    try {
      await api.post('/permissions', { permissions });
      Toast.fire({ icon: 'success', title: 'Permission berhasil disimpan!' });
    } catch { Toast.fire({ icon: 'error', title: 'Gagal menyimpan permission' }); }
    finally { setSaving(false); }
  };

  const groupedMenus = [0, 1, 2, 3].map(g => ({
    group: g, label: GROUP_LABELS[g], menus: menus.filter(m => m.group === g),
  }));

  if (loading) return (
    <div className="empty-state" style={{ paddingTop: 80 }}>
      <div className="spinner-border spinner-border-sm text-secondary" role="status" />
    </div>
  );

  return (
    <div>
      <PageHeader title="Hak Akses Menu">
        <button className="btn-app btn-primary-app" onClick={handleSave} disabled={saving}>
          {saving
            ? <><span className="spinner-border spinner-border-sm me-1" />Menyimpan...</>
            : <><i className="bi bi-save" /> Simpan</>}
        </button>
      </PageHeader>

      {/* Role tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 0, flexWrap: 'wrap' }}>
        {roles.map(role => {
          const clr = ROLE_COLORS[role] || ROLE_COLORS.user;
          const isActive = activeRole === role;
          return (
            <button
              key={role}
              onClick={() => setActiveRole(role)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px 8px 0 0',
                border: `1px solid ${isActive ? 'var(--color-border)' : 'transparent'}`,
                borderBottom: isActive ? '1px solid var(--color-surface)' : '1px solid var(--color-border)',
                background: isActive ? 'var(--color-surface)' : 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--color-text)' : 'var(--color-text-2)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                position: 'relative',
                zIndex: isActive ? 1 : 0,
                marginBottom: isActive ? -1 : 0,
              }}
            >
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: clr.text }} />
              {role}
              {role === 'superadmin' && <i className="bi bi-lock-fill" style={{ fontSize: 10, color: 'var(--color-text-3)' }} />}
            </button>
          );
        })}
      </div>

      <div className="app-card" style={{ borderRadius: '0 var(--radius-lg) var(--radius-lg) var(--radius-lg)' }}>
        <div style={{ padding: '20px 24px' }}>
          {activeRole === 'superadmin' && (
            <div style={{
              background: '#f1f5f9', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)', padding: '10px 14px',
              fontSize: 13, color: 'var(--color-text-2)', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <i className="bi bi-lock-fill" />
              Super Admin selalu memiliki akses ke semua menu dan tidak dapat diubah.
            </div>
          )}

          {groupedMenus.map(({ group, label, menus: gMenus }) => {
            if (gMenus.length === 0) return null;
            const allChecked = isGroupAllChecked(activeRole, group);
            return (
              <div key={group} style={{ marginBottom: 24 }}>
                {/* Group header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg)', marginBottom: 10,
                  border: '1px solid var(--color-border)',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                    <i className="bi bi-folder me-2" style={{ color: 'var(--color-accent)' }} />{label}
                  </span>
                  {activeRole !== 'superadmin' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--color-text-3)' }}>
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={e => handleToggleGroup(activeRole, group, e.target.checked)}
                        style={{ accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                      />
                      {allChecked ? 'Nonaktifkan semua' : 'Aktifkan semua'}
                    </label>
                  )}
                </div>

                {/* Menu items grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                  {gMenus.map(menu => {
                    const isAllowed = activeRole === 'superadmin' ? true : !!permissions[activeRole]?.[menu.path];
                    return (
                      <div
                        key={menu.path}
                        onClick={() => handleToggle(activeRole, menu.path)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)', border: '1px solid',
                          borderColor: isAllowed ? '#86efac' : 'var(--color-border)',
                          background: isAllowed ? '#f0fdf4' : 'var(--color-surface)',
                          cursor: activeRole !== 'superadmin' ? 'pointer' : 'default',
                          transition: 'all .15s',
                        }}
                      >
                        <i className={`bi ${menu.icon || 'bi-circle'}`}
                           style={{ fontSize: 14, color: isAllowed ? '#16a34a' : 'var(--color-text-3)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{menu.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontFamily: 'monospace' }}>{menu.path}</div>
                        </div>
                        {isAllowed
                          ? <i className="bi bi-check-circle-fill" style={{ color: '#22c55e', flexShrink: 0 }} />
                          : <i className="bi bi-circle" style={{ color: 'var(--color-border-md)', flexShrink: 0 }} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-text-3)' }}>
        <i className="bi bi-info-circle me-1" />
        Perubahan berlaku setelah user login ulang atau refresh halaman.
      </div>
    </div>
  );
}
