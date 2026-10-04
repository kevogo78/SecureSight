-- Database Schema for Endpoint Observability System
-- Compatible with PostgreSQL 15+ / Amazon RDS Free Tier

CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'Auditor' CHECK (role IN ('Admin', 'Auditor', 'User')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS endpoints (
    endpoint_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
    hostname VARCHAR(100) NOT NULL,
    os_type VARCHAR(50) NOT NULL,
    agent_ver VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id BIGSERIAL PRIMARY KEY,
    endpoint_id INT REFERENCES endpoints(endpoint_id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    active_app VARCHAR(100) NOT NULL,
    app_category VARCHAR(50) DEFAULT 'General',
    keystroke_count INT DEFAULT 0,
    activity_state VARCHAR(20) DEFAULT 'Active' CHECK (activity_state IN ('Active', 'Idle', 'Privacy_Suspended')),
    cpu_percent REAL,
    ram_percent REAL,
    filter_status VARCHAR(50) DEFAULT 'Clean',
    dlp_flag BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS media_captures (
    capture_id SERIAL PRIMARY KEY,
    log_id BIGINT REFERENCES audit_logs(log_id) ON DELETE CASCADE,
    s3_bucket VARCHAR(100) NOT NULL,
    s3_key VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    encryption_iv VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indices for Dashboard Aggregations
CREATE INDEX IF NOT EXISTS idx_audit_logs_endpoint_timestamp ON audit_logs(endpoint_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_filter_status ON audit_logs(filter_status);
CREATE INDEX IF NOT EXISTS idx_media_captures_log_id ON media_captures(log_id);