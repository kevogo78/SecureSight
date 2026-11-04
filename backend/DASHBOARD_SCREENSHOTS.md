# View Encrypted Captures in the Dashboard

This feature targets the deployed `src.main:app` backend at
`/home/ubuntu/SecureSight/backend`, not standalone aws_main.py.
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

In `/home/ubuntu/SecureSight/backend/.env` (or your service directory), add these settings using private values:

```dotenv
SCREENSHOT_KEY_HEX=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
DASHBOARD_ADMIN_USER=administrator
DASHBOARD_ADMIN_PASSWORD=your_admin_password
DASHBOARD_SESSION_SECRET=a_random_secret_at_least_32_characters_long
DASHBOARD_COOKIE_SECURE=false
```

Use the same key configured on the client agent.
Do not generate a different encryption key for existing captures or share it
in public source control. You can copy the configured crypto key from
`agent/config/config.json` or `.env` into the server environment file.
This version supports one capture key; captures made with other keys require
key versioning before they can be viewed.

Generate the session secret on EC2:

```bash
python3 -c 'import secrets; print(secrets.token_hex(32))'
```

The default cookie requires HTTPS (`DASHBOARD_COOKIE_SECURE=true`). For HTTP-IP
development testing only, set `DASHBOARD_COOKIE_SECURE=false`. HTTP sends login
and images without transport encryption; use HTTPS and `true` for production use.
The backend's AWS identity needs `s3:GetObject` on the screenshot prefix, and
KMS decrypt permission if the bucket uses SSE-KMS.

## Deploy

Deploy the changed backend files into the EC2 checkout:

```bash
sudo systemctl restart endpoint-api.service
sudo journalctl -u endpoint-api.service -n 30 --no-pager
```

Build the changed dashboard:
```bash
cd /home/ubuntu/SecureSight/dashboard
npm install
npm run build
sudo cp -r dist/* /usr/share/nginx/html/
sudo systemctl restart nginx
```

Both `/api/v1/auth/` and `/api/v1/media/` are covered by the existing NGINX `/api/` proxy.
Login and screenshots use that same origin; do not expose decryption keys
to frontend build variables.

After deploying, sign out and back in to establish the new backend session.
Open Endpoints, select your device, and choose Screenshots. Captures will display
cleanly in the modal and gallery.

## Verify

- Without a signed-in session, the image API returns 401.
- After login, the image API returns image/jpeg and Cache-Control: no-store.
- Wrong keys or damaged captures return an error, not an image.
- Logging out or letting the session expire blocks further image requests.
- Confirm the screenshot appears in the deployed dashboard.

Local tests:

```bash
cd backend
python -m pytest tests/test_media_viewing.py -q
```
