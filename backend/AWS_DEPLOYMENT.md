# Deploy the compatible EC2 API

Prepared for `/var/www/endpoint-monitor/main.py`, managed by
`endpoint-api.service` with two workers. This is a separate backend from
`src.main`; do not change the service to run `src.main:app`.

## Files

- `aws_main.py`: copy to the server as `main.py`.
- `aws_endpoint_registry.sql`: run in the existing RDS database first.
- Updated `agent/src/main.py` and `agent/src/transport/api_client.py`: deploy
  to every device that needs screenshot upload confirmation.

## Database preparation

Connect to the database configured for the service with pgAdmin or psql.
Confirm `telemetry_logs` has `hostname`, `timestamp`, `event_type`, and
`metrics`; metrics must be JSON/JSONB and timestamps must be valid PostgreSQL
timestamps or timestamp strings. Run `aws_endpoint_registry.sql` there.
It creates one new registry table, backfills actual existing hostnames, and
preserves telemetry records. Re-running the migration preserves registry state.
Hostname identifies a device; devices must have distinct, stable hostnames.
The registry assigns canonical IDs, independent of old agent IDs.

Do not run `database/seed.sql`: it belongs to the other backend and creates
sample records. Existing historical sample records in telemetry_logs will need
to be identified separately; this migration cannot distinguish them from real data.

## Service configuration

Keep the existing DB_HOST, DB_NAME, DB_USER, and DB_PASS service settings.
Optional settings: DB_PORT (5432), DB_SSLMODE (prefer).
Set S3_BUCKET to the actual bucket and AWS_REGION to its region. The code also
accepts AWS_DEFAULT_REGION as a fallback. Environment AWS credentials remain
supported, including session tokens; an EC2 instance role is also supported.
The signing identity needs s3:PutObject for uploads and s3:GetObject to verify
objects with HeadObject. Existing bucket policies/KMS requirements still apply.
Do not put secrets in the repository. Restart the service after configuration changes.

## Replace the API

Copy the local `aws_main.py` to EC2 as `/tmp/endpoint-main-new.py` using your
normal SSH/SCP connection. These commands run in the EC2 terminal:

```bash
cd /var/www/endpoint-monitor
sudo cp -p main.py "main.py.backup.$(date +%Y%m%d-%H%M%S)"
sudo cp /tmp/endpoint-main-new.py main.py
./venv/bin/python -m py_compile main.py
sudo systemctl restart endpoint-api.service
sudo systemctl status endpoint-api.service --no-pager
```

If py_compile fails, correct the file before restarting. If startup fails,
restore the timestamped backup and restart. Do not remove the old backup or
telemetry table. This guide does not automatically deploy or modify EC2.

## Verify API routing

On EC2:

```bash
curl -i http://127.0.0.1:8000/health
curl -i http://127.0.0.1:8000/api/v1/endpoints
curl -i 'http://127.0.0.1:8000/api/v1/audit/logs?limit=5'
sudo journalctl -u endpoint-api.service -n 50 --no-pager
```

Then open `http://52.91.191.168/api/v1/endpoints` and
`http://52.91.191.168/api/v1/audit/logs?limit=5`. Both should return JSON.
The existing /api/ Nginx proxy should continue to work. `/openapi.json` and
`/health` at the public address currently fall through to the frontend; use
the localhost URLs above unless explicit Nginx locations are added.

## Agent and dashboard

Run the updated Windows agent with the Python 3.11 virtual environment:

```powershell
.\.venv311\Scripts\python.exe agent\run_agent.py
```

In its consent dialog use `http://52.91.191.168/api/v1/telemetry` for the
current test deployment, or the deployed HTTPS hostname when configured.
Keep the real, unique computer hostname. Within seconds the deployed API
should report it. The frontend must be rebuilt and deployed from a branch
that removes sample fallback; updating the API does not update static files.
The local Vite proxy still points to localhost; it does not affect Nginx.
Test the deployed dashboard against the public /api/ URLs above.

Database write failures return 503 and log details in journalctl, never fake
success. Devices stop showing Online after 60 seconds without a receipt.
Kicks are persisted in the registry; a new agent registration reauthorizes it.
Consent is still asserted by the agent, not independently authenticated by
this backend. Existing frontend login is not backend API authentication.

## Verify actual storage

Run on the RDS database while the agent is active:

```sql
SELECT hostname, timestamp, event_type, metrics
FROM telemetry_logs
ORDER BY timestamp::timestamptz DESC LIMIT 10;

SELECT hostname, timestamp,
       metrics::jsonb ->> 's3_bucket' AS bucket,
       metrics::jsonb ->> 's3_key' AS object_key,
       metrics::jsonb ->> 'upload_status' AS upload_status
FROM telemetry_logs
WHERE metrics::jsonb ->> 's3_key' IS NOT NULL
ORDER BY timestamp::timestamptz DESC LIMIT 10;
```

Screenshot capture occurs roughly every minute if monitoring is active and
the privacy filter permits it. `pending` means a URL was issued, not that an
upload succeeded. The updated agent calls the confirmation route after a
successful PUT; the backend verifies a nonempty S3 object before recording
`uploaded`. Confirm the matching key exists in the actual S3 bucket too.
Old agents can upload but do not call confirmation, so their records remain pending.
S3 errors do not roll back successfully collected telemetry.

Encrypted `.enc` objects are not directly displayable images. This patch
does not add dashboard screenshot decryption or replace the agent's existing
demonstration encryption key. `media_url` remains null rather than falsely
presenting encrypted bytes as an image.

## Local checks

```powershell
.\.venv311\Scripts\python.exe -m unittest discover -s backend/tests -p test_aws_compatibility.py -v
```

These tests mock PostgreSQL and S3. Actual migration, service environment,
RDS connectivity, and bucket policies must be verified on the deployment.
