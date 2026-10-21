# Diagnose an S3 upload returning 403

Telemetry success does not prove that the backend signing credentials or agent can
upload to S3. Generating a presigned URL is local signing and does not test
bucket access. Start with the S3 error code, not the HTTP status alone.

## Get the error

Run the updated agent source (`agent/run_agent.py`) and wait for the next
permitted screenshot or keystroke snapshot. Its upload log now reports the S3 XML Code and RequestId,
plus the bucket-region header when provided. It deliberately does not print
the full XML, signed URL, signature, access key, or canonical request.
Rebuild installed EXE agents to include the update; pulling source will not
change an already-built EXE.

## Interpret the code

- AccessDenied: check the actual backend signing identity's and agent's `s3:PutObject`
  permission on `arn:aws:s3:::YOUR_BUCKET/screenshots/*` and `arn:aws:s3:::YOUR_BUCKET/keylogs/*`.
  Check explicit denies and source-IP/VPC conditions in bucket policy, role policy,
  permission boundaries, and organization controls. A desktop upload originates from
  the desktop network, not the EC2 network. If the bucket uses SSE-KMS,
  check its key policy and the signer's `kms:GenerateDataKey` permission.
- SignatureDoesNotMatch: check the bucket's actual region, original unmodified
  signed URL, PUT method, and signed headers. The agent sends Content-Type:
  application/octet-stream. A generated URL that signs another Content-Type
  will not match. Check proxy interference and the EC2 clock as well.
- ExpiredToken / InvalidToken / InvalidAccessKeyId: check the signing
  backend's credentials, including `AWS_SESSION_TOKEN` when using temporary
  credentials. A fresh URL cannot repair expired signing credentials.
- RequestExpired / RequestTimeTooSkewed: use a fresh URL and check EC2 UTC time.
- HTTP 301/307 or a bucket-region hint: configure the signing client with the
  actual bucket region. The agent does not follow redirects for signed PUTs.

Keep the bucket private. Making objects public or changing browser CORS is
not a fix for this requests-based agent upload.

## Identify the deployed code before applying backend changes

In EC2, these checks do not change services:

```bash
ps -eo pid,args | grep '[u]vicorn'
sudo systemctl status endpoint-api.service --no-pager
```

For the standalone `/var/www/endpoint-monitor/main.py` deployment:

```bash
grep -nE 'signature_version|ContentType|generate_presigned_url|region_name' /var/www/endpoint-monitor/main.py
```

The repository's `backend/src/utils/s3_helper.py` now forces s3v4 and signs
ContentType application/octet-stream. `backend/src/config.py` honors AWS_REGION,
then AWS_DEFAULT_REGION. Apply changes to the code actually deployed; do not replace the
whole backend or run an unrelated database migration to fix an S3 403.

## Confirm the backend signing identity

Boto3 checks environment credentials before the EC2 instance role. Therefore,
the role attached to EC2 may not be the identity signing the URL. AWS CLI
`aws sts get-caller-identity` in an SSH shell proves only that shell's identity,
not the systemd service's identity. Check identity with the same credential
environment used by the service. Do not paste service environments or signed
URLs into logs/chat; they can contain credentials.

When permissions and signing are corrected, wait for a fresh agent upload,
confirm HTTP 200, and verify the corresponding nonempty `.enc` or `.txt` object in S3.
Existing URLs may expire after five minutes or sooner if their credentials expire.

References:
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/troubleshoot-403-errors.html
