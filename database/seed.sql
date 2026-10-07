-- Seed Data for Default Admin & Auditor Users
INSERT INTO users (username, email, password_hash, role)
VALUES 
('admin_demo', 'admin@monitoring.local', 'pbkdf2:sha256:10000$dummyhash$mockedadminpassword', 'Admin'),
('analyst_demo', 'analyst@monitoring.local', 'pbkdf2:sha256:10000$dummyhash$mockedanalystpassword', 'Auditor')
ON CONFLICT (username) DO NOTHING;

-- Cleanup any previous mock test endpoints and audit logs
DELETE FROM audit_logs WHERE endpoint_id IN (
    SELECT endpoint_id FROM endpoints WHERE hostname IN ('WORKSTATION-WIN11', 'MACBOOK-PRO-M2') OR LOWER(hostname) LIKE '%ubuntu%'
);
DELETE FROM endpoints WHERE hostname IN ('WORKSTATION-WIN11', 'MACBOOK-PRO-M2') OR LOWER(hostname) LIKE '%ubuntu%';