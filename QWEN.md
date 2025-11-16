# WarO (Warung Online) - QWEN.md

## Project Overview

WarO (Warung Online) is a POS application designed for small warung stores (UMKM mikro) with an Android frontend and cloud backend. The system supports cash payments, digital wallets, and QRIS (Indonesia's Quick Response Code standard), providing real-time notifications for non-cash transactions. The primary goal is to provide valid bookkeeping for merchants at the lowest possible operational cost while building transaction data history that can be used for credit scoring to facilitate loan applications.

### Key Features
- Offline-first architecture allowing cash transactions to work completely offline
- Support for cash, digital wallets (OVO/DANA/LinkAja/GoPay/ShopeePay), and QRIS Dynamic payments
- Real-time payment notifications via FCM
- Double-entry bookkeeping for valid financial records
- Multi-tenant architecture with data isolation per store
- Credit scoring system based on transaction data
- Inventory management and reporting capabilities

### Technologies & Architecture
- **Backend**: TypeScript/Express API on Google Cloud Run (serverless)
- **Database**: PostgreSQL (Neon/Supabase serverless)
- **Android App**: Kotlin + Jetpack Compose, Room (SQLite), WorkManager
- **Payment Gateway**: Midtrans (with pluggable adapter for other providers)
- **Notifications**: Firebase Cloud Messaging (FCM)
- **Authentication**: JWT-based with tenant scoping

## Project Structure

The project appears to be organized as a monorepo with both backend API and Android application components:

- `/SPEC.md` - Detailed technical specification for the entire system
- `/QWEN.md` - Current file providing project context

## Building and Running

Based on the specification, here's how to build and run the project:

### Backend (Cloud Run API)
1. Set up Google Cloud project with Cloud Run, Artifact Registry, and Secret Manager APIs enabled
2. Set up a PostgreSQL serverless instance (Neon/Supabase)
3. Configure secrets in Secret Manager:
   - `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_BASE_URL`
   - `DATABASE_URL`
   - `FCM_SA_JSON` (service account JSON for FCM)
   - `JWT_SECRET`
4. Build and deploy the Docker container to Cloud Run:
   ```bash
   gcloud run deploy pos-api \
     --source . \
     --min-instances=0 \
     --max-instances=auto \
     --concurrency=80 \
     --cpu=1 \
     --memory=512Mi \
     --ingress=all \
     --allow-unauthenticated
   ```

### Android Application
The Android app uses:
- Kotlin + Jetpack Compose for UI
- Room database for offline-first functionality
- WorkManager for synchronization
- FCM for notifications
- Coil for QR rendering

## Development Conventions

### Backend Conventions
- REST API endpoints follow the pattern `/v1/{resource}`
- All database queries must include tenant_id scoping
- Idempotency keys used for safe retries
- Double-entry bookkeeping for all financial transactions
- Webhook verification and signature validation required

### Database Schema
The system uses a multi-tenant PostgreSQL database with these key tables:
- `stores`, `products`, `sales`, `sale_items`, `payments`
- Double-entry accounting: `ledger_accounts`, `journal_entries`, `journal_lines`
- Credit scoring: `credit_features`, `credit_scores`
- Synchronization: `outbox`, `sync_state`

### Android Conventions
- Offline-first approach with local Room database
- Synchronization worker using WorkManager
- Local event queue in the outbox table
- Conflict resolution for multi-device scenarios

## Key Endpoints

- `POST /v1/sales` - Create transactions
- `POST /v1/payments/midtrans/qris` - Generate QR codes
- `POST /v1/webhooks/midtrans` - Process payment notifications
- `POST /v1/sync/batch`, `GET /v1/sync/changes` - Two-way synchronization
- `GET /v1/reports/daily` - Daily summaries

## Security & Compliance

- All data is encrypted in transit (TLS 1.2+) and at rest
- Multi-tenant data isolation with tenant_id checks
- Payment processing follows BI's SNAP standards
- Idempotency mechanisms to prevent duplicate transactions
- Row-level security with tenant scoping on all queries

## Testing Strategy

Based on the specification, testing should include:
- API load testing (50-100 RPS)
- Webhook reliability and idempotency
- Offline synchronization scenarios
- Payment flow verification
- Credit scoring accuracy validation

## Deployment & Production

- Target infrastructure cost: ≤Rp5,000/store/month at 5,000+ stores
- Serverless architecture with autoscaling
- Midtrans sandbox for development, production keys for live
- Cloud monitoring and logging for observability
- Backup and retention policies for data protection

## Milestones

The project follows an agile approach with 6 sprints over 9 weeks, followed by a 3-week pilot phase:
- Sprint 0: Foundation (Week 1)
- Sprint 1: Offline-first POS (Weeks 2-3)
- Sprint 2: Midtrans integration (Week 4)
- Sprint 3: Double-entry bookkeeping & Z-report (Week 5)
- Sprint 4: Inventory & receipts (Week 6)
- Sprint 5: Credit scoring MVP (Weeks 7-8)
- Sprint 6: Security & reliability (Week 9)
- Pilot: 50 stores in Jakarta/Bodetabek (Weeks 10-12)

## Success Metrics

- Technical: P95 API latency <300ms, sync time <3 seconds, <0.5% error rate
- Business: ≥70% merchant weekly active, ≥50% non-cash transactions
- Bookkeeping: 95% accurate transaction recording, balanced journals 100%
- Cost: Infrastructure ≤Rp5,000/store/month at scale