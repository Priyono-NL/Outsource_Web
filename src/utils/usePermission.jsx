import { useState, useEffect, useCallback } from 'react';
import api from '../api/api';

let cachedPaths = null;

export function usePermission() {
  const [allowedPaths, setAllowedPaths] = useState(cachedPaths || []);
  const [loadingPerm, setLoadingPerm] = useState(!cachedPaths);

  const fetchPermissions = useCallback(async () => {
    if (cachedPaths) return;

    try {
      const res = await api.get('/permissions/my');
      cachedPaths = res.data.allowed_paths;
      setAllowedPaths(cachedPaths);
    } catch (err) {
      setAllowedPaths(['/']);
    } finally {
      setLoadingPerm(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Cek apakah path tertentu boleh diakses
  const canAccess = (path) => allowedPaths.includes(path);

  // Filter routesConfig — hanya return menu yang boleh diakses
  const filterRoutes = (routes) =>
    routes.filter((r) => allowedPaths.includes(r.path));

  // Reset cache saat logout atau permission berubah
  const resetCache = () => {
    cachedPaths = null;
    setAllowedPaths([]);
  };

  return { allowedPaths, loadingPerm, canAccess, filterRoutes, resetCache };
}
