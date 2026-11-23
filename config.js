/* config.js : satu-satunya file yang perlu Anda isi setelah deploy Apps Script. */
window.ARUKALA_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbw-JBG44X8NxMoMOh6sS2WHWBQWyjg_5JthHPfs3magbNRmvQdVQMDOlIpCmhvuIOyv/exec',                       // tempel URL Web App Apps Script (berakhiran /exec) di sini
  QUICK_USERS: ['aldo', 'zidan'],    // username staff yang tampil sebagai tombol cepat di tablet kasir
  IDLE_LOCK_MIN: 5,                  // layar terkunci otomatis (staff) setelah menit ini tanpa disentuh
  OWNER_IDLE_LOCK_MIN: 15,
  TIMEOUT_MS: 25000,
  VERSION: '4A-2'
};
