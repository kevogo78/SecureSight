-- Run against the existing application database before deploying recordings.
-- Additive: existing screenshot/keylogger tables and records are unchanged.
CREATE TABLE IF NOT EXISTS video_recordings (
    recording_id UUID PRIMARY KEY,
    endpoint_id BIGINT NOT NULL REFERENCES endpoints(endpoint_id),
    started_at TIMESTAMPTZ NOT NULL,
    duration_seconds REAL NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 30),
    fps INTEGER NOT NULL CHECK (fps BETWEEN 1 AND 5),
    width INTEGER NOT NULL CHECK (width BETWEEN 2 AND 1280),
    height INTEGER NOT NULL CHECK (height BETWEEN 2 AND 720),
    s3_bucket TEXT NOT NULL,
    s3_key TEXT NOT NULL UNIQUE,
    encryption_iv VARCHAR(24) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    encrypted_size INTEGER NOT NULL CHECK (encrypted_size BETWEEN 17 AND 16777216),
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS video_recordings_endpoint_time
    ON video_recordings(endpoint_id, started_at DESC);
