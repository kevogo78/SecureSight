-- Migration 003: Dynamic Privacy Filter Rules Engine
-- Allows dynamically adding, editing, and managing privacy masking and DLP rules without modifying core code.

CREATE TABLE IF NOT EXISTS privacy_rules (
    rule_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL, -- 'regex', 'domain', 'process', 'window_title'
    pattern TEXT NOT NULL,
    replacement VARCHAR(100) DEFAULT '[REDACTED]',
    action VARCHAR(30) DEFAULT 'mask_and_block', -- 'mask', 'block_capture', 'mask_and_block'
    reason VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    is_builtin BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_privacy_rules_category ON privacy_rules(category);
CREATE INDEX IF NOT EXISTS idx_privacy_rules_enabled ON privacy_rules(enabled);

