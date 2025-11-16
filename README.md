# WarO (Warung Online) POS System

WarO is a Point of Sale (POS) system designed for small Indonesian warung stores (UMKM mikro) with offline-first capabilities and support for cash, digital wallets, and QRIS payments.

## Features

- **Multi-tenant architecture**: Supports multiple stores with data isolation
- **Offline-first**: Cash transactions work completely offline
- **Payment support**: Cash, e-wallets, and QRIS (Indonesia's standard QR code payment system)
- **Real-time notifications**: Push notifications for non-cash transactions
- **Double-entry bookkeeping**: Valid financial records for credit scoring
- **Inventory management**: Basic stock tracking and management
- **Reporting**: Daily, weekly, and monthly sales reports
- **Indonesian localization**: Full support for Indonesian language in UI and messaging

## Tech Stack

- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL
- **Frontend**: Planned for Android using Kotlin
- **Payments**: Midtrans (with pluggable adapter for other providers)
- **Notifications**: Firebase Cloud Messaging (FCM)

## Project Structure

```
waro/
├── server.js                 # Main server file
├── package.json             # Dependencies and scripts
├── .env                     # Environment variables for production
├── .env.testing            # Environment variables for testing
├── .gitignore              # Files to ignore in git
├── db/                     # Database connection utilities
│   └── connection.js       # PostgreSQL connection pool
├── routes/                 # API route handlers
│   ├── health.js           # Health check endpoint
│   ├── sales.js            # Sales management endpoints
│   ├── payments.js         # Payments endpoints (placeholder)
│   ├── products.js         # Products endpoints (placeholder)
│   └── sync.js             # Sync endpoints (placeholder)
├── i18n/                   # Internationalization files
│   └── indonesia.js        # Indonesian translations
├── utils/                  # Utility functions
│   └── i18n.js            # Internationalization utilities
├── schema.sql             # Database schema
├── setup_db.sh            # Database setup script
└── test/                  # Test setup
```

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   - Copy `.env.example` to `.env` and update with your configuration
   - Copy `.env.example` to `.env.testing` for test environment

3. **Set up the database**:
   ```bash
   # For development
   bash setup_db.sh live
   
   # For testing
   bash setup_db.sh test
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

5. **Start the server**:
   ```bash
   npm start
   # or for development with auto-restart:
   npm run dev
   ```

## API Endpoints

### Health Check
- `GET /v1/health` - Check server and database health

### Sales
- `POST /v1/sales` - Create a new sale
- `GET /v1/sales/:id` - Get a specific sale
- `GET /v1/sales` - List sales for a tenant

## Environment Variables

The application uses the following environment variables:

### Database Configuration
- `DB_HOST` - Database host
- `DB_PORT` - Database port
- `DB_USER` - Database username
- `DB_PASS` - Database password
- `DB_NAME` - Database name

The database connection string is built from these individual variables rather than using a single `DATABASE_URL`.

### Payment Gateway (Midtrans)
- `MIDTRANS_SERVER_KEY` - Midtrans server key
- `MIDTRANS_CLIENT_KEY` - Midtrans client key
- `MIDTRANS_BASE_URL` - Midtrans API URL

### Server Configuration
- `PORT` - Server port (default: 8080)
- `NODE_ENV` - Environment (development/production/test)

## Testing

The application includes comprehensive tests using Jest:
- Database connection tests
- API endpoint tests with proper data setup
- Internationalization tests
- Error handling tests

Run all tests with:
```bash
npm test
```

## Internationalization

The system supports Indonesian localization with:
- Automatic language detection
- Request-scoped translation function (`req.t()`)
- Centralized translation files in `i18n/` directory

## Database Schema

The schema supports the offline-first approach with:
- UUID primary keys for conflict-free synchronization
- Soft deletes for data integrity
- Multi-tenant data isolation with `tenant_id`
- Double-entry bookkeeping for financial records
- Proper indexing for performance

## Development

The system is designed with extensibility in mind:
- Pluggable payment gateway adapters
- Middleware-based architecture
- Comprehensive error handling
- Structured logging

## License

MIT