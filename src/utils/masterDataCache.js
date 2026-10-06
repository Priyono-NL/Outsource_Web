// src/utils/masterDataCache.js
import api from '../api/api';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit

let subCompaniesCache = {
  data: null,
  timestamp: 0,
  promise: null,
};

let costCentersCache = {
  data: null,
  timestamp: 0,
  promise: null,
};

/**
 * Mengambil daftar master subcompany dengan in-memory caching.
 * Mencegah request duplicate saat navigasi antar halaman.
 */
export async function getCachedSubCompanies(pageSize = 200, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && subCompaniesCache.data && now - subCompaniesCache.timestamp < CACHE_TTL_MS) {
    return subCompaniesCache.data;
  }

  if (subCompaniesCache.promise && !forceRefresh) {
    return subCompaniesCache.promise;
  }

  subCompaniesCache.promise = api
    .get(`/subcom?page=1&pageSize=${pageSize}`)
    .then((res) => {
      const items = res.data?.data || [];
      subCompaniesCache.data = items;
      subCompaniesCache.timestamp = Date.now();
      subCompaniesCache.promise = null;
      return items;
    })
    .catch((err) => {
      subCompaniesCache.promise = null;
      throw err;
    });

  return subCompaniesCache.promise;
}

/**
 * Mengambil daftar master cost center dengan in-memory caching.
 */
export async function getCachedCostCenters(pageSize = 200, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && costCentersCache.data && now - costCentersCache.timestamp < CACHE_TTL_MS) {
    return costCentersCache.data;
  }

  if (costCentersCache.promise && !forceRefresh) {
    return costCentersCache.promise;
  }

  costCentersCache.promise = api
    .get(`/costcenter?page=1&pageSize=${pageSize}`)
    .then((res) => {
      const items = res.data?.data || [];
      costCentersCache.data = items;
      costCentersCache.timestamp = Date.now();
      costCentersCache.promise = null;
      return items;
    })
    .catch((err) => {
      costCentersCache.promise = null;
      throw err;
    });

  return costCentersCache.promise;
}

/**
 * Reset cache jika ada penambahan/perubahan/penghapusan master data.
 */
export function invalidateMasterDataCache() {
  subCompaniesCache = { data: null, timestamp: 0, promise: null };
  costCentersCache = { data: null, timestamp: 0, promise: null };
}

