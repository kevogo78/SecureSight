-- Migration 002: Add website tracking and indexing to audit_logs
-- Idempotent schema migration for website domains/URLs visited during sessions

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS website_url VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_audit_logs_website_url ON audit_logs(website_url);

