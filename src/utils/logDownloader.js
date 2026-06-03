/**
 * Fungsi untuk men-generate dan mendownload file teks berisi log error & catatan.
 * @param {Array} errors - Array berisi pesan error
 * @param {Array} notes - Array berisi pesan catatan/notes
 */
export const downloadLogFile = (errors = [], notes = []) => {
  let logContent = "=========================================\n";
  logContent += "       HASIL UPLOAD LOG REPORT\n";
  logContent += "       Tanggal: " + new Date().toLocaleString() + "\n";
  logContent += "=========================================\n\n";

  if (errors.length > 0) {
    logContent += "--- DAFTAR ERROR (GAGAL DIPROSES) ---\n";
    errors.forEach(err => { logContent += `${err}\n`; });
    logContent += "\n";
  }

  if (notes.length > 0) {
    logContent += "--- CATATAN SISTEM (PENYESUAIAN DATA) ---\n";
    notes.forEach(note => { logContent += `${note}\n`; });
    logContent += "\n";
  }

  logContent += "=========================================\n";
  logContent += "Silakan perbaiki baris yang error pada file Excel Anda lalu upload kembali.\n";

  const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Upload_Log_${new Date().getTime()}.txt`);
  document.body.appendChild(link);
  link.click();
  
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};