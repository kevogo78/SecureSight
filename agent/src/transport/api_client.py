import requests
import re
from xml.etree import ElementTree


def report_s3_error(response):
    """Report only allowlisted fields; S3 XML may contain signing secrets."""
    print(f"S3 upload rejected: HTTP {response.status_code}")
    code = None
    request_id = response.headers.get("x-amz-request-id", "")
    body = response.content[:65536]
    if len(response.content) <= 65536 and b"<!DOCTYPE" not in body.upper():
        try:
            root = ElementTree.fromstring(body)
            fields = {node.tag.rsplit('}', 1)[-1]: node.text or '' for node in root}
            code = fields.get("Code")
            request_id = fields.get("RequestId") or request_id
        except ElementTree.ParseError:
            pass
    if code and re.fullmatch(r"[A-Za-z0-9]{1,80}", code):
        print(f"S3 error code: {code}")
        hints = {
            "AccessDenied": "Check the backend signing identity's s3:PutObject permission, bucket policy conditions, and KMS permissions if applicable.",
            "SignatureDoesNotMatch": "Check the bucket region, PUT method, signed headers, and whether a proxy changed the URL or request.",
            "ExpiredToken": "Refresh the backend's temporary AWS credentials and request a new upload URL.",
            "InvalidToken": "Check the backend's temporary AWS credentials, including AWS_SESSION_TOKEN.",
            "InvalidAccessKeyId": "Check the AWS credentials used by the backend to sign URLs.",
            "RequestTimeTooSkewed": "Check the signing backend's system clock.",
            "RequestExpired": "Request a fresh upload URL and check the signing backend's clock.",
            "AuthorizationQueryParametersError": "Check the signing region and credential configuration.",
        }
        if code in hints:
            print(hints[code])
    if re.fullmatch(r"[A-Za-z0-9-]{1,128}", request_id):
        print(f"S3 request ID: {request_id}")
    region = response.headers.get("x-amz-bucket-region", "")
    if re.fullmatch(r"[a-z0-9-]{1,40}", region):
        print(f"S3 bucket region: {region}")

class TelemetryAPIClient:
    def __init__(self, server_url: str):
        self.server_url = server_url

    def transmit_telemetry(self, payload: dict) -> dict:
        try:
            res = requests.post(self.server_url, json=payload, timeout=5)
            if res.status_code == 200:
                return res.json()
            elif res.status_code in (401, 403):
                print(f"Telemetry authorization failed: HTTP {res.status_code}")
            else:
                print(f"Telemetry rejected: HTTP {res.status_code}. Check backend service logs.")
        except requests.exceptions.RequestException as e:
            print(f"Transport error: {e}")
        return None

    @staticmethod
    def upload_encrypted_media(presigned_url: str, encrypted_bytes: bytes) -> bool:
        try:
            res = requests.put(
                presigned_url,
                data=encrypted_bytes,
                headers={"Content-Type": "application/octet-stream"},
                timeout=10,
                allow_redirects=False,
            )
            if res.status_code != 200:
                report_s3_error(res)
            return res.status_code == 200
        except requests.exceptions.RequestException as e:
            # Request exceptions can include the signed URL and its credentials.
            print(f"S3 Media upload transport error: {type(e).__name__}")
            return False

    def request_recording_upload(self, payload):
        url = self.server_url.replace('/telemetry', '/recordings/upload-url')
        try:
            response = requests.post(url, json=payload, timeout=10)
            if response.status_code == 200:
                return response.json()
            print(f"Recording upload request rejected: HTTP {response.status_code}. Check backend migration/registration.")
        except requests.exceptions.RequestException:
            print("Recording upload request transport failed")
        return None

    def confirm_media_upload(self, path: str) -> bool:
        # Use the configured API origin; never print the signed upload URL.
        origin = self.server_url.split('/api/v1/')[0]
        try:
            res = requests.post(origin + path, timeout=10)
            if res.status_code != 200:
                print(f"S3 upload verification failed: HTTP {res.status_code}")
            return res.status_code == 200
        except requests.exceptions.RequestException as e:
            print(f"S3 upload verification transport error: {e}")
            return False
