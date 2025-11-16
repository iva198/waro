// i18n/indonesia.js - Indonesian language translations
const indonesia = {
  // General messages
  success: 'Berhasil',
  error: 'Kesalahan',
  notFound: 'Tidak ditemukan',
  serverError: 'Terjadi kesalahan server',
  badRequest: 'Permintaan tidak valid',
  
  // Sales related
  sales: {
    created: 'Penjualan berhasil dibuat',
    notFound: 'Penjualan tidak ditemukan',
    missingRequiredFields: 'Kolom wajib tidak boleh kosong: tenant_id, store_id, atau sale_items',
    invalidSaleItems: 'Setiap item penjualan harus memiliki product_id, qty, dan unit_price_cents',
    fetchError: 'Gagal mengambil data penjualan',
    createError: 'Gagal membuat penjualan'
  },
  
  // Products related
  products: {
    notFound: 'Produk tidak ditemukan',
    created: 'Produk berhasil dibuat',
    updated: 'Produk berhasil diperbarui',
    deleted: 'Produk berhasil dihapus'
  },
  
  // Payments related
  payments: {
    notFound: 'Pembayaran tidak ditemukan',
    created: 'Pembayaran berhasil dibuat',
    statusUpdated: 'Status pembayaran diperbarui'
  },
  
  // Inventory related
  inventory: {
    updated: 'Stok berhasil diperbarui',
    adjustmentCreated: 'Penyesuaian stok berhasil dibuat'
  },
  
  // General validation
  validation: {
    required: 'Kolom ini wajib diisi',
    invalidFormat: 'Format tidak valid',
    mustBeNumber: 'Harus berupa angka',
    mustBePositive: 'Harus berupa angka positif'
  },
  
  // Database related
  database: {
    connectionError: 'Gagal terhubung ke database',
    queryError: 'Gagal menjalankan query database'
  },

  // Authentication related
  auth: {
    register_success: 'Pendaftaran berhasil',
    login_success: 'Login berhasil',
    email_exists: 'Email sudah terdaftar',
    username_exists: 'Username sudah digunakan',
    phone_exists: 'Nomor telepon sudah terdaftar',
    invalid_credentials: 'Email, username, atau password salah',
    account_inactive: 'Akun tidak aktif',
    register_error: 'Gagal mendaftar',
    login_error: 'Gagal login',
    profile_info: 'Informasi profil',
    profile_error: 'Gagal mengambil profil',
    profile_updated: 'Profil berhasil diperbarui',
    profile_picture_updated: 'Foto profil berhasil diperbarui',
    store_updated: 'Informasi toko berhasil diperbarui',
    password_change_success: 'Password berhasil diubah',
    password_change_error: 'Gagal mengubah password',
    phone_verification_sent: 'Kode verifikasi telah dikirim ke nomor Anda',
    email_verification_sent: 'Kode verifikasi telah dikirim ke email Anda',
    password_reset_sent: 'Instruksi reset password telah dikirim ke email Anda',
    invalid_verification_code: 'Kode verifikasi tidak valid atau telah kadaluarsa',
    phone_verified: 'Nomor telepon berhasil diverifikasi',
    email_verified: 'Email berhasil diverifikasi',
    account_deleted: 'Akun telah dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.',
    google_login_failed: 'Gagal login dengan Google',
    otp_sent: 'Kode OTP telah dikirim',
    invalid_otp: 'Kode OTP tidak valid',
    otp_expired: 'Kode OTP telah kadaluarsa',
    email_verification_failed: 'Verifikasi email gagal',
    invalid_verification_link: 'Tautan verifikasi tidak valid atau telah kadaluarsa'
  },

  // Subscription related
  subscription: {
    plans_fetched: 'Daftar paket langganan berhasil diambil',
    plan_not_found: 'Paket langganan tidak ditemukan',
    subscription_success: 'Berhasil berlangganan',
    subscription_updated: 'Langganan berhasil diperbarui',
    subscription_cancelled: 'Langganan berhasil dibatalkan',
    subscription_error: 'Gagal memproses langganan',
    invalid_plan: 'Paket tidak valid',
    already_subscribed: 'Anda sudah memiliki langganan aktif',
    insufficient_permissions: 'Izin tidak mencukupi untuk melakukan aksi ini',
    max_cashiers_reached: 'Jumlah maksimum kasir telah tercapai',
    max_stores_reached: 'Jumlah maksimum toko telah tercapai',
    payment_required: 'Pembayaran diperlukan untuk paket ini',
    billing_info_updated: 'Informasi pembayaran berhasil diperbarui',
    invoice_generated: 'Faktur berhasil dibuat'
  },

  // Inventory related
  inventory: {
    products_listed: 'Produk berhasil diambil',
    product_created: 'Produk berhasil dibuat',
    product_info: 'Informasi produk berhasil diambil',
    product_updated: 'Produk berhasil diperbarui',
    product_deleted: 'Produk berhasil dihapus',
    operation_error: 'Gagal memproses operasi inventaris',
    product_not_found: 'Produk tidak ditemukan',
    invalid_format: 'Format tidak valid',
    negative_stock_error: 'Stok tidak boleh negatif setelah penyesuaian',
    stock_adjusted: 'Stok berhasil disesuaikan',
    low_stock_listed: 'Produk dengan stok rendah berhasil diambil',
    movements_listed: 'Pergerakan inventaris berhasil diambil',
    max_cashiers_reached: 'Jumlah maksimal kasir telah tercapai',
    max_stores_reached: 'Jumlah maksimal toko telah tercapai',
    insufficient_permissions: 'Izin tidak mencukup untuk melakukan aksi ini',
    already_subscribed: 'Anda sudah memiliki langganan aktif',
    invalid_plan: 'Paket tidak valid'
  }
};

module.exports = indonesia;