SPEC-01 – WarO (POS Warung Online)

Background

Nama Produk: WarO (Warung Online).

Aplikasi penjualan untuk warung-warung kecil (UMKM mikro) dengan frontend Android dan backend di cloud. Sistem harus mendukung pembayaran tunai, dompet digital, dan QRIS serta memberi notifikasi real‑time setelah transaksi non‑tunai berhasil. Tujuan utama adalah menyediakan pembukuan yang valid untuk pedagang dengan biaya operasional serendah mungkin, sekaligus membangun jejak data transaksi yang dapat dipakai untuk menghitung credit score pedagang guna memudahkan pengajuan pinjaman.

Konteks & asumsi awal:
	•	Profil pengguna: Pedagang warung dengan perangkat Android low‑to‑mid range, konektivitas tidak selalu stabil, kebutuhan antarmuka sangat sederhana.
	•	Biaya: Sangat sensitif biaya; prefer arsitektur serverless/pay‑as‑you‑go dan komponen open‑source bila memungkinkan.
	•	Kepatuhan: Pembayaran mengikuti standar QRIS Indonesia melalui agregator berizin; data transaksi dikelola sesuai praktik keamanan dasar (enkripsi at‑rest/in‑transit) agar nantinya dapat dipakai untuk penilaian kredit.
	•	Skalabilitas: Multi‑tenant (banyak warung dalam satu platform) dengan pertumbuhan transaksi harian yang bisa bervariasi.
	•	Pembayaran: Gateway dipilih yang murah, stabil, terpercaya; akan dibuat lapisan abstraksi agar bisa diganti (mis. Xendit/Midtrans/NICEPAY/DOKU) dan menyesuaikan kebijakan MDR BI (termasuk 0% untuk mikro sampai batas tertentu) tanpa ubah aplikasi.
	•	Offline‑first: Disepakati; transaksi tunai bisa berjalan total offline, transaksi non‑tunai dicatat dan disinkronkan saat kembali online.

Branding (disepakati)
	•	Nama produk: WarO (Warung Online).
	•	Nama listing: WarO POS – Kasir QRIS & Tunai.
	•	Paket Android (applicationId): id.waro.pos (atau com.<perusahaan>.waro).
	•	Domain: rekomendasi waro.id (utama) dan waro.app (alternatif) — lakukan cek ketersediaan & legal.

Requirements

Disusun dengan MoSCoW: Must/Should/Could/Won’t untuk MVP.

Must Have (wajib)
	•	Pencatatan Penjualan: Tunai, Dompet Digital (OVO/DANA/LinkAja/GoPay/ShopeePay via agregator), QRIS Dinamis per transaksi.
	•	Notifikasi Pembayaran Non‑Tunai: Webhook dari agregator → push notifikasi ke Android + update status transaksi.
	•	Offline‑first: Queue lokal (SQLite) untuk penjualan & sinkronisasi dua arah; retry eksponensial, idempotency.
	•	Katalog Produk: SKU, nama, harga, varian sederhana, satuan; scan barcode opsional.
	•	Pembukuan Valid (MVP): Minimal double‑entry untuk event penjualan & pembayaran (akun piutang kasir, kas/bank, pendapatan, PPN bila relevan).
	•	Laporan: Laporan penjualan harian/mingguan/bulanan, ringkasan kas masuk, rekap metode bayar, export PDF/Excel.
	•	Multi‑tenant & Keamanan Data: Isolasi data per warung (tenant_id), enkripsi in‑transit & at‑rest, role Owner & Kasir.
	•	Biaya Operasional Rendah: Target biaya infrastruktur ≤ Rp5.000/warung/bulan pada skala ≥ 5.000 warung (tidak termasuk MDR/payment fee).
	•	KYC Ringan: KTP/NIB untuk klasifikasi usaha mikro agar eligible kebijakan MDR sesuai BI (mis. pembebasan hingga nominal tertentu), consent untuk data scoring.
	•	Audit Trail: Jejak perubahan transaksi & close shift (Z‑report) harian.

