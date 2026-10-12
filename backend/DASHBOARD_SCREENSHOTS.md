# View encrypted captures in the dashboard

This feature targets the deployed `src.main:app` backend at
`/home/ubuntu/ITEC4810_Capstone/backend`, not standalone aws_main.py.
No database migration is needed. Existing media_captures rows supply the S3
bucket, object key, encryption_iv, and file_hash, including historical captures.

## What happens

Audit logs return `/api/v1/media/<capture_id>/image` instead of a presigned URL
to ciphertext. The backend checks the administrator session, downloads the
encrypted S3 object, authenticates/decrypts it with AES-256-GCM, checks its
plaintext SHA-256 when stored, and returns an uncached JPEG. The browser never
receives the encryption key. No decrypted file is written to the server disk.
Screenshot thumbnails and the modal use the same protected endpoint.

The old browser-only password check did not authenticate API access. Login
now verifies credentials on the server and issues a one-hour HttpOnly cookie
signed with a secret shared by both backend workers. This guards the new image
route; it does not retrofit authorization onto all existing telemetry APIs.

## Configure EC2

In `/var/www/endpoint-monitor/.env`, add these settings using private values:

```dotenv
SCREENSHOT_KEY_HEX=the_64_hex_character_key_from_the_capturing_agent
DASHBOARD_ADMIN_USER=administrator
DASHBOARD_ADMIN_PASSWORD=your_admin_password
DASHBOARD_SESSION_SECRET=a_random_secret_at_least_32_characters_long
DASHBOARD_COOKIE_SECURE=true
```

Use the same key that successfully decrypted your downloaded screenshot.
Do not generate a different encryption key for existing captures or share it
in chat/source control. You can copy the current CONFIG.crypto_key_hex from
your agent/src/main.py locally into the protected server environment file.
This version supports one capture key; captures made with other keys require
key versioning before they can be viewed.

Generate the session secret locally/on EC2 (not the capture key):

```bash
/var/www/endpoint-monitor/venv/bin/python -c 'import secrets; print(secrets.token_hex(32))'
```

The default cookie requires HTTPS. For your current HTTP-IP development test
only, set DASHBOARD_COOKIE_SECURE=false. HTTP sends the login and decrypted
image without transport encryption; use HTTPS and true for administrator use.
Choose a private admin password rather than the former password embedded in JS.
The backend's AWS identity needs s3:GetObject on the screenshot prefix, and
KMS decrypt permission if the bucket uses SSE-KMS.

## Deploy

Deploy the changed backend files from your intended branch into the existing
EC2 checkout. Keep the S3 signing fix and bucket settings already applied.
In EC2:

The repository's pinned requirements target the older Python setup tested
locally with Python 3.11. Do not install them into the working EC2 Python 3.14
environment: older pydantic-core cannot use the required binary wheels there.
For this deployment we recorded the live package versions, recreated them in
an isolated environment using --only-binary=:all:, added cryptography, and
tested before changing the service. The live environment needed only the
tested cryptography version (50.0.2 for the verified deployment), not a
downgrade of FastAPI, Pydantic, or psycopg2. Revalidate versions if the server
environment changes. Back up code, dependencies, settings, and static files
before installation or copying. Restart after deploying tested files:

```bash
sudo systemctl restart endpoint-api.service
sudo journalctl -u endpoint-api.service -n 30 --no-pager
```

Build the changed dashboard with `npm.cmd run build` on Windows (or npm run
build on EC2). Deploy the resulting dashboard/dist contents to the actual
Nginx document root using your group's existing deployment process; do not
assume the document root from the repository config is the live one.
Both `/api/v1/auth/` and `/api/v1/media/` are covered by the existing /api/ proxy.
Login and screenshots must use that same origin; do not expose decryption keys
to frontend build variables. Both frontend and backend changes are required.

After deploying, sign out and back in to establish the new backend session.
Open Endpoints, select your device, and choose Screenshots or its screenshot
button. Capture 277 should display if its DB row and S3 object remain present
and the configured key matches. New captures need no manual IV entry.
The modal reports pending/missing uploads and authentication/decryption errors.
The button no longer opens an unrelated sample image when no capture exists.

The audit query must bind the hostname LIKE pattern as a parameter:
`NOT LIKE %s` with parameters `('%ubuntu%', limit)`. An unescaped literal
`'%ubuntu%'` alongside psycopg2 parameters caused IndexError and an empty
fallback response despite real captures being present. This correction is
covered by the media-viewing regression tests.

## Verified deployment and rollback (October 12, 2026)

Verified on the running two-worker EC2 src.main:app service:
unauthenticated media requests return 401, login returns 200, authenticated
media requests return image/jpeg, audit links resolve, and both historical
and newly uploaded PC screenshots display in the deployed gallery and modal.

The pre-feature backup preserves the working manual-decryption setup:
`/var/backups/endpoint-monitor/20261012T213858Z-before-dashboard-screenshots`.
Its archive checksum and critical file list were checked. The restore script
was syntax checked; a full restore rehearsal was not performed. To roll back,
coordinate with the group, stop test agents, and run on EC2:

```bash
sudo bash /var/backups/endpoint-monitor/20261012T213858Z-before-dashboard-screenshots/restore.sh
```

This restores the backed-up checkout, live virtual environment, static build,
service environment, and unit file. It does not roll back RDS or S3 data.
The previous static build also remains at
`/var/www/endpoint-monitor/dashboard_build.before-screenshots-20261012T222953Z`.
Keep backups protected because they contain credentials. Coordinate future
changes: a restore replaces deployed files with the snapshot, including any
changes made after that snapshot. The service still uses the main checkout;
deploying files did not merge the feature into the repository's main branch.

Keep test staging until the group is satisfied, then remove it through a
separate reviewed cleanup. The instance had limited free disk space. Stop the
foreground port-8001 test process with Ctrl+C when testing is complete; the
systemd-managed port-8000 backend continues to run independently.

## Verify

- Without a signed-in session, the image API must return 401.
- After login, the image API must return image/jpeg and Cache-Control: no-store.
- Wrong keys or damaged captures must return an error, not an image.
- Logging out or letting the session expire must block further image requests.
- Confirm the screenshot appears in the deployed dashboard, not just localhost.

Local tests:

```powershell
cd backend
..\.venv311\Scripts\python.exe -m pytest tests/test_media_viewing.py -q
```
