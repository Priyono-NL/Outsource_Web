// src/utils/useCrudPage.js
// Custom hook — menghilangkan repeat state & handler di 14 pages
import { useState } from 'react';

export function useCrudPage() {
  const [showForm, setShowForm]       = useState(false);
  const [refreshKey, setRefreshKey]   = useState(0);
  const [editingData, setEditingData] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const handleSearch  = () => setAppliedSearch(searchInput);
  const handleRefresh = () => setRefreshKey(k => k + 1);
  const handleAdd     = () => { setEditingData(null); setShowForm(true); };
  const handleEdit    = (data) => { setEditingData(data); setShowForm(true); };
  const handleClose   = () => setShowForm(false);

  return {
    showForm, refreshKey, editingData,
    searchInput, setSearchInput,
    appliedSearch,
    handleSearch, handleRefresh,
    handleAdd, handleEdit, handleClose,
  };
}
