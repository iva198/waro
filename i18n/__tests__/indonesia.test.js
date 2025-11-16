// i18n/__tests__/indonesia.test.js - Indonesian translation tests
const indonesia = require('../indonesia');

describe('Indonesian Translations', () => {
  test('should have general messages', () => {
    expect(indonesia.success).toBe('Berhasil');
    expect(indonesia.error).toBe('Kesalahan');
    expect(indonesia.notFound).toBe('Tidak ditemukan');
    expect(indonesia.serverError).toBe('Terjadi kesalahan server');
    expect(indonesia.badRequest).toBe('Permintaan tidak valid');
  });

  test('should have sales related messages', () => {
    expect(indonesia.sales).toBeDefined();
    expect(indonesia.sales.created).toBe('Penjualan berhasil dibuat');
    expect(indonesia.sales.notFound).toBe('Penjualan tidak ditemukan');
    expect(indonesia.sales.missingRequiredFields).toBe('Kolom wajib tidak boleh kosong: tenant_id, store_id, atau sale_items');
    expect(indonesia.sales.invalidSaleItems).toBe('Setiap item penjualan harus memiliki product_id, qty, dan unit_price_cents');
    expect(indonesia.sales.fetchError).toBe('Gagal mengambil data penjualan');
    expect(indonesia.sales.createError).toBe('Gagal membuat penjualan');
  });

  test('should have validation messages', () => {
    expect(indonesia.validation).toBeDefined();
    expect(indonesia.validation.required).toBe('Kolom ini wajib diisi');
    expect(indonesia.validation.invalidFormat).toBe('Format tidak valid');
    expect(indonesia.validation.mustBeNumber).toBe('Harus berupa angka');
    expect(indonesia.validation.mustBePositive).toBe('Harus berupa angka positif');
  });

  test('should have database related messages', () => {
    expect(indonesia.database).toBeDefined();
    expect(indonesia.database.connectionError).toBe('Gagal terhubung ke database');
    expect(indonesia.database.queryError).toBe('Gagal menjalankan query database');
  });
});