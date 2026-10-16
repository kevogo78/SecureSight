-- Run once against the same database used by endpoint-api.service.
-- Existing telemetry_logs and its records are preserved.
BEGIN;
CREATE TABLE IF NOT EXISTS aws_endpoint_registry (
    endpoint_id BIGSERIAL PRIMARY KEY,
    hostname TEXT NOT NULL UNIQUE,
    last_seen TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    kicked BOOLEAN NOT NULL DEFAULT FALSE
);

-- Include actual historical device records. Stale ones display as offline.
INSERT INTO aws_endpoint_registry (hostname, last_seen, metadata)
SELECT DISTINCT ON (hostname) hostname, timestamp::timestamptz, metrics::jsonb
FROM telemetry_logs
ORDER BY hostname, timestamp::timestamptz DESC
ON CONFLICT (hostname) DO NOTHING;
COMMIT;
