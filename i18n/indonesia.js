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
  }
};

module.exports = indonesia;