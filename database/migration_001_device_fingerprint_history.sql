-- Migration 001: Device Fingerprint, MAC Tracking & Historical Connection Linking
-- Purpose: Support tracking historical workstation connections by MAC address or persistent device fingerprint
--          alongside unique user IDs, linking past logins from the same physical device together.

-- 1. Add persistent hardware identification columns to endpoints table
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS custom_name VARCHAR(100);
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS mac_address VARCHAR(50);
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(100);

-- 2. Create historical connection tracking table
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

-- 3. Create indices for fast lookup by hardware identifiers and user
CREATE INDEX IF NOT EXISTS idx_endpoints_device_fingerprint ON endpoints(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_endpoints_mac_address ON endpoints(mac_address);
CREATE INDEX IF NOT EXISTS idx_conn_hist_fingerprint ON endpoint_connection_history(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_conn_hist_mac ON endpoint_connection_history(mac_address);
CREATE INDEX IF NOT EXISTS idx_conn_hist_endpoint ON endpoint_connection_history(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_conn_hist_user ON endpoint_connection_history(user_id);

