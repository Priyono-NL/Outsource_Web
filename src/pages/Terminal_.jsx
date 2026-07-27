import React from 'react';
import { useCrudPage } from '../utils/useCrudPage';
import PageHeader from '../components/PageHeader';
import Terminal_table from '../components/terminal/terminal_table';

const Terminal = () => {
  const crud = useCrudPage();

  return (
    <div>
      <PageHeader
        title="Master Terminal"
        searchPlaceholder="Cari Terminal ID..."
        searchValue={crud.searchInput}
        onSearchChange={crud.setSearchInput}
        onSearch={crud.handleSearch}
      >
 
      </PageHeader>

      <div className="app-card">
        <Terminal_table
          refreshTrigger={crud.refreshKey}
          searchTerm={crud.appliedSearch}
        />
      </div>
    </div>
  );
};
export default Terminal;
