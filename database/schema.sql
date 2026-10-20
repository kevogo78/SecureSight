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
    custom_name VARCHAR(100),
    mac_address VARCHAR(50),
    device_fingerprint VARCHAR(100),
    os_type VARCHAR(50) NOT NULL,
    agent_ver VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS endpoint_connection_history (
    connection_id BIGSERIAL PRIMARY KEY,
    endpoint_id INT REFERENCES endpoints(endpoint_id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(100),
    mac_address VARCHAR(50),
    user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
    username VARCHAR(100),
    ip_address VARCHAR(50),
    hostname VARCHAR(100),
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'Online'
);

CREATE TABLE IF NOT EXISTS telemetry_logs (
    telemetry_id BIGSERIAL PRIMARY KEY,
    endpoint_id INT REFERENCES endpoints(endpoint_id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cpu_percent REAL,
    ram_percent REAL,
    disk_percent REAL,
    network_sent_bytes BIGINT DEFAULT 0,
    network_recv_bytes BIGINT DEFAULT 0,
    system_uptime_seconds BIGINT
);

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id BIGSERIAL PRIMARY KEY,
    endpoint_id INT REFERENCES endpoints(endpoint_id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    active_app VARCHAR(100) NOT NULL,
    app_category VARCHAR(50) DEFAULT 'General',
    website_url VARCHAR(255),
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
CREATE INDEX IF NOT EXISTS idx_endpoints_device_fingerprint ON endpoints(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_endpoints_mac_address ON endpoints(mac_address);
CREATE INDEX IF NOT EXISTS idx_conn_hist_fingerprint ON endpoint_connection_history(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_conn_hist_mac ON endpoint_connection_history(mac_address);
CREATE INDEX IF NOT EXISTS idx_conn_hist_endpoint ON endpoint_connection_history(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_conn_hist_user ON endpoint_connection_history(user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_logs_endpoint_timestamp ON telemetry_logs(endpoint_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_endpoint_timestamp ON audit_logs(endpoint_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_filter_status ON audit_logs(filter_status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_website_url ON audit_logs(website_url);
CREATE INDEX IF NOT EXISTS idx_media_captures_log_id ON media_captures(log_id);

CREATE TABLE IF NOT EXISTS privacy_rules (
    rule_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL,
    pattern TEXT NOT NULL,
    replacement VARCHAR(100) DEFAULT '[REDACTED]',
    action VARCHAR(30) DEFAULT 'mask_and_block',
    reason VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    is_builtin BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_privacy_rules_category ON privacy_rules(category);
CREATE INDEX IF NOT EXISTS idx_privacy_rules_enabled ON privacy_rules(enabled);