Should Have (sebaiknya ada)
	•	Manajemen Stok Sederhana: Stok masuk/keluar, stok minimum, penyesuaian, valuasi FIFO dasar.
	•	Multi‑perangkat per warung: Sinkronisasi konflik berbasis versi (last‑write‑wins + merge rules sederhana).
	•	Promosi & Diskon: Per item / per nota, jadwal promo.
	•	Backup & Restore: Otomatis harian, retensi 30–90 hari.
	•	Pajak: Opsi PPN/Final UMKM per kebutuhan.

Could Have (opsional/MVP+)
	•	Pembelian ke Supplier: Pencatatan hutang & pembayaran supplier sederhana.
	•	Dashboard Analitik: RFM sederhana, tren penjualan, repeat rate.
	•	Split Settlement: Untuk titip jual/consignment.
	•	Integrasi WhatsApp: Kirim struk digital & tagihan.

Won’t Have (di luar MVP)
	•	Akuntansi lengkap (jurnal umum lengkap, aset tetap, depresiasi) — direncanakan fase berikutnya.
	•	Multi‑cabang kompleks dengan konsolidasi antar cabang — non‑MVP.
	•	Kustom ERP — non‑MVP.

Kriteria Kesuksesan (ringkas)
	•	Adopsi: ≥70% transaksi non‑tunai terproses real‑time dengan notifikasi ≤5 detik setelah webhook.
	•	Reliabilitas: P95 waktu sinkronisasi < 3 detik saat online; tidak ada kehilangan data saat koneksi terputus.
	•	Pembukuan: Laporan bulanan diterima lender sebagai bukti arus kas; ≥95% transaksi terklasifikasi benar.
	•	Biaya: Memenuhi target biaya infrastruktur per warung.

Method

Catatan pilihan cloud & gateway (ringkas): Untuk biaya compute, Cloud Run vs Alibaba Cloud (SAE/Function Compute) keduanya sangat murah untuk beban POS API ringan; estimasi contoh kami menunjukkan Alibaba FC sedikit lebih murah per 1 juta request pada asumsi 100 ms/req, 256 MiB. Namun Cloud Run punya paket gratis bulanan (request + CPU/RAM) yang menguntungkan di skala kecil. Detail perhitungan dan sumber resmi ada di percakapan ini. Gateway awal: Midtrans (disepakati).

Arsitektur Tingkat Tinggi (biaya super-rendah, vendor‑agnostic)
	•	Android App (Kotlin + Jetpack Compose): Offline‑first (Room/SQLite) + WorkManager untuk sinkronisasi. Push notif via FCM.
	•	API Layer (Serverless): HTTP REST over Cloud Run (atau Supabase Edge Functions) dengan Adapter Pembayaran (Xendit/Midtrans/Nicepay/DOKU) mengikuti SNAP BI. Endpoint khusus Webhook.
	•	Database Utama (PostgreSQL): Multi‑tenant (tenant_id). Menampung transaksi POS, pembayaran, stok, dan jurnal double‑entry.
	•	Notifikasi: Webhook → API → FCM topic per warung/per perangkat.
	•	ETL & Scoring: Job terjadwal (Cloud Run job) menghitung fitur kredit dan skor sederhana.

@startuml
skinparam componentStyle rectangle
actor Pedagang as User
component "Android POS (Offline-first)" as App
component "API POS (Cloud Run)" as API
component "Adapter Pembayaran (QRIS/eWallet)" as Pay
component "PostgreSQL (Multi-tenant)" as DB
component "Webhook Receiver" as WH
component "FCM Push" as FCM
component "ETL + Credit Scoring" as Score

User --> App : Input penjualan, pilih metode bayar
App --> API : Create Sale / Generate QR (online)
API --> Pay : Create QRIS Dynamic / Charge
Pay --> WH : Webhook paid
WH --> DB : Update payment & jurnal
WH --> FCM : Push notif ke kasir
App <.. FCM : Terima notifikasi
API --> DB : CRUD katalog/stok/akuntansi
DB <.. Score : Agregasi harian & skor kredit
@enduml

Skema Data (PostgreSQL)

Semua tabel memiliki: id UUID (PK), tenant_id UUID (FK), created_at, updated_at, soft_delete (boolean), dan indeks sesuai catatan.

Inti POS
	•	stores(id, tenant_id, name, address) — index (tenant_id)
	•	users(id, tenant_id, role enum{OWNER,CASHIER}, full_name, phone, email, status) — index (tenant_id, role)
	•	devices(id, store_id, fcm_token, app_version, last_seen) — index (store_id)
	•	products(id, tenant_id, sku, name, barcode, uom, price_cents, tax_rate, active) — index (tenant_id, sku), (tenant_id, barcode)
	•	inventory_movements(id, tenant_id, store_id, product_id, qty_change, cost_cents, reason enum{SALE,PURCHASE,ADJUSTMENT}, ref_type, ref_id, ts) — index (store_id, product_id, ts)
	•	sales(id, tenant_id, store_id, cashier_user_id, sale_no, subtotal_cents, discount_cents, tax_cents, total_cents, payment_status enum{PENDING,PAID,FAILED,CANCELLED}, created_at) — unique (tenant_id, sale_no)
	•	sale_items(id, sale_id, product_id, qty, unit_price_cents, discount_cents, total_cents) — index (sale_id)
	•	payments(id, tenant_id, sale_id, method enum{CASH,EWALLET,QRIS}, provider enum{XENDIT,MIDTRANS,NICEPAY,DOKU}, provider_ref, amount_cents, fee_cents, status enum{PENDING,SUCCEEDED,FAILED}, paid_at) — unique (provider, provider_ref)
	•	shifts(id, tenant_id, store_id, user_id, opened_at, closed_at, opening_cash_cents, closing_cash_cents, expected_cash_cents, variance_cents)
	•	webhooks(id, provider, raw_body jsonb, headers jsonb, signature_valid boolean, status enum{NEW,PROCESSED,ERROR}, processed_at) — index (status)

Akuntansi (Double‑Entry)
	•	ledger_accounts(id, tenant_id, code, name, type enum{ASSET,LIABILITY,EQUITY,REVENUE,EXPENSE}, active) — unique (tenant_id, code)
	•	journal_entries(id, tenant_id, ref_type, ref_id, entry_ts) — index (tenant_id, entry_ts)
	•	journal_lines(id, journal_entry_id, account_id, debit_cents, credit_cents) — constraint: total debit = total credit per entry.

Kredit (Fitur & Skor)
	•	credit_features(id, tenant_id, store_id, period_date, sales_total_cents, cashless_ratio, avg_ticket_cents, p95_ticket_cents, daily_txn_count, active_days, refund_rate, stock_turnover, gross_margin_pct, volatility_30d, late_sync_ratio) — unique (store_id, period_date)
	•	credit_scores(id, tenant_id, store_id, model_version, score_smallint, bucket enum{A,B,C,D}, computed_at)

Alokasi Akun (contoh minimal)
	•	Kas (ASSET), Bank/E‑Money Clearing (ASSET), Pendapatan Penjualan (REVENUE), MDR/biaya (EXPENSE), Persediaan (ASSET), HPP (EXPENSE).

Contoh penjurnalan (basis kas, tanpa piutang):
	•	Tunai dibayar: Dr Kas ; Cr Pendapatan.
	•	QRIS/eWallet dibayar (UMI ≤ batas MDR 0%): Dr Bank/E‑Money Clearing ; Cr Pendapatan.
	•	QRIS/eWallet dengan MDR >0%: Dr Bank/E‑Money Clearing (net) + Dr Biaya MDR ; Cr Pendapatan (gross). Fee dihitung dari aturan MDR &/atau fee provider.

Flow Pembayaran & Notifikasi (Sequence)

@startuml
actor Kasir
participant "Android App" as A
participant "API POS" as S
participant "Gateway (QRIS)" as G
participant "Webhook RX" as W
participant "PostgreSQL" as DB
participant "FCM" as F

Kasir -> A: Buat transaksi & pilih QRIS
A -> S: POST /sales {items,...}
S -> DB: insert sale(status=PENDING)
S -> G: Create QRIS Dynamic (amount, callback_url)
G --> S: qr_string
S --> A: qr_string (render QR)
== Pembeli scan & bayar ==
G -> W: Webhook payment {status=SUCCESS, rrn,...}
W -> DB: upsert payment + update sale(status=PAID)
W -> DB: write journal (double-entry)
W -> F: send push {sale_id, paid=true}
F -> A: notifikasi ditampilkan & pull latest status
@enduml

Offline‑First & Sinkronisasi
	•	Lokal (Android/Room): tabel local_sales, local_sale_items, local_inventory_movements, outbox (event queue), sync_state (last cursor per endpoint).
	•	Strategi: Optimistic UI saat tunai; untuk non‑tunai, transaksi dicatat lokal (status PENDING_REMOTE).
	•	Sinkronisasi: WorkManager periodik & on‑connect → push batch (idempotent key = device_id + local_id), lalu pull perubahan baru berdasarkan updated_at/cursor.
	•	Resolusi Konflik: Master data (produk, harga): last‑write‑wins dengan versi; transaksi: append‑only (tidak di-merge), perubahan hanya lewat refund/void terstruktur.

@startuml
actor Kasir
participant App
participant "Sync Worker" as W
participant API
participant DB

Kasir -> App: Catat penjualan (offline)
App -> App: Tulis ke Room + outbox
... jaringan kembali ...
W -> API: POST /sync/batch {events}
API -> DB: Upsert (idempotent)
API --> W: Ack + {cursor}
W -> API: GET /sync/changes?cursor=...
API --> W: {delta}
W -> App: Apply delta
@enduml

Endpoint API (ringkas)
	•	POST /v1/sales → buat transaksi + (opsional) generate QRIS (provider via header X-Payment-Provider).
	•	POST /v1/payments/qris → create QR dinamis; response {qr_string, expiry}.
	•	POST /v1/webhooks/{provider} → verifikasi signature, idempotent, update payment & jurnal, kirim FCM.
	•	POST /v1/sync/batch & GET /v1/sync/changes → sinkronisasi dua arah.
	•	GET /v1/reports/daily → ringkasan harian (kas, non‑tunai, top SKU).

Adapter Pembayaran (pluggable)

Antarmuka umum:

interface QrisGateway {
  fun createDynamicQr(amount: Long, externalId: String, callbackUrl: String): QrResponse
  fun parseWebhook(headers: Map<String,String>, body: String): WebhookEvent // verify signature
  fun getStatus(externalId: String): PaymentStatus
}

Implementasi: MidtransQrisGateway (utama MVP), XenditQrisGateway, NicepayQrisGateway, DokuQrisGateway. Pilih via konfigurasi per‑tenant.

Keamanan & Kepatuhan
	•	SNAP BI: gunakan provider berizin & endpoint webhook TLS, simpan audit request.
	•	Idempotency: kunci unik (provider, provider_ref) + header Idempotency-Key pada create.
	•	Enkripsi: TLS 1.2+, at‑rest (PG
encryption/disk). Token FCM & API keys disimpan terenkripsi.
	•	RBAC: OWNER vs CASHIER; semua query WHERE tenant_id = :tid (row‑level security opsional dengan policy di PG).

Perhitungan Biaya & Efisiensi
	•	Serverless compute (Cloud Run) + Postgres serverless (Neon/Supabase) → autosuspend saat idle.
	•	QRIS MDR dihitung saat posting jurnal untuk menilai biaya non‑tunai; gunakan klasifikasi UMI untuk 0% MDR hingga batas nominal yang berlaku.

Model Credit Score (MVP)
	•	Tujuan: memberi skor A–D untuk kelayakan awal (non‑binding) bagi mitra lender.
	•	Fitur (30–90 hari): volume penjualan, rasio non‑tunai, hari aktif, variasi harian (volatilitas), ukuran transaksi rata‑rata/p95, refund rate, margin kotor (dari HPP), keterlambatan sinkronisasi.
	•	Metode: tahap 1 rule‑based (threshold) → tahap 2 LogReg/LightGBM sederhana di job terjadwal.
	•	Output: score 300–850 + bucket A–D + indikator faktor dominan.

@startuml
start
:Aggregate daily metrics per store;
if (days_active >= 20 and sales_total >= MIN) then (yes)
  :Compute features & normalize;
  :Apply weights (rule-based) to get base score;
  :Optional: ML predict (LogReg/GBM);
  :Map to bucket A–D;
else (no)
  :Set bucket D (insufficient data);
endif
stop
@enduml

