import Swal from 'sweetalert2';

// Konfigurasi Toast (Notifikasi Pojok)
export const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
});

// Konfigurasi Konfirmasi (Dialog Tengah untuk Hapus)
export const Confirm = Swal.mixin({
  icon: 'warning',
  showCancelButton: true,
  confirmButtonColor: '#3085d6',
  cancelButtonColor: '#d33',
  confirmButtonText: 'Ya, Lanjutkan!',
  cancelButtonText: 'Batal',
  reverseButtons: true
});

export default Swal;