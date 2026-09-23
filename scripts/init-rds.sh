#!/usr/bin/env bash
set -e

if [ -z "$DB_HOST" ] || [ -z "$DB_PASS" ]; then
  echo "Error: DB_HOST and DB_PASS environment variables must be defined."
  exit 1
fi

echo "=== Initializing Amazon RDS PostgreSQL Schema ==="
psql -h "$DB_HOST" -U postgresadmin -d endpoint_monitor -f database/schema.sql

echo "=== Database Schema Applied Successfully ==="