Perbandingan Singkat Aplikasi Serupa
	•	Moka POS, Pawoon, Kasir Pintar: fokus POS & laporan; sebagian dukung QRIS/e-wallet; pembukuan tidak selalu double‑entry dan skor kredit bukan fitur inti. Desain kita menekankan jurnal akuntansi valid + data feature‑store kredit sejak awal.

Implementation

0) Ringkasan Teknis
	•	Cloud: Google Cloud Run (region asia-southeast2, min instances = 0, concurrency 80–200), Artifact Registry, Secret Manager.
	•	DB: PostgreSQL serverless (Neon/Supabase) dengan koneksi publik + SSL; Prisma sebagai ORM.
	•	Gateway: Midtrans Core API (QRIS dinamis + e-wallet next), webhook → FCM.
	•	Android: Kotlin + Jetpack Compose, Room (SQLite), WorkManager, Retrofit/OkHttp, Coil (render QR), FCM.

1) Langkah Infrastruktur
	1.	Buat project GCP, aktifkan API: Cloud Run, Artifact Registry, Secret Manager, Cloud Build (opsional).
	2.	Database: buat project Neon (serverless Postgres), catat DATABASE_URL (sslmode=require). Alternatif: Supabase (Postgres + Auth).
	3.	Secrets (Secret Manager): MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY, MIDTRANS_BASE_URL (https://api.sandbox.midtrans.com atau https://api.midtrans.com), DATABASE_URL, FCM_SA_JSON (service account JSON untuk FCM HTTP v1), JWT_SECRET (opsional).
	4.	Artifact Registry: repositori pos-warung (format Docker).
	5.	Deploy Cloud Run service pos-api: --min-instances=0, --max-instances disesuaikan, --concurrency=80, --cpu=1, --memory=512Mi, --ingress=all, --allow-unauthenticated.

2) Skema Database (DDL ringkas)

Gunakan migrasi (Prisma Migrate / Flyway). Berikut inti tabel SQL (disederhanakan):

create table stores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on stores(tenant_id);

create table products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  sku text,
  name text not null,
  barcode text,
  uom text default 'pcs',
  price_cents int not null,
  tax_rate numeric(5,2) default 0,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index on products(tenant_id, sku);
create index on products(tenant_id, barcode);

create table sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null references stores(id),
  cashier_user_id uuid,
  sale_no text not null,
  subtotal_cents int not null,
  discount_cents int default 0,
  tax_cents int default 0,
  total_cents int not null,
  payment_status text check (payment_status in ('PENDING','PAID','FAILED','CANCELLED')) default 'PENDING',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, sale_no)
);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id),
  qty int not null,
  unit_price_cents int not null,
  discount_cents int default 0,
  total_cents int not null
);
create index on sale_items(sale_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  sale_id uuid not null references sales(id),
  method text check (method in ('CASH','EWALLET','QRIS')) not null,
  provider text check (provider in ('MIDTRANS','XENDIT','NICEPAY','DOKU')),
  provider_ref text,
  amount_cents int not null,
  fee_cents int default 0,
  status text check (status in ('PENDING','SUCCEEDED','FAILED')) default 'PENDING',
  paid_at timestamptz,
  unique(provider, provider_ref)
);

-- Double-entry minimal
create table ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  code text not null,
  name text not null,
  type text check (type in ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')) not null,
  active boolean default true,
  unique(tenant_id, code)
);
create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  ref_type text,
  ref_id uuid,
  entry_ts timestamptz default now()
);
create table journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  account_id uuid not null references ledger_accounts(id),
  debit_cents int default 0,
  credit_cents int default 0,
  check ((debit_cents = 0 and credit_cents > 0) or (credit_cents = 0 and debit_cents > 0))
);

3) API Server (pos-api) – TypeScript/Express

Dependensi: express, zod, pg/prisma, firebase-admin, undici/axios, pino.

Endpoint Utama
	•	POST /v1/sales – buat transaksi (tunai/QRIS). Untuk QRIS, server akan memanggil Midtrans Charge.
	•	POST /v1/payments/midtrans/qris – generate QR dinamis (opsi langsung dipanggil dari app).
	•	POST /v1/webhooks/midtrans – terima notifikasi Midtrans; verifikasi signature; update payments & sales; tulis jurnal; kirim FCM.
	•	POST /v1/sync/batch, GET /v1/sync/changes – sinkronisasi dua arah (offline-first).

