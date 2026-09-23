-- Seed Data for Testing and Verification
INSERT INTO users (username, email, password_hash, role)
VALUES 
('admin_demo', 'admin@monitoring.local', 'pbkdf2:sha256:10000$dummyhash$mockedadminpassword', 'Admin'),
('analyst_demo', 'analyst@monitoring.local', 'pbkdf2:sha256:10000$dummyhash$mockedanalystpassword', 'Auditor');

INSERT INTO endpoints (user_id, hostname, os_type, agent_ver, is_active)
VALUES 
(1, 'WORKSTATION-WIN11', 'Windows 11 Enterprise', '1.0.0', TRUE),
(2, 'MACBOOK-PRO-M2', 'macOS 14.5 Sonoma', '1.0.0', TRUE);

INSERT INTO audit_logs (endpoint_id, active_app, app_category, keystroke_count, activity_state, cpu_percent, ram_percent, filter_status, dlp_flag)
VALUES 
(1, 'Code.exe', 'Development', 142, 'Active', 14.2, 48.5, 'Clean', FALSE),
(1, 'chrome.exe', 'Browsing', 45, 'Active', 8.5, 52.1, 'Clean', FALSE),
(1, 'chrome.exe', 'Browsing', 0, 'Privacy_Suspended', 5.2, 51.8, 'Password_Control_Suppressed', TRUE),
(2, 'Terminal', 'Development', 98, 'Active', 12.1, 41.2, 'Clean', FALSE);