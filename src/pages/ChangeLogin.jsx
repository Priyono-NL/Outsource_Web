import { useState, useEffect } from 'react';
import api from '../api/api';
import { Confirm, Toast } from '../utils/sweetalert';
import PageHeader from '../components/PageHeader';

const ROLE_BADGE = {
  superadmin: '#ef4444',
  admin:      '#f59e0b',
  manager:    '#22c55e',
  user:       '#94a3b8',
};

export default function ChangeLogin() {
  const [users, setUsers]     = useState([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/impersonate/users');
      setUsers(res.data.users || []);
    } catch {
      Toast.fire({ icon: 'error', title: 'Gagal memuat daftar user' });
    } finally { setLoading(false); }
  };

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleLoginAs = async (user) => {
    const confirmed = await Confirm.fire({
      title: `Login sebagai ${user.full_name}?`,
      html: `Anda akan bertindak sebagai <strong>${user.role_name}</strong>.`,
      icon: 'warning',
      confirmButtonText: 'Ya, Login Sekarang',
      confirmButtonColor: '#3b82f6',
    });
    if (!confirmed.isConfirmed) return;

    try {
      await api.post('/impersonate/login', { target_user_id: user.id });
      await Toast.fire({ icon: 'success', title: `Berhasil login sebagai ${user.full_name}`, timer: 1500 });
      window.location.href = '/';
    } catch (error) {
      Toast.fire({ icon: 'error', title: error.response?.data?.error || 'Gagal menukar token' });
    }
  };

  return (
    <div>
      <PageHeader
        title="Change Login As"
        searchPlaceholder="Cari nama, username, atau email..."
        searchValue={search}
        onSearchChange={setSearch}
      >
        <span className="text-muted-sm">{filteredUsers.length} user</span>
      </PageHeader>

      <div className="app-card">
        {loading ? (
          <div className="empty-state">
            <div className="spinner-border spinner-border-sm text-secondary" role="status" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-people" style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />
            Tidak ada user ditemukan
          </div>
        ) : (
          <div className="table-responsive">
            <table className="app-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: `hsl(${(user.full_name.charCodeAt(0) * 15) % 360}, 55%, 50%)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0,
                        }}>
                          {user.full_name[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{user.full_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--color-text-2)', fontSize: 12 }}>{user.email}</td>
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 99,
                        fontSize: 11, fontWeight: 600,
                        background: `${ROLE_BADGE[user.role_name] || '#94a3b8'}18`,
                        color: ROLE_BADGE[user.role_name] || '#64748b',
                      }}>
                        {user.role_name}
                      </span>
                    </td>
                    <td>
                      {user.is_active
                        ? <span className="badge-active">Aktif</span>
                        : <span className="badge-inactive">Nonaktif</span>}
                    </td>
                    <td>
                      {user.role_name === 'superadmin' ? (
                        <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                          <i className="bi bi-lock me-1" /> Tidak bisa
                        </span>
                      ) : (
                        <button
                          className="btn-app btn-ghost-app btn-sm-app"
                          onClick={() => handleLoginAs(user)}
                          disabled={!user.is_active}
                        >
                          <i className="bi bi-box-arrow-in-right" /> Login As
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