Panggil Midtrans Charge QRIS (Core API)
Hit endpoint POST {MIDTRANS_BASE_URL}/v2/charge dengan Authorization: Basic base64(SERVER_KEY:). Response berisi actions[].url untuk generate QR (tanpa/ dengan border ASPI). Tampilkan URL itu sebagai gambar di Android. citeturn2view0

// midtrans.ts
import { request } from 'undici';
const MIDTRANS_BASE = process.env.MIDTRANS_BASE_URL!; // https://api.sandbox.midtrans.com
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY!; // keep in Secret Manager

export async function createQrisCharge(orderId: string, grossAmount: number, notifyUrl: string) {
  const auth = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64');
  const body = {
    payment_type: 'qris',
    transaction_details: { order_id: orderId, gross_amount: grossAmount },
    qris: { acquirer: 'gopay' }
  };
  const res = await request(`${MIDTRANS_BASE}/v2/charge`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Basic ${auth}`,
      'X-Override-Notification': notifyUrl
    },
    body: JSON.stringify(body)
  });
  const json = await res.body.json();
  // Ambil URL QR dari actions
  const action = (json.actions || []).find((a: any) => a.name === 'generate-qr-code-v2')
             || (json.actions || []).find((a: any) => a.name === 'generate-qr-code');
  return { midtrans: json, qrUrl: action?.url };
}

Webhook Midtrans (verifikasi signature_key)
Signature: SHA512(order_id + status_code + gross_amount + server_key). Validasi status_code=200 dan transaction_status=settlement untuk sukses; lakukan idempotensi per order_id/transaction_id. citeturn1view0

// webhook-midtrans.ts
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { upsertPaymentAndJournal, pushFcmToStore } from './service';

const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY!;

function isValidSignature(body: any): boolean {
  const raw = `${body.order_id}${body.status_code}${body.gross_amount}${SERVER_KEY}`;
  const sig = crypto.createHash('sha512').update(raw).digest('hex');
  return sig === body.signature_key;
}

export async function midtransWebhook(req: Request, res: Response) {
  const n = req.body;
  if (!isValidSignature(n)) return res.status(401).send('invalid signature');

  // Idempotent: berdasarkan order_id atau transaction_id
  if (n.transaction_status === 'settlement' && n.fraud_status === 'accept') {
    await upsertPaymentAndJournal({
      provider: 'MIDTRANS',
      provider_ref: n.transaction_id,
      order_id: n.order_id,
      amount_cents: Math.round(parseFloat(n.gross_amount) * 100),
      status: 'SUCCEEDED',
      paid_at: new Date()
    });
    await pushFcmToStore(n.order_id, { type: 'PAYMENT_SETTLED', orderId: n.order_id });
  }
  return res.status(200).json({ ok: true });
}

Jurnal Otomatis (contoh)

// service.ts (cuplikan)
export async function upsertPaymentAndJournal(p: {provider:string;provider_ref:string;order_id:string;amount_cents:number;status:'SUCCEEDED'|'FAILED';paid_at:Date}) {
  // 1) Upsert payment + update sales.payment_status
  // 2) Insert journal_entries + journal_lines (Kas/Bank vs Pendapatan vs Biaya MDR bila ada)
}

Kirim FCM HTTP v1
Gunakan service account & firebase-admin atau REST v1. Untuk banyak perangkat, pakai topic per warung (store_{storeId}) agar efisien. citeturn0search4turn0search15

import admin from 'firebase-admin';
// init pakai FCM_SA_JSON
export async function pushFcmToStore(orderId: string, payload: any) {
  const message = { topic: `store_${/* storeId dari orderId */''}`, data: { orderId, event: 'PAYMENT_SETTLED' } };
  await admin.messaging().send(message);
}

4) Android (Kotlin, Compose, Room, WorkManager)

Entity Room (ringkas)

@Entity(tableName = "sales")
data class SaleEntity(
  @PrimaryKey val localId: String, // device-unique
  val remoteId: String?,
  val storeId: String,
  val totalCents: Int,
  val paymentStatus: String, // PENDING/PAID
  val createdAt: Long
)

@Entity(tableName = "sale_items")
data class SaleItemEntity(
  @PrimaryKey val id: String,
  val saleLocalId: String,
  val productId: String,
  val qty: Int,
  val unitPriceCents: Int,
  val totalCents: Int
)

@Entity(tableName = "outbox")
data class OutboxEvent(
  @PrimaryKey val id: String,
  val type: String, // CREATE_SALE, ADJUST_STOCK, etc
  val payload: String,
  val createdAt: Long
)

Worker Sinkronisasi

class SyncWorker(ctx: Context, params: WorkerParameters): CoroutineWorker(ctx, params) {
  override suspend fun doWork(): Result {
    // 1) Push event dari outbox ke /v1/sync/batch (idempotent key = deviceId+eventId)
    // 2) Pull delta dari /v1/sync/changes?cursor=...
    return Result.success()
  }
}

Tampilkan QRIS (Coil men‑render URL dari actions[].url)

@Composable
fun QrScreen(qrUrl: String) {
  Image(painter = rememberAsyncImagePainter(qrUrl), contentDescription = "QRIS")
}

FCM di Android
	•	Daftarkan token perangkat → POST /v1/devices.
	•	Subscribekan ke topic store_{storeId} atau simpan token untuk unicast.
	•	OnMessage: refresh detail transaksi dari server.

5) Keamanan & Operasional
	•	Idempotency: gunakan order_id unik (mis. ${tenantId}-${epoch}-${rand}) + constraint unik di DB.
	•	Webhook: Validasi signature_key, status & fraud; retry aman (stateless, 200 OK cepat).
	•	Auth: JWT ringan untuk perangkat (Owner/Kasir) + tenant_id scope; semua query dibatasi tenant_id.
	•	Observability: Pino logs → Cloud Logging; dashboard error rate & P95 latensi.
	•	Biaya Guardrails: min-instances=0, connection pool ringan (pgBouncer/Prisma Data Proxy), cache ringan untuk master data.

6) Uji & Go‑Live
	•	Sandbox Midtrans: tes qris → verifikasi webhook & signature, simulasi settlement & expire.
	•	Load kecil: uji 50–100 RPS; cek autoscaling Cloud Run.
	•	Checklist produksi: ganti MIDTRANS_BASE_URL ke produksi, domain & DNS, rotasi kunci, backup DB harian.

⸻

Konfirmasi: Apakah implementasi di atas sesuai (Cloud Run + Midtrans Core API + Android offline‑first)? Jika ya, saya lanjutkan menulis bagian Milestones berikutnya.

Milestones

Estimasi durasi 10–12 minggu untuk MVP siap pilot, dengan tim kecil (BE 1–2, Android 1–2, QA 1, PM/Owner 0.5). Target biaya infra: ≤ Rp5.000/warung/bulan pada 5.000 warung (tidak termasuk MDR/biaya gateway).

Sprint 0 (Minggu 1) – Pondasi
	•	Repo mono (API + Android), konvensi CI/CD.
	•	Cloud Run service pos-api + Neon/Supabase Postgres + Secret Manager.
	•	Skeleton schema + migrasi + seed akun buku.
	•	Otentikasi ringan (JWT) + tenant_id scoping.

Sprint 1 (Minggu 2–3) – POS Offline‑First Dasar
	•	Android: katalog lokal, cart, penjualan tunai 100% offline.
	•	Room + Outbox + WorkManager + endpoint /sync (idempotent).
	•	Laporan kas harian lokal + sinkron.

Sprint 2 (Minggu 4) – Integrasi Midtrans (QRIS Dinamis)
	•	Endpoint POST /v1/payments/midtrans/qris (charge) & POST /v1/webhooks/midtrans (verifikasi signature, idempotent).
	•	Render QR di Android; state pembayaran real‑time.
	•	FCM push ke topic store_{id} saat settlement.

Sprint 3 (Minggu 5) – Pembukuan Valid (Double‑Entry) & Z‑Report
	•	Otomasi jurnal untuk tunai & QRIS (termasuk biaya MDR bila ada).
	•	Close shift (Z‑report), audit trail, export PDF/Excel untuk harian/bulanan.

Sprint 4 (Minggu 6) – Stok & Struk
	•	Stok dasar (SALE/PURCHASE/ADJUSTMENT, FIFO ringan).
	•	Bluetooth printer 58mm (ESC/POS) di Android (opsional aktifkan per warung).
	•	Struk digital (tautan struk yang bisa dibuka pelanggan) + share ke WhatsApp/SMS (link, bukan broadcast massal).

Sprint 5 (Minggu 7–8) – Credit Feature Store & Skor MVP
	•	ETL agregasi harian (Cloud Run job).
	•	Rule‑based score (A–D) + dashboard internal & export untuk lender.

Sprint 6 (Minggu 9) – Keamanan, Reliability, Biaya
	•	Rate limit, retry policy, observability (error rate, P95).
	•	Hardening multi‑tenant, test beban (≥100 RPS), biaya guardrails.

Pilot (Minggu 10–12)
	•	Onboard 50 warung di Jakarta & Bodetabek (campuran kios kelontong & warung makan).
	•	SLA webhook & push: P95 < 5 detik; reliabilitas sinkron: zero data‑loss.
	•	Evaluasi UX & keberterimaan biaya.

Exit Criteria MVP
	•	95% transaksi tercatat benar (audit sampling), >99% event webhook terproses idempotent tanpa duplikasi.
	•	Laporan bulanan diterima lender; skor tersedia untuk ≥80% warung aktif ≥30 hari.

Gathering Results

Metodologi Evaluasi
	•	Teknis: P95 latensi API < 300 ms, P95 sinkronisasi < 3 detik; error rate < 0,5%; notifikasi pembayaran masuk < 5 detik setelah settlement.
	•	Bisnis: ≥70% merchant aktif mingguan; ≥50% transaksi non‑tunai di pilot; NPS kasir ≥ 40.
	•	Pembukuan: Rekonsiliasi acak 20 warung/bulan; selisih kas ≤ 0,5% omzet; jurnal seimbang 100%.
	•	Biaya: Infra ≤ Rp5.000/warung/bulan di >5.000 warung; biaya support ≤ 2 tiket/warung/bulan.

Pelaporan
	•	Dashboard internal (Grafana/Looker Studio) + export CSV & laporan PDF bulanan untuk lender (arus kas, volatilitas, rasio cashless, bucket skor) + dashboard read‑only untuk lender.

Brand & Visual Identity – WarO

Nama & Tone
	•	WarO — ringkas, ramah, dipercaya. Tone: sederhana, bersih, tidak norak.

Palet Warna (3 opsi)

Opsi A – Hijau Warung (default rekomendasi)
	•	Primary: #1E7A46
	•	Primary‑light: #16A34A
	•	Accent: #F59E0B
	•	Neutral (Teks): #111827
	•	Background: #F8FAFC

Opsi B – Biru Stabil
	•	Primary: #1D4ED8
	•	Secondary: #0EA5E9
	•	Accent: #F97316
	•	Neutral: #111827
	•	Background: #F9FAFB

Opsi C – Arang + Hijau
	•	Primary (Charcoal): #111827
	•	Accent (Green): #22C55E
	•	Secondary: #374151
	•	Background: #F3F4F6

Catatan aksesibilitas: kombinasi teks utama pada latar belakang dipilih untuk target kontras WCAG AA. Tabel kontras terlampir di artefak (lihat link di chat).

Tipografi
	•	UI & Dokumen: Inter (fallback: system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif).
	•	Brand/Heading alternatif: Plus Jakarta Sans atau Poppins (opsional).

Logo & Aset
	•	Jenis: 1) Logomark (monogram W + O), 2) Wordmark “WarO”, 3) Badge (ikon di dalam bentuk persegi/lingkaran).
	•	Variasi disediakan dalam SVG siap pakai (vektor, bisa diubah warna) + ikon PNG kecil.

Aturan ringkas
	•	Gunakan Opsi A sebagai default (UI/ikon).
	•	Jaga area bebas sekitar logo = tinggi huruf “W”.
	•	Jangan memutar, memberi efek bevel/glow, atau menggunakan warna di luar palet.

⸻

Need Professional Help in Developing Your Architecture?

Please contact me at sammuti.com￼ :)