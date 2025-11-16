#!/bin/bash
# WarO Database Setup Script
# This script initializes the database schema for WarO application

set -e  # Exit immediately if a command exits with a non-zero status

# Function to display usage information
usage() {
    echo "Usage: $0 [live|test] [options]"
    echo "  live     - Setup database for live environment (uses .env)"
    echo "  test     - Setup database for testing environment (uses .env.testing)"
    echo ""
    echo "Options:"
    echo "  -d, --drop-first   Drop existing database before creating (optional)"
    echo "  -h, --help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 live                    # Setup live database"
    echo "  $0 test                    # Setup test database"
    echo "  $0 test --drop-first       # Drop and recreate test database"
    exit 1
}

# Initialize variables
ENVIRONMENT=""
DROP_FIRST=false

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        live|test)
            ENVIRONMENT="$1"
            shift
            ;;
        -d|--drop-first)
            DROP_FIRST=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Check if environment is provided
if [[ -z "$ENVIRONMENT" ]]; then
    echo "Error: Environment (live or test) is required."
    usage
fi

# Set environment file based on environment
if [[ "$ENVIRONMENT" == "live" ]]; then
    ENV_FILE=".env"
    echo "Setting up database for LIVE environment..."
elif [[ "$ENVIRONMENT" == "test" ]]; then
    ENV_FILE=".env.testing"
    echo "Setting up database for TEST environment..."
fi

# Check if environment file exists
if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: $ENV_FILE file not found!"
    echo "Please create the environment file with DATABASE_URL and other required configuration."
    exit 1
fi

# Read database configuration from .env file
DB_HOST=$(grep "^DB_HOST=" $ENV_FILE | cut -d '=' -f2- | sed 's/^"//' | sed 's/"$//')
DB_PORT=$(grep "^DB_PORT=" $ENV_FILE | cut -d '=' -f2- | sed 's/^"//' | sed 's/"$//')
DB_USER=$(grep "^DB_USER=" $ENV_FILE | cut -d '=' -f2- | sed 's/^"//' | sed 's/"$//')
DB_PASS=$(grep "^DB_PASS=" $ENV_FILE | cut -d '=' -f2- | sed 's/^"//' | sed 's/"$//')
DB_NAME=$(grep "^DB_NAME=" $ENV_FILE | cut -d '=' -f2- | sed 's/^"//' | sed 's/"$//')

echo "Database host: $DB_HOST"
echo "Database port: $DB_PORT"
echo "Database name: $DB_NAME"
echo "Database user: $DB_USER"

# Set PGPASSWORD for psql authentication
export PGPASSWORD="$DB_PASS"

# Function to execute SQL command
execute_sql() {
    local sql="$1"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "$sql"
}

# Drop database if requested
if [[ "$DROP_FIRST" == true ]]; then
    echo "Disconnecting active connections and dropping database: $DB_NAME"
    execute_sql "REVOKE CONNECT ON DATABASE $DB_NAME FROM public;"
    execute_sql "SELECT pid, pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();"
    execute_sql "DROP DATABASE IF EXISTS $DB_NAME;"
fi

# Create database if it doesn't exist
echo "Creating database: $DB_NAME"
execute_sql "CREATE DATABASE $DB_NAME;"

# Apply schema to the created database
echo "Applying schema to database: $DB_NAME"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f schema.sql

# Test database connection and schema
echo "Testing database connection and schema..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 'Database connection successful' AS message;
SELECT COUNT(*) AS table_count FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
"

echo "Database setup completed successfully for $ENVIRONMENT environment!"
echo "Database: $DB_NAME"
echo "Environment: $ENV_FILE"