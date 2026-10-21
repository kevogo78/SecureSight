#!/usr/bin/env bash
set -e

if [ -z "$DB_HOST" ] || [ -z "$DB_PASS" ]; then
  echo "Error: DB_HOST and DB_PASS environment variables must be defined."
  exit 1
fi

# Export PGPASSWORD so psql connects non-interactively without blocking for password prompt
export PGPASSWORD="$DB_PASS"

DB_USER="${DB_USER:-postgresadmin}"
DB_NAME="${DB_NAME:-postgres}"
DB_PORT="${DB_PORT:-5432}"

echo "=== Initializing Amazon RDS PostgreSQL Schema on ${DB_HOST}:${DB_PORT}/${DB_NAME} ==="
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f database/schema.sql

echo "=== Applying Default Seed Credentials & Clearing Stale Records ==="
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f database/seed.sql

echo "=== Database Schema & Seed Data Applied Successfully ==